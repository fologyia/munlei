# Estudo de fluxos de trabalho com o REA

Em 24 de novembro de 2026, a seção de fluxos de trabalho da página pública em
português foi examinada no Chromium 156.0.8078.79. O REA 6.4.0 registrou o DOM,
a árvore de acessibilidade e o viewport a 1440 e 390 px. A medição de CSS
computado também cobriu 991 e 992 px para localizar a transição. [Página de referência](https://monday.com/lang/pt)

| Largura | Versão exibida | Tamanho do título |
| ---: | --- | ---: |
| 390 px | Mobile | 32 px |
| 991 px | Mobile | 48 px |
| 992 px | Desktop | 96 px |
| 1440 px | Desktop | 128 px |

## Como a demonstração funciona

- No desktop, o diagrama combina imagens individuais, conectores e dois
  grupos de etapas. Após rolar até a demonstração, a medição registrou que
  as caixas das duas ramificações passaram de altura zero a cerca de 25 px
  para os rótulos e 56 px para as ações de notificação.
- A 390 px, o diagrama inteiro é uma única imagem, renderizada com 358 × 315 px.
  A leitura visual identifica um gatilho, uma decisão e dois caminhos com
  ações distintas.
- Nas duas larguras, a árvore do REA registrou um título de nível 2 e um
  link de chamada à ação. Os textos dentro das imagens do diagrama ficaram
  sem representação textual na árvore. No mobile, a imagem do diagrama
  tinha `alt=""`.

Para a Órbita, esse padrão pode virar um fluxo de aprovação de materiais.
Um pedido dentro do orçamento seguiria para compra, enquanto um pedido acima
do limite seguiria para revisão. Uma lista HTML com os nomes das etapas
permite ler o mesmo fluxo em qualquer largura e empilhar os caminhos em telas
estreitas. A transição pode ser opcional via `prefers-reduced-motion`.

## Repetir a captura

Use Node.js 22.19+ ou 24.11+ em suas respectivas versões principais. Instale
Playwright no Python e o Chromium, ou indique o navegador instalado com
`--chromium /caminho/do/chromium`.

```bash
python3 -m pip install playwright
python3 -m playwright install chromium
python3 scripts/capturar-layout-rea.py https://monday.com/lang/pt \
  --seletor '.hp-agents-workflows_component' --saida analise/rea-fluxos
```

O script usa uma sessão nova para cada largura, centraliza o elemento e chama
`inspect-web-page` e `capture-web-screenshot` pelo CDP local. Repita
`--largura` para substituir as larguras padrão de 1440 e 390 px. Cada coleta
gera `pagina-<largura>.json` e `captura-<largura>.png` em `analise/`,
diretório ignorado pelo Git. Para repetir as medidas de fonte, use o
[script de CSS computado](../scripts/medir-layout.py).

```bash
python3 scripts/medir-layout.py https://monday.com/lang/pt \
  --seletor 'h2.is-workflows' \
  --largura 390 --largura 991 --largura 992 --largura 1440
```
