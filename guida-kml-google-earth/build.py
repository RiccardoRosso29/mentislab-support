#!/usr/bin/env python3
"""Genera index.html autonomo (logo, font e screenshot incorporati in base64).

Uso: python3 build.py
- {{VIDEO:passo-N|...}} incorpora video/passo-N.webm e .mp4 (generati con animazioni/, vedi README)
- {{SHOT:passo-N|...}} incorpora screenshots/passo-N.png (.jpg/.jpeg/.webp)
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
    if path.suffix in (".mp4", ".webm"):
        mime = f"video/{path.suffix[1:]}"
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


def video(match: re.Match) -> str:
    name, alt = match.group(1), html.escape(match.group(2))
    # WebM per primo (Chromium/Firefox), MP4 H.264 come alternativa (Safari).
    sources = "".join(
        f'<source src="{data_uri(path)}" type="video/{path.suffix[1:]}">'
        for path in (ROOT / "video" / f"{name}.webm", ROOT / "video" / f"{name}.mp4")
        if path.exists()
    )
    if not sources:
        return shot(match)
    return f'<figure><video autoplay muted loop playsinline aria-label="{alt}">{sources}</video></figure>'


src = (ROOT / "template.html").read_text(encoding="utf-8")
src = src.replace("{{LOGO}}", data_uri(ROOT / "assets" / "logo-w3-business.png"))
src = src.replace("{{LOGO_CK}}", data_uri(ROOT / "assets" / "logo-ckdelta.png"))
src = src.replace("{{FONT600}}", data_uri(ROOT / "assets" / "montserrat-600.woff2"))
src = src.replace("{{FONT800}}", data_uri(ROOT / "assets" / "montserrat-800.woff2"))
src = re.sub(r"\{\{VIDEO:([\w-]+)\|([^}]*)\}\}", video, src)
src = re.sub(r"\{\{SHOT:([\w-]+)\|([^}]*)\}\}", shot, src)
(ROOT / "index.html").write_text(src, encoding="utf-8")
print(f"index.html generato ({len(src) // 1024} KB)")
