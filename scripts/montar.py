#!/usr/bin/env python3
"""Monta site/index.html a partir de site/partials/NN-nome.html.

Cada seção NN-nome pode ter css/sections/NN-nome.css e js/sections/NN-nome.js;
os arquivos que existirem são incluídos na ordem numérica das partials.
"""
import os
from pathlib import Path

SITE = Path(__file__).resolve().parent.parent / "site"


def main() -> None:
    partials = sorted((SITE / "partials").glob("*.html"))
    styles, scripts, bodies = [], [], []
    for p in partials:
        name = p.stem
        bodies.append(f"<!-- {name} -->\n" + p.read_text(encoding="utf-8").strip())
        if (SITE / "css" / "sections" / f"{name}.css").exists():
            styles.append(f'<link rel="stylesheet" href="css/sections/{name}.css">')
        if (SITE / "js" / "sections" / f"{name}.js").exists():
            scripts.append(f'<script src="js/sections/{name}.js" defer></script>')

    html = (SITE / "index.template.html").read_text(encoding="utf-8")
    html = html.replace("<!-- @styles -->", "\n  ".join(styles))
    html = html.replace("<!-- @partials -->", "\n\n".join(bodies))
    html = html.replace("<!-- @scripts -->", "\n  ".join(scripts))

    out = SITE / "index.html"
    tmp = out.with_suffix(f".{os.getpid()}.tmp")
    tmp.write_text(html, encoding="utf-8")
    tmp.replace(out)
    print(f"{out.relative_to(SITE.parent)}: {len(partials)} seções")


if __name__ == "__main__":
    main()
