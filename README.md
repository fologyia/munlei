# munlei

Estudo de layout de landing page SaaS, usando como referência
<https://monday.com/lang/pt> e o [REA](https://github.com/morluto/rea) para
analisar a página.

## 1. Analisar a página com o REA

Requisitos: Node.js 22.19+ (ou 24.11+), Python 3 e Chrome/Chromium.

```bash
scripts/analisar-site.sh                      # padrão: https://monday.com/lang/pt
scripts/analisar-site.sh https://exemplo.com  # outra URL
```

O script abre o Chromium headless com a porta de depuração em `127.0.0.1`,
roda `rea list-browser-targets`, `inspect-web-page`, `analyze-web-bundle` e
`capture-web-screenshot`, e grava tudo em `analise/`:

| Arquivo           | Conteúdo                                                  |
| ----------------- | --------------------------------------------------------- |
| `pagina.json`     | DOM, árvore de acessibilidade, scripts, recursos e rede   |
| `bundle.json`     | Chunks JS, rotas/endpoints candidatos e bibliotecas usadas |
| `screenshot.png`  | Viewport visível (1440×900)                               |

Variáveis opcionais: `CHROME=/caminho/do/chrome`, `CDP_PORT=9222`.

## 2. Montar a cópia de estudo

A partir da evidência, reproduza **estrutura e técnica**: grid, seções,
hierarquia de títulos, espaçamentos, comportamento do menu, animações e
responsividade.

Não copie o que é deles: logo, nome, ilustrações, fotos, vídeos e textos de
marketing. Use textos próprios, uma marca fictícia e imagens de placeholder.
Por isso `analise/` fica no `.gitignore` e as capturas brutas não vão para o
repositório.
