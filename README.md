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

## 2. Cópia de estudo (`site/`)

Duas partes foram estudadas e reconstruídas com a marca fictícia **Órbita**:

- **Quadro de gerenciamento** (`#quadro`): mini-app funcional com tabela em
  grupos (responsável, cronograma, status, prazo), visão Kanban, edição inline,
  arrastar e soltar, filtros e dados salvos no navegador.
- **Seção de controle** (`#controle`): título grande e grade 3×2 no desktop,
  acordeão no celular.

```bash
python3 scripts/montar.py                              # gera site/index.html
python3 -m http.server 8000 --directory site           # abre em http://127.0.0.1:8000
```

Cada seção é um par `site/partials/NN-nome.html` + `site/css/sections/NN-nome.css`
(+ `site/js/sections/NN-nome.js`); a base visual fica em `site/css/base.css`.

O que foi reproduzido é **estrutura e técnica**: grid, escala tipográfica,
espaçamentos, cores de status e comportamento.

Não copie o que é deles: logo, nome, ilustrações, fotos, vídeos e textos de
marketing. Use textos próprios, uma marca fictícia e imagens de placeholder.
Por isso `analise/` fica no `.gitignore` e as capturas brutas não vão para o
repositório.
