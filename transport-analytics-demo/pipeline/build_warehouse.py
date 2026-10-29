"""Costruisce il data warehouse analitico (DuckDB) e le geometrie servite al frontend.

Livelli (medallion):
  raw    data/raw/*.csv                         estrazione OD così come arriva da BigQuery
  silver fact_od in data/warehouse.duckdb       tipizzata, codifiche compatte, zone a livello comune
  gold   dim_zona, dim_provincia + geo/*.json   anagrafiche e geometrie semplificate per la mappa

Zonizzazione: nei dati le zone piemontesi sono ACE (aree subcomunali per i comuni maggiori),
quelle fuori regione sono province. Senza geometrie ACE la granularità più fine mappabile è
il comune: le ACE vengono quindi ricondotte al comune (prime 6 cifre del codice ISTAT).
"""

import json
import os
import sys
import time
from pathlib import Path

import duckdb
from shapely.geometry import mapping, shape

DATA_DIR = Path(os.environ.get("DATA_DIR", Path(__file__).resolve().parents[1] / "data"))
RAW_DIR = DATA_DIR / "raw"
GEO_SRC_DIR = DATA_DIR / "geo_src"
GEO_OUT_DIR = DATA_DIR / "geo"
WAREHOUSE = DATA_DIR / "warehouse.duckdb"

PIEMONTE_PROVINCE = (1, 2, 3, 4, 5, 6, 96, 103)
# Le zone fuori regione sono province: id = OFFSET + codice ISTAT della provincia
EXTRA_REGION_OFFSET = 900_000
# Province sarde soppresse presenti nei dati -> province attuali presenti nelle geometrie
PROVINCE_RICODIFICATE = {90: 112, 91: 114, 92: 118, 95: 115, 111: 119}


def round_coords(geom, ndigits=4):
    def rnd(c):
        if isinstance(c[0], (list, tuple)):
            return [rnd(x) for x in c]
        return [round(c[0], ndigits), round(c[1], ndigits)]

    g = mapping(geom)
    return {"type": g["type"], "coordinates": rnd(g["coordinates"])}


def anchor(geom):
    c = geom.centroid
    return c if geom.contains(c) else geom.representative_point()


def build_geo():
    GEO_OUT_DIR.mkdir(parents=True, exist_ok=True)

    comuni_src = json.loads((GEO_SRC_DIR / "comuni_piemonte.geojson").read_text())
    comuni, comuni_feats = [], []
    for f in comuni_src["features"]:
        p = f["properties"]
        geom = shape(f["geometry"])
        pt = anchor(geom)
        zid = int(p["com_istat_code_num"])
        comuni.append((zid, p["name"], int(p["prov_istat_code_num"]), p["prov_name"], pt.x, pt.y))
        comuni_feats.append({
            "type": "Feature",
            "properties": {"id": zid, "nome": p["name"], "prov": p["prov_acr"]},
            "geometry": round_coords(geom.simplify(0.0015, preserve_topology=True)),
        })

    prov_src = json.loads((GEO_SRC_DIR / "province_italia.geojson").read_text())
    province, prov_feats = [], []
    for f in prov_src["features"]:
        p = f["properties"]
        geom = shape(f["geometry"])
        pt = anchor(geom)
        pid = int(p["prov_istat_code_num"])
        piemonte = pid in PIEMONTE_PROVINCE
        province.append((pid, p["prov_name"], p["prov_acr"], p["reg_name"], piemonte, pt.x, pt.y))
        prov_feats.append({
            "type": "Feature",
            "properties": {"id": pid, "nome": p["prov_name"], "sigla": p["prov_acr"], "piemonte": piemonte},
            "geometry": round_coords(geom.simplify(0.003 if piemonte else 0.01, preserve_topology=True), 3),
        })

    for name, feats in (("comuni.geojson", comuni_feats), ("province.geojson", prov_feats)):
        (GEO_OUT_DIR / name).write_text(
            json.dumps({"type": "FeatureCollection", "features": feats}, separators=(",", ":"))
        )
    return comuni, province


