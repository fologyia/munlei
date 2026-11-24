#!/usr/bin/env python3
"""Captura DOM, acessibilidade e PNG de uma seção com o REA."""

import argparse
import base64
import json
from pathlib import Path
import subprocess
from tempfile import TemporaryDirectory
from urllib.parse import urlsplit

from playwright.sync_api import Error, sync_playwright


REA = ["npx", "--yes", "rea-agents@6.4.0"]


def capturar(chromium, args, largura):
    with TemporaryDirectory(prefix="munlei-rea-") as perfil:
        contexto = chromium.launch_persistent_context(
            perfil,
            executable_path=args.chromium,
            viewport={"width": largura, "height": 900},
            locale="pt-BR",
            ignore_https_errors=args.ignorar_erros_https,
            args=["--remote-debugging-port=0"],
        )
        try:
            pagina = contexto.pages[0]
            resposta = pagina.goto(args.url, wait_until="domcontentloaded")
            if resposta is None or not resposta.ok:
                status = resposta.status if resposta is not None else "sem resposta"
                raise SystemExit(f"falha ao carregar a página em {largura}px ({status})")

            pagina.evaluate("async () => { await document.fonts.ready; }")
            secao = pagina.locator(args.seletor).filter(visible=True)
            secao.evaluate("(el) => el.scrollIntoView({behavior: 'instant', block: 'center'})")

            sessao = contexto.new_cdp_session(pagina)
            alvo = sessao.send("Target.getTargetInfo")["targetInfo"]["targetId"]
            sessao.detach()
            porta = Path(perfil, "DevToolsActivePort").read_text().splitlines()[0]
            origem = urlsplit(pagina.url)
            alvo_rea = [
                f"http://127.0.0.1:{porta}", alvo, "--allowed-origins",
                f"{origem.scheme}://{origem.netloc}", "--format", "json",
            ]
            dados = subprocess.check_output(
                REA + ["inspect-web-page", *alvo_rea,
                       "--include-accessibility-text", "--observation-ms", "1000"]
            )
            imagem = subprocess.check_output(REA + ["capture-web-screenshot", *alvo_rea])
            png = json.loads(imagem)["normalized_result"]["artifact"]["data_base64"]
            (args.saida / f"pagina-{largura}.json").write_bytes(dados)
            (args.saida / f"captura-{largura}.png").write_bytes(base64.b64decode(png))
        finally:
            contexto.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("url", help="URL HTTP ou HTTPS da página")
    parser.add_argument("--seletor", required=True, help="seletor CSS da seção visível")
    parser.add_argument("--largura", type=int, action="append", help="largura em CSS px, repetível")
    parser.add_argument("--saida", type=Path, default=Path("analise/rea-layout"))
    parser.add_argument("--chromium", help="caminho de um Chromium já instalado")
    parser.add_argument(
        "--ignorar-erros-https", action="store_true", help="ignora erros de TLS no Chromium"
    )
    args = parser.parse_args()
    url = urlsplit(args.url)
    if url.scheme not in ("http", "https") or not url.hostname:
        parser.error("informe uma URL HTTP ou HTTPS válida")
    larguras = args.largura or [1440, 390]
    if any(largura <= 0 for largura in larguras):
        parser.error("a largura deve ser um inteiro positivo")

    args.saida.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as playwright:
        for largura in larguras:
            capturar(playwright.chromium, args, largura)
            print(f"Captura de {largura} × 900 px em {args.saida}", flush=True)


if __name__ == "__main__":
    try:
        main()
    except (Error, subprocess.CalledProcessError) as erro:
        raise SystemExit(str(erro)) from erro
