"""Traduzione dei filtri della UI in clausole SQL parametriche sul fact table."""

from dataclasses import dataclass, field
from datetime import date
from typing import Literal

from fastapi import HTTPException, Query

Livello = Literal["ace", "comune", "provincia"]

ZO = {"ace": "ao", "comune": "zo", "provincia": "po"}
ZD = {"ace": "ad", "comune": "zd", "provincia": "pd"}

FASCE = ("notte", "mattina_punta", "centrale", "sera_punta", "sera")
TIPOLOGIE = ("interno", "di scambio")
NAZIONALITA = ("nazionale", "internazionale")
GENERI = ("f", "m", "NA")
ETA = ("18-25", "26-35", "36-45", "46-55", "56-65", "66+", "NA")
MOTIVI = ("residente", "lavoratore", "visitatore")


def _split(raw: str | None) -> list[str]:
    return [v for v in (raw or "").split(",") if v != ""]


def _enum(raw: str | None, allowed: tuple[str, ...], name: str) -> list[str]:
    values = _split(raw)
    bad = [v for v in values if v not in allowed]
    if bad:
        raise HTTPException(400, f"valori non validi per {name}: {bad}")
    return values


def _ints(raw: str | None, name: str) -> list[int]:
    try:
        return [int(v) for v in _split(raw)]
    except ValueError:
        raise HTTPException(400, f"{name} deve essere una lista di interi")


def _zones(raw: str | None, name: str) -> tuple[list[int], list[int], list[int]]:
    """Token 'p:<provincia>', 'c:<zona comunale>' o 'a:<ACE>' -> (province, comuni, ACE)."""
    out: dict[str, list[int]] = {"p": [], "c": [], "a": []}
    for tok in _split(raw):
        kind, _, val = tok.partition(":")
        if kind not in out or not val.isdigit():
            raise HTTPException(400, f"token non valido per {name}: {tok}")
        out[kind].append(int(val))
    return out["p"], out["c"], out["a"]


@dataclass
class Filters:
    livello: Livello = "comune"
    dow: list[int] = field(default_factory=list)
    fascia: list[str] = field(default_factory=list)
    tipologia: list[str] = field(default_factory=list)
    nazionalita: list[str] = field(default_factory=list)
    genere: list[str] = field(default_factory=list)
    eta: list[str] = field(default_factory=list)
    motivo: list[tuple[str, str]] = field(default_factory=list)
    origine: tuple[list[int], list[int], list[int]] = ([], [], [])
    destinazione: tuple[list[int], list[int], list[int]] = ([], [], [])
    da: date | None = None
    a: date | None = None
    nodo: int | None = None
    link: tuple[int, int] | None = None

    @property
    def zo(self) -> str:
        return ZO[self.livello]

    @property
    def zd(self) -> str:
        return ZD[self.livello]

    def key(self) -> str:
        return repr(self)

    def where(self, with_selection: bool = True, attributes: bool = True) -> tuple[str, list]:
        """Clausola WHERE; con attributes=False valgono solo zone e selezione (grafici crossfilter)."""
        clauses, params = [], []
        attr = self if attributes else Filters(livello=self.livello)

        def add_in(col: str, values: list):
            if values:
                clauses.append(f"{col} IN ({', '.join('?' * len(values))})")
                params.extend(values)

        if attr.da:
            clauses.append("giorno >= ?")
            params.append(attr.da)
        if attr.a:
            clauses.append("giorno <= ?")
            params.append(attr.a)
        add_in("dow", attr.dow)
        add_in("fascia", attr.fascia)
        add_in("tipologia", attr.tipologia)
        add_in("nazionalita", attr.nazionalita)
        add_in("genere", attr.genere)
        add_in("eta", attr.eta)
        if attr.motivo:
            clauses.append("(" + " OR ".join("(mo = ? AND md = ?)" for _ in attr.motivo) + ")")
            for mo, md in attr.motivo:
                params.extend([mo, md])

        # origine E destinazione: un lato senza filtri non vincola
        for side, zones in (("o", self.origine), ("d", self.destinazione)):
            parts = []
            for col, ids in zip(("p", "z", "a"), zones):
                if ids:
                    parts.append(f"{col}{side} IN ({', '.join('?' * len(ids))})")
                    params.extend(ids)
            if parts:
                clauses.append("(" + " OR ".join(parts) + ")")

        if with_selection:
            if self.nodo is not None:
                clauses.append(f"({self.zo} = ? OR {self.zd} = ?)")
                params.extend([self.nodo, self.nodo])
            elif self.link is not None:
                a, b = self.link
                clauses.append(f"(({self.zo} = ? AND {self.zd} = ?) OR ({self.zo} = ? AND {self.zd} = ?))")
                params.extend([a, b, b, a])

        return ("WHERE " + " AND ".join(clauses)) if clauses else "", params


def parse_filters(
    livello: Livello = Query("comune"),
    dow: str | None = None,
    fascia: str | None = None,
    tipologia: str | None = None,
    nazionalita: str | None = None,
    genere: str | None = None,
    eta: str | None = None,
    motivo: str | None = Query(None, description="coppie mo>md, es. residente>lavoratore"),
    origine: str | None = Query(None, description="token p:<provincia> o c:<zona>"),
    destinazione: str | None = None,
    da: date | None = None,
    a: date | None = None,
    nodo: int | None = None,
    link: str | None = Query(None, description="a,b"),
) -> Filters:
    days = _ints(dow, "dow")
    if any(d < 1 or d > 7 for d in days):
        raise HTTPException(400, "dow deve essere tra 1 (lun) e 7 (dom)")
    pairs = []
    for tok in _split(motivo):
        mo, _, md = tok.partition(">")
        if mo not in MOTIVI or md not in MOTIVI:
            raise HTTPException(400, f"motivo non valido: {tok}")
        pairs.append((mo, md))
    link_ids = _ints(link, "link")
    if link_ids and len(link_ids) != 2:
        raise HTTPException(400, "link richiede due id")
    return Filters(
        livello=livello,
        dow=sorted(set(days)),
        fascia=_enum(fascia, FASCE, "fascia"),
        tipologia=_enum(tipologia, TIPOLOGIE, "tipologia"),
        nazionalita=_enum(nazionalita, NAZIONALITA, "nazionalita"),
        genere=_enum(genere, GENERI, "genere"),
        eta=_enum(eta, ETA, "eta"),
        motivo=pairs,
        origine=_zones(origine, "origine"),
        destinazione=_zones(destinazione, "destinazione"),
        da=da,
        a=a,
        nodo=nodo,
        link=(link_ids[0], link_ids[1]) if link_ids else None,
    )