def main() -> int:
    csvs = sorted(RAW_DIR.glob("*.csv"))
    if not csvs:
        print(f"Nessun CSV in {RAW_DIR}: eseguire prima pipeline/fetch_data.py", file=sys.stderr)
        return 1

    t0 = time.time()
    comuni, province = build_geo()
    print(f"geometrie: {len(comuni)} comuni, {len(province)} province ({time.time() - t0:.1f}s)")

    tmp = WAREHOUSE.with_suffix(".tmp.duckdb")
    tmp.unlink(missing_ok=True)
    con = duckdb.connect(str(tmp))
    con.execute(f"SET threads = {os.cpu_count()}")

    con.execute("CREATE TABLE dim_provincia (id SMALLINT PRIMARY KEY, nome VARCHAR, sigla VARCHAR, regione VARCHAR, piemonte BOOLEAN, lon DOUBLE, lat DOUBLE)")
    con.executemany("INSERT INTO dim_provincia VALUES (?, ?, ?, ?, ?, ?, ?)", province)

    con.execute("CREATE TEMP TABLE geo_comuni (id INTEGER, nome VARCHAR, prov_id SMALLINT, prov_nome VARCHAR, lon DOUBLE, lat DOUBLE)")
    con.executemany("INSERT INTO geo_comuni VALUES (?, ?, ?, ?, ?, ?)", comuni)

    # Zone a livello "comune": comuni piemontesi + province extra-regione (trattate come un'unica zona)
    con.execute(f"""
        CREATE TABLE dim_zona AS
        SELECT id, nome, prov_id, prov_nome, true AS piemonte, lon, lat FROM geo_comuni
        UNION ALL
        SELECT {EXTRA_REGION_OFFSET} + id, nome || ' (prov.)', id, nome, false, lon, lat
        FROM dim_provincia WHERE NOT piemonte
    """)

    con.execute("CREATE TYPE fascia_t AS ENUM ('notte', 'mattina_punta', 'centrale', 'sera_punta', 'sera')")
    con.execute("CREATE TYPE tipologia_t AS ENUM ('interno', 'di scambio')")
    con.execute("CREATE TYPE nazionalita_t AS ENUM ('nazionale', 'internazionale')")
    con.execute("CREATE TYPE genere_t AS ENUM ('f', 'm', 'NA')")
    con.execute("CREATE TYPE eta_t AS ENUM ('18-25', '26-35', '36-45', '46-55', '56-65', '66+', 'NA')")
    con.execute("CREATE TYPE motivo_t AS ENUM ('residente', 'lavoratore', 'visitatore')")

    files = ", ".join(f"'{p}'" for p in csvs)
    remap = " ".join(f"WHEN {a} THEN {b}" for a, b in PROVINCE_RICODIFICATE.items())
    prov_extra = lambda side: f"(CASE CAST(ACE_{side} AS SMALLINT) {remap} ELSE CAST(ACE_{side} AS SMALLINT) END)"
    zona = lambda side: f"""CASE WHEN comune_{side} = 'NA'
             THEN {EXTRA_REGION_OFFSET} + {prov_extra(side)}
             ELSE CAST(substr(ACE_{side}, 1, 6) AS INTEGER) END"""
    prov = lambda side: f"""CASE WHEN comune_{side} = 'NA'
             THEN {prov_extra(side)}
             ELSE CAST(substr(ACE_{side}, 1, 3) AS SMALLINT) END"""

    t1 = time.time()
    con.execute(f"""
        CREATE TABLE fact_od AS
        SELECT
            giorno,
            CAST(isodow(giorno) AS TINYINT)                      AS dow,
            CAST(fascia_oraria AS fascia_t)                      AS fascia,
            CAST({zona('origine')} AS INTEGER)                   AS zo,
            CAST({zona('destinazione')} AS INTEGER)              AS zd,
            {prov('origine')}                                    AS po,
            {prov('destinazione')}                               AS pd,
            CAST(tipologia_di_spostamento AS tipologia_t)        AS tipologia,
            CAST(nazionalita_viaggiatore AS nazionalita_t)       AS nazionalita,
            CAST(genere AS genere_t)                             AS genere,
            CAST(eta AS eta_t)                                   AS eta,
            CAST(motivo_visita_origine AS motivo_t)              AS mo,
            CAST(motivo_visita_destinazione AS motivo_t)         AS md,
            CAST(sum(n_spostamenti) AS FLOAT)                    AS n
        FROM read_csv([{files}], header = true, all_varchar = false,
                      types = {{'ACE_origine': 'VARCHAR', 'ACE_destinazione': 'VARCHAR',
                               'genere': 'VARCHAR', 'eta': 'VARCHAR'}})
        GROUP BY ALL
        ORDER BY zo, zd, giorno
    """)
    rows, tot = con.execute("SELECT count(*), sum(n) FROM fact_od").fetchone()
    print(f"fact_od: {rows:,} righe, {tot:,.0f} spostamenti ({time.time() - t1:.1f}s)")

    missing = con.execute("""
        SELECT count(DISTINCT z) FROM (SELECT zo AS z FROM fact_od UNION SELECT zd FROM fact_od)
        WHERE z NOT IN (SELECT id FROM dim_zona)
    """).fetchone()[0]
    if missing:
        print(f"ATTENZIONE: {missing} zone senza geometria", file=sys.stderr)

    meta = json.loads((RAW_DIR / "configurazione.json").read_text()) if (RAW_DIR / "configurazione.json").exists() else {}
    con.execute("CREATE TABLE meta (k VARCHAR, v VARCHAR)")
    con.execute("INSERT INTO meta VALUES ('configurazione', ?), ('build_at', ?)",
                [json.dumps(meta.get("configurazione", {})), time.strftime("%Y-%m-%dT%H:%M:%S")])
    con.close()
    tmp.replace(WAREHOUSE)
    print(f"warehouse: {WAREHOUSE} ({WAREHOUSE.stat().st_size / 1e6:.0f} MB) in {time.time() - t0:.0f}s")
    return 0


if __name__ == "__main__":
    sys.exit(main())
