# Estudo responsivo da seção Controle

Medição feita em 24 de novembro de 2026 no Chromium 156.0.8078.79, com idioma
`pt-BR`, altura de 900 px e uma sessão nova para cada largura. A referência
analisada foi a seção Controle total da [página pública da monday.com em português](https://monday.com/lang/pt).

| Largura | Referência pública | Órbita |
| ---: | --- | --- |
| 390 px | Acordeão, título 32 px | Acordeão, título 32 px |
| 767 px | Acordeão, título 40 px | Acordeão, título 32 px |
| 768 px | Acordeão, título 48 px | Grade de 2 colunas, título 80 px |
| 991 px | Acordeão, título 48 px | Grade de 2 colunas, título 80 px |
| 992 px | Grade de 3 colunas, título 96 px | Grade de 3 colunas, título 128 px |
| 1024 px | Grade de 3 colunas, título 96 px | Grade de 3 colunas, título 128 px |
| 1440 px | Grade de 3 colunas, título 128 px | Grade de 3 colunas, título 128 px |

A grade tem seis itens na referência. A 1440 px, as duas grades ocupam
1360 px com 48 px entre colunas. A 992 e 1024 px, o espaço entre colunas
da referência cai para 32 px. A Órbita mantém 48 px nessas duas larguras.

A referência mantém duas versões da seção no DOM. Entre as larguras medidas,
o CSS exibe a grade a partir de 992 px e o acordeão até 991 px. A Órbita
reutiliza a mesma lista e exibe duas colunas de 768 a 991 px. Abaixo de
768 px, o JavaScript transforma os rótulos em botões com `aria-expanded`
e `aria-controls`. No protótipo, foi possível abrir um painel com Espaço
e manter o foco ao cruzar o limite de 767 para 768 px e voltar. Com o
JavaScript desativado, todos os painéis ficaram visíveis. Consulte o
[CSS da seção](../site/css/sections/20-controle.css) e o
[script do acordeão](../site/js/sections/20-controle.js).

## Repetir a medição

```bash
python3 -m pip install playwright
python3 -m playwright install chromium
mkdir -p analise
python3 scripts/medir-layout.py https://monday.com/lang/pt \
  --seletor 'h2.is-full-control' \
  --seletor '.hp-agents-control-component' \
  --seletor '.control-acc-group' > analise/controle-referencia.json
```

Para medir a Órbita, gere e sirva a página em um terminal.

```bash
python3 scripts/montar.py
python3 -m http.server 8000 --bind 127.0.0.1 --directory site
```

Em outro terminal, execute a comparação local.

```bash
python3 scripts/medir-layout.py http://127.0.0.1:8000 \
  --seletor '.controle__titulo' \
  --seletor '.controle__lista' \
  --seletor '.controle__botao' > analise/controle-orbita.json
```

`--largura` aceita larguras adicionais de interesse quando repetido e
substitui a lista padrão. `--chromium /caminho/do/chromium` usa uma instalação
local. O JSON registra a geometria e o CSS computado após o carregamento da
página e das fontes. Use `exibido` para identificar as caixas que participam
do layout com `visibility: visible`. Uma lista vazia indica que o seletor
não encontrou elementos. As medições dependem da versão da página servida
na data da coleta, e alterações nela podem exigir seletores novos.
