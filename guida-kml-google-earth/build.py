#!/usr/bin/env python3
"""Genera index.html autonomo (logo, font e screenshot incorporati in base64).

Uso: metti gli screenshot in screenshots/ con nome passo-1.png ... passo-5.png
(sono accettati anche .jpg/.jpeg/.webp) e lancia: python3 build.py
"""
import base64
import html
import mimetypes
import re
from pathlib import Path

ROOT = Path(__file__).parent
SHOT_EXTS = (".png", ".jpg", ".jpeg", ".webp")


def data_uri(path: Path) -> str:
    mime = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    if path.suffix == ".woff2":
        mime = "font/woff2"
    return f"data:{mime};base64,{base64.b64encode(path.read_bytes()).decode()}"


def shot(match: re.Match) -> str:
    name, alt = match.group(1), html.escape(match.group(2))
    for ext in SHOT_EXTS:
        path = ROOT / "screenshots" / f"{name}{ext}"
        if path.exists():
            return f'<figure><img src="{data_uri(path)}" alt="{alt}" loading="lazy"></figure>'
    return (f'<figure><div class="shot-missing"><div><b>Screenshot da inserire</b>'
            f'{alt}<br>screenshots/{name}.png</div></div></figure>')


src = (ROOT / "template.html").read_text(encoding="utf-8")
src = src.replace("{{LOGO}}", data_uri(ROOT / "assets" / "logo-w3-business.png"))
src = src.replace("{{FONT600}}", data_uri(ROOT / "assets" / "montserrat-600.woff2"))
src = src.replace("{{FONT800}}", data_uri(ROOT / "assets" / "montserrat-800.woff2"))
src = re.sub(r"\{\{SHOT:([\w-]+)\|([^}]*)\}\}", shot, src)
(ROOT / "index.html").write_text(src, encoding="utf-8")
print(f"index.html generato ({len(src) // 1024} KB)")
