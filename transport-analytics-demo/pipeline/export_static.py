"""Esporta il warehouse in un pacchetto statico per la versione "serverless" della demo.

La versione statica (Artifact / hosting statico) non ha un backend: il browser scarica i dati in
colonne binarie compresse e le aggrega in un Web Worker (frontend/src/local/engine.worker.ts),
restituendo gli stessi JSON delle API FastAPI.

Formato: file gzip con estensione .bin.wasm. L'estensione serve solo perché gli hosting statici
(es. Artifact claude.ai) servono come binari soltanto tipi noti; il contenuto non è WebAssembly.
  pairs_zo.bin, pairs_zd.bin   uint16  indice zona di origine / destinazione per ogni coppia OD
  pairs_len.bin                uint32  numero di righe di ciascuna coppia (righe ordinate per coppia)
  rows_p1.bin                  uint8   giorno * 5 + fascia
  rows_p2.bin                  uint8   tipologia | nazionalita << 1 | genere << 2 | eta << 4
  rows_p3.bin                  uint8   motivo_origine * 3 + motivo_destinazione
  rows_nlo.bin, rows_nhi.bin   uint8   round(n * SCALE) su 16 bit (65535 = valore in overflow.json)
  meta.json                    come GET /api/meta + indice delle zone e province delle zone
"""

import gzip
import json
import os
import sys
from pathlib import Path

import duckdb
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
from app.queries import Warehouse  # noqa: E402

DATA_DIR = Path(os.environ.get("DATA_DIR", Path(__file__).resolve().parents[1] / "data"))
OUT_DIR = DATA_DIR / "static"
SCALE = 100
OVERFLOW = 65535


def write(name: str, arr: np.ndarray) -> None:
    name = name.replace(".bin", ".bin.wasm")
    (OUT_DIR / name).write_bytes(gzip.compress(arr.tobytes(), compresslevel=9, mtime=0))
    print(f"  {name:16s} {(OUT_DIR / name).stat().st_size / 1e6:6.2f} MB")


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    wh = Warehouse(DATA_DIR / "warehouse.duckdb")
    meta = wh.meta()
    con: duckdb.DuckDBPyConnection = wh.con

    zone_ids = [z["id"] for z in meta["zone"]]
    zone_index = {zid: i for i, zid in enumerate(zone_ids)}
    meta["indice_zone"] = zone_ids
    meta["prov_zone"] = [z["prov_id"] for z in meta["zone"]]
    meta["giorno0"] = meta["periodo"]["da"]
    meta["scala_n"] = SCALE

    d = con.execute("""
        SELECT zo, zd, (giorno - (SELECT min(giorno) FROM fact_od))::INT AS g,
               enum_code(fascia) AS f, enum_code(tipologia) AS tp, enum_code(nazionalita) AS nz,
               enum_code(genere) AS ge, enum_code(eta) AS et, enum_code(mo) AS mo, enum_code(md) AS md, n
        FROM fact_od ORDER BY zo, zd, g, f, mo, md, ge, et
    """).fetchnumpy()

    zo = np.array([zone_index[z] for z in d["zo"]], dtype=np.uint16)
    zd = np.array([zone_index[z] for z in d["zd"]], dtype=np.uint16)
    change = np.flatnonzero((zo[1:] != zo[:-1]) | (zd[1:] != zd[:-1])) + 1
    starts = np.concatenate([[0], change])
    lengths = np.diff(np.concatenate([starts, [len(zo)]])).astype(np.uint32)

    q = np.round(d["n"].astype(np.float64) * SCALE)
    over = np.flatnonzero(q >= OVERFLOW)
    nq = np.minimum(q, OVERFLOW).astype(np.uint16)

    print(f"{len(zo):,} righe, {len(starts):,} coppie OD, {len(over)} valori in overflow")
    write("pairs_zo.bin", zo[starts])
    write("pairs_zd.bin", zd[starts])
    write("pairs_len.bin", lengths)
    write("rows_p1.bin", (d["g"] * 5 + d["f"]).astype(np.uint8))
    write("rows_p2.bin", (d["tp"] | (d["nz"] << 1) | (d["ge"] << 2) | (d["et"] << 4)).astype(np.uint8))
    write("rows_p3.bin", (d["mo"] * 3 + d["md"]).astype(np.uint8))
    write("rows_nlo.bin", (nq & 0xFF).astype(np.uint8))
    write("rows_nhi.bin", (nq >> 8).astype(np.uint8))

    meta["overflow"] = {"righe": over.tolist(), "n": [float(v) for v in d["n"][over]]}
    meta["righe"] = int(len(zo))
    (OUT_DIR / "meta.json").write_text(json.dumps(meta, separators=(",", ":")))
    print(f"  meta.json        {(OUT_DIR / 'meta.json').stat().st_size / 1e6:6.2f} MB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
