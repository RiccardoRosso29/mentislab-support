"""Query analitiche sul warehouse DuckDB.

Tutte le query partono da fact_od filtrato: i grafici del pannello laterale sono calcolati in
un'unica scansione con GROUPING SETS, la mappa con un'aggregazione per coppia OD.
"""

import json
import threading
from collections import OrderedDict
from datetime import date, timedelta
from pathlib import Path

import duckdb

from .filters import Filters

DOW_LABELS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"]


class LRU:
    def __init__(self, size: int = 512):
        self.size, self.data, self.lock = size, OrderedDict(), threading.Lock()

    def get_or_compute(self, key, fn):
        with self.lock:
            if key in self.data:
                self.data.move_to_end(key)
                return self.data[key]
        value = fn()
        with self.lock:
            self.data[key] = value
            if len(self.data) > self.size:
                self.data.popitem(last=False)
        return value


class Warehouse:
    def __init__(self, path: Path):
        self.con = duckdb.connect(str(path), read_only=True)
        self.cache = LRU()
        d0, d1 = self.con.execute("SELECT min(giorno), max(giorno) FROM fact_od").fetchone()
        self.days = [d0 + timedelta(days=i) for i in range((d1 - d0).days + 1)]

    def _q(self, sql: str, params: list | None = None):
        cur = self.con.cursor()
        try:
            return cur.execute(sql, params or []).fetchall()
        finally:
            cur.close()

    def _in_period(self, f: Filters, d) -> bool:
        return (not f.dow or d.isoweekday() in f.dow) and (not f.da or d >= f.da) and (not f.a or d <= f.a)

    def _n_days(self, f: Filters) -> int:
        return sum(1 for d in self.days if self._in_period(f, d)) or 1

    # ------------------------------------------------------------------ meta
    def meta(self) -> dict:
        def build():
            province = [
                dict(id=r[0], nome=r[1], sigla=r[2], regione=r[3], piemonte=r[4], lon=r[5], lat=r[6])
                for r in self._q("SELECT id, nome, sigla, regione, piemonte, lon, lat FROM dim_provincia ORDER BY nome")
            ]
            zone = [
                dict(id=r[0], nome=r[1], prov_id=r[2], prov_nome=r[3], piemonte=r[4], lon=r[5], lat=r[6])
                for r in self._q("""
                    SELECT id, nome, prov_id, prov_nome, piemonte, lon, lat FROM dim_zona
                    WHERE id IN (SELECT zo FROM fact_od UNION SELECT zd FROM fact_od)
                    ORDER BY nome""")
            ]
            ace = [
                dict(id=r[0], nome=r[1], comune_id=r[2], prov_id=r[3], prov_nome=r[4], piemonte=r[5], lon=r[6], lat=r[7])
                for r in self._q("""
                    SELECT id, nome, comune_id, prov_id, prov_nome, piemonte, lon, lat FROM dim_ace
                    WHERE id IN (SELECT ao FROM fact_od UNION SELECT ad FROM fact_od)
                    ORDER BY nome""")
            ]
            config = json.loads(self._q("SELECT v FROM meta WHERE k = 'configurazione'")[0][0])
            return dict(
                periodo=dict(da=self.days[0].isoformat(), a=self.days[-1].isoformat(), giorni=len(self.days)),
                fasce=[dict(id=f[2], da=f[0], a=f[1]) for f in config.get("fasce", [])],
                province=province,
                zone=zone,
                ace=ace,
            )

        return self.cache.get_or_compute("meta", build)

    # ----------------------------------------------------------------- stats
    def stats(self, f: Filters) -> dict:
        return self.cache.get_or_compute(("stats", f.key()), lambda: self._stats(f))

    def _stats(self, f: Filters) -> dict:
        where, params = f.where()
        n_days = self._n_days(f)
        rows = self._q(f"""
            SELECT GROUPING(giorno, fascia, genere, eta, mo, md, nazionalita, tipologia) AS g,
                   giorno, fascia::VARCHAR, genere::VARCHAR, eta::VARCHAR, mo::VARCHAR, md::VARCHAR,
                   nazionalita::VARCHAR, tipologia::VARCHAR, sum(n) AS n
            FROM fact_od {where}
            GROUP BY GROUPING SETS ((giorno), (fascia), (genere, eta), (mo, md), (nazionalita), (tipologia), ())
        """, params)

        # bitmask GROUPING: 1 = colonna aggregata. Ordine: giorno..tipologia (bit 7..0)
        def only(*cols):
            names = ["giorno", "fascia", "genere", "eta", "mo", "md", "nazionalita", "tipologia"]
            return sum(1 << (7 - i) for i, c in enumerate(names) if c not in cols)

        by = lambda mask: [r for r in rows if r[0] == mask]
        total = next((r[9] for r in by(only()) ), 0.0) or 0.0

        giornaliero = {r[1]: r[9] for r in by(only("giorno"))}
        serie = [dict(giorno=d.isoformat(), dow=d.isoweekday(), n=giornaliero.get(d, 0.0))
                 for d in self.days if self._in_period(f, d)]

        dow_sum, dow_cnt = [0.0] * 7, [0] * 7
        for d in self.days:
            if not self._in_period(f, d):
                continue
            dow_sum[d.isoweekday() - 1] += giornaliero.get(d, 0.0)
            dow_cnt[d.isoweekday() - 1] += 1
        per_dow = [dict(dow=i + 1, label=DOW_LABELS[i], media=(dow_sum[i] / dow_cnt[i]) if dow_cnt[i] else None)
                   for i in range(7)]

        genere_eta = [dict(genere=r[3], eta=r[4], n=r[9]) for r in by(only("genere", "eta"))]
        kv = lambda mask, col: {r[col]: r[9] for r in by(mask)}
        tipologia = kv(only("tipologia"), 8)
        nazionalita = kv(only("nazionalita"), 7)

        kpi = dict(
            totale=total,
            media_giornaliera=total / n_days,
            giorni=n_days,
            quota_scambio=(tipologia.get("di scambio", 0.0) / total) if total else None,
            quota_internazionali=(nazionalita.get("internazionale", 0.0) / total) if total else None,
        )
        if f.nodo is not None:
            kpi["nodo"] = self._node_split(f)

        return dict(
            kpi=kpi,
            giornaliero=serie,
            per_dow=per_dow,
            per_fascia=[dict(fascia=k, media=v / n_days) for k, v in kv(only("fascia"), 2).items()],
            genere_eta=genere_eta,
            motivi=[dict(mo=r[5], md=r[6], n=r[9]) for r in by(only("mo", "md"))],
            nazionalita=nazionalita,
            tipologia=tipologia,
            top_od=self._top_od(f),
            n_giorni=n_days,
        )

    def _node_split(self, f: Filters) -> dict:
        where, params = f.where()
        out, inn, intra = self._q(f"""
            SELECT sum(n) FILTER ({f.zo} = ? AND {f.zd} <> ?),
                   sum(n) FILTER ({f.zd} = ? AND {f.zo} <> ?),
                   sum(n) FILTER ({f.zo} = ? AND {f.zd} = ?)
            FROM fact_od {where}
        """, [f.nodo] * 6 + params)[0]
        return dict(uscita=out or 0.0, ingresso=inn or 0.0, interni=intra or 0.0)

    def _names_cte(self, f: Filters) -> str:
        if f.livello == "ace":
            return "SELECT id, nome, prov_nome AS sub FROM dim_ace"
        if f.livello == "comune":
            return "SELECT id, nome, prov_nome AS sub FROM dim_zona"
        return "SELECT id, nome, regione AS sub FROM dim_provincia"

    def _top_od(self, f: Filters, limit: int = 10) -> list[dict]:
        where, params = f.where()
        cond = f"{f.zo} <> {f.zd}"
        where = f"{where} AND {cond}" if where else f"WHERE {cond}"
        rows = self._q(f"""
            WITH p AS (SELECT {f.zo} AS o, {f.zd} AS d, sum(n) AS n FROM fact_od {where} GROUP BY ALL
                       ORDER BY n DESC LIMIT {int(limit)}),
                 z AS ({self._names_cte(f)})
            SELECT p.o, zo.nome, p.d, zd.nome, p.n FROM p
            LEFT JOIN z zo ON zo.id = p.o LEFT JOIN z zd ON zd.id = p.d
            ORDER BY p.n DESC
        """, params)
        n_days = self._n_days(f)
        return [dict(o=r[0], o_nome=r[1], d=r[2], d_nome=r[3], n=r[4], media=r[4] / n_days) for r in rows]

    # ---------------------------------------------------------------- export
    CAMPI = ("origine", "destinazione", "giorno", "giorno_settimana", "fascia_oraria",
             "genere", "eta", "nazionalita", "tipologia", "motivo_origine", "motivo_destinazione")

    def export(self, f: Filters, campi: list[str], soglia: float, righe: bool) -> dict:
        """Dataset aggregato sui campi scelti; i gruppi con meno di `soglia` spostamenti sono rimossi."""
        campi = [c for c in self.CAMPI if c in campi]
        z = self._names_cte(f)
        expr = {
            "origine": "zo.nome", "destinazione": "zd.nome", "giorno": "strftime(giorno, '%Y-%m-%d')",
            "giorno_settimana": "dow", "fascia_oraria": "fascia::VARCHAR", "genere": "genere::VARCHAR",
            "eta": "eta::VARCHAR", "nazionalita": "nazionalita::VARCHAR", "tipologia": "tipologia::VARCHAR",
            "motivo_origine": "mo::VARCHAR", "motivo_destinazione": "md::VARCHAR",
        }
        where, params = f.where(with_selection=False)
        cols = ", ".join(f"{expr[c]} AS {c}" for c in campi)
        rows = self._q(f"""
            WITH z AS ({z})
            SELECT {cols}, sum(n) AS n FROM fact_od
            LEFT JOIN z zo ON zo.id = fact_od.{f.zo} LEFT JOIN z zd ON zd.id = fact_od.{f.zd}
            {where} GROUP BY ALL ORDER BY n DESC
        """, params)
        n_days = self._n_days(f)
        totale = sum(r[-1] for r in rows)
        kept = [r for r in rows if r[-1] >= soglia]
        esportati = sum(r[-1] for r in kept)
        out = dict(campi=campi, soglia=soglia, gruppi_totali=len(rows), gruppi_esportati=len(kept),
                   spostamenti_totali=totale, spostamenti_esportati=esportati,
                   perdita=(1 - esportati / totale) if totale else 0.0, n_giorni=n_days)
        if righe:
            media = "giorno" not in campi
            dow = campi.index("giorno_settimana") if "giorno_settimana" in campi else None
            out["header"] = campi + ["spostamenti_periodo"] + (["spostamenti_medi_giorno"] if media else [])
            out["rows"] = [
                [DOW_LABELS[v - 1] if i == dow else v for i, v in enumerate(r[:-1])]
                + [round(r[-1], 1)] + ([round(r[-1] / n_days, 1)] if media else [])
                for r in kept
            ]
        return out

    # ----------------------------------------------------------------- flows
    def flows(self, f: Filters, limit: int) -> dict:
        return self.cache.get_or_compute(("flows", f.key(), limit), lambda: self._flows(f, limit))

    def _flows(self, f: Filters, limit: int) -> dict:
        where, params = f.where()
        n_days = self._n_days(f)
        pairs = f"SELECT {f.zo} AS o, {f.zd} AS d, sum(n) AS n FROM fact_od {where} GROUP BY ALL"
        nodes = self._q(f"""
            WITH p AS ({pairs})
            SELECT id, sum(uscita), sum(ingresso), sum(interni) FROM (
                SELECT o AS id, CASE WHEN o <> d THEN n ELSE 0 END AS uscita, 0 AS ingresso,
                       CASE WHEN o = d THEN n ELSE 0 END AS interni FROM p
                UNION ALL
                SELECT d, 0, n, 0 FROM p WHERE o <> d
            ) GROUP BY id
        """, params)
        links = self._q(f"""
            WITH p AS ({pairs}) SELECT o, d, n FROM p WHERE o <> d ORDER BY n DESC LIMIT {int(limit)}
        """, params)
        totals = self._q(f"WITH p AS ({pairs}) SELECT count(*) FILTER (o <> d), sum(n) FILTER (o <> d) FROM p", params)[0]
        return dict(
            livello=f.livello,
            n_giorni=n_days,
            nodi=[dict(id=r[0], uscita=r[1] / n_days, ingresso=r[2] / n_days, interni=r[3] / n_days) for r in nodes],
            flussi=[dict(o=r[0], d=r[1], n=r[2] / n_days) for r in links],
            coppie_totali=totals[0] or 0,
            volume_flussi=(totals[1] or 0.0) / n_days,
        )
