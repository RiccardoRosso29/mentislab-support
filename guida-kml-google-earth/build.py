#!/usr/bin/env python3
"""Genera index.html autonomo da template.html.

Ogni {{IMG:percorso}} e i font vengono incorporati in base64, così index.html
funziona anche aperto da solo, senza cartelle accanto.
Uso: python3 build.py
"""
import base64
import mimetypes
import re
from pathlib import Path

ROOT = Path(__file__).parent


def data_uri(path: Path) -> str:
    mime = "font/woff2" if path.suffix == ".woff2" else mimetypes.guess_type(path.name)[0]
    return f"data:{mime};base64,{base64.b64encode(path.read_bytes()).decode()}"


src = (ROOT / "template.html").read_text(encoding="utf-8")
src = src.replace("{{FONT600}}", data_uri(ROOT / "assets" / "montserrat-600.woff2"))
src = src.replace("{{FONT800}}", data_uri(ROOT / "assets" / "montserrat-800.woff2"))
src = re.sub(r"\{\{IMG:([^}]+)\}\}", lambda m: data_uri(ROOT / m.group(1)), src)
(ROOT / "index.html").write_text(src, encoding="utf-8")
print(f"index.html generato ({len(src) // 1024} KB)")
