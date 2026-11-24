#!/usr/bin/env python3
"""Mede a geometria e o CSS computado de elementos em diferentes larguras."""

import argparse
import json
from urllib.parse import urlsplit

from playwright.sync_api import Error, sync_playwright


MEDIR = """
elementos => elementos.map(elemento => {
  const caixa = elemento.getBoundingClientRect();
  const css = getComputedStyle(elemento);
  return {
    tag: elemento.localName,
    exibido: elemento.getClientRects().length > 0 && css.visibility === 'visible',
    largura: Math.round(caixa.width * 10) / 10,
    altura: Math.round(caixa.height * 10) / 10,
    display: css.display,
    fonte: css.fontSize,
    entrelinha: css.lineHeight,
    colunas: css.display.includes('grid') ? css.gridTemplateColumns : null,
    espaco_colunas: css.display.includes('grid') ? css.columnGap : null
  };
})
"""


def largura(valor):
    try:
        numero = int(valor)
        if numero > 0:
            return numero
    except ValueError:
        pass
    raise argparse.ArgumentTypeError("a largura deve ser um inteiro positivo")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("url", help="URL HTTP ou HTTPS da página")
    parser.add_argument(
        "--seletor", action="append", required=True, help="seletor CSS, repetível"
    )
    parser.add_argument(
        "--largura", type=largura, action="append", help="largura em CSS px, repetível"
    )
    parser.add_argument("--chromium", help="caminho de um Chromium já instalado")
    parser.add_argument(
        "--ignorar-erros-https", action="store_true", help="ignora erros de TLS no Chromium"
    )
    args = parser.parse_args()
    url = urlsplit(args.url)
    if url.scheme not in ("http", "https") or not url.hostname:
        parser.error("informe uma URL HTTP ou HTTPS válida")

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path=args.chromium)
        resultado = {"chromium": browser.version, "medições": []}
        for largura_px in args.largura or [390, 767, 768, 991, 992, 1024, 1440]:
            with browser.new_context(
                viewport={"width": largura_px, "height": 900},
                locale="pt-BR",
                ignore_https_errors=args.ignorar_erros_https,
            ) as contexto:
                pagina = contexto.new_page()
                resposta = pagina.goto(args.url, wait_until="load")
                if resposta is None or not resposta.ok:
                    status = resposta.status if resposta is not None else "sem resposta"
                    raise SystemExit(f"falha ao carregar a página ({status}) em {largura_px}px")
                pagina.evaluate("async () => { await document.fonts.ready; }")
                resultado["medições"].append(
                    {
                        "url": pagina.url,
                        "viewport": pagina.evaluate("window.innerWidth"),
                        "elementos": {
                            seletor: pagina.eval_on_selector_all(seletor, MEDIR)
                            for seletor in args.seletor
                        },
                    }
                )
        browser.close()
    print(json.dumps(resultado, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    try:
        main()
    except Error as erro:
        raise SystemExit(str(erro)) from erro
