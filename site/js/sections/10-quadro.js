/* Órbita — Quadro de gerenciamento (mini-app de estudo, JS puro, sem dependências).
   Estado único em memória {titulo, grupos, tarefas, pessoas} → renderização a partir do
   estado; persistência em localStorage ("orbita-quadro-v1") com fallback para o exemplo. */
(() => {
  'use strict';

  const raiz = document.getElementById('quadro');
  if (!raiz) return;

  const $ = (sel, el = raiz) => el.querySelector(sel);
  const $$ = (sel, el = raiz) => Array.from(el.querySelectorAll(sel));
  const porChave = (k) => (k ? raiz.querySelector(`[data-k="${CSS.escape(k)}"]`) : null);

  // ---------------------------------------------------------------- constantes
  const CHAVE = 'orbita-quadro-v1';
  const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const MESES_LONGOS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const STATUS = [
    { id: 'nao', rotulo: 'Não iniciado', cor: 'var(--qd-nao)', texto: 'var(--qd-nao-txt)' },
    // texto escuro sobre laranja e verde (branco ali fica abaixo de 4,5:1)
    { id: 'andamento', rotulo: 'Em andamento', cor: 'var(--s-working)', texto: 'var(--qd-texto)' },
    { id: 'parado', rotulo: 'Parado', cor: 'var(--s-stuck)', texto: '#fff' },
    { id: 'feito', rotulo: 'Feito', cor: 'var(--s-done)', texto: 'var(--qd-texto)' },
  ];
  const ST = Object.fromEntries(STATUS.map((s) => [s.id, s]));
  const estiloStatus = (s) => `--st:${s.cor};--st-txt:${s.texto}`;
  const ORDEM_BATERIA = ['feito', 'andamento', 'parado', 'nao'];
  // cor: faixa, pontos e barras; texto: tom escuro da mesma cor, com 4,5:1 ou mais sobre o branco
  const CORES = {
    azul: { cor: '#579bfc', texto: '#2f6fd8' },
    roxo: { cor: '#a25ddc', texto: '#8b47c9' },
    verde: { cor: '#00c875', texto: '#007d4c' },
    laranja: { cor: '#fdab3d', texto: '#9a5700' },
    rosa: { cor: '#ff5ac4', texto: '#c0158c' },
    grafite: { cor: '#5f6b85', texto: '#5f6b85' },
  };
  const AVATARES = ['a', 'b', 'c', 'd', 'e', 'f'];

  const ICONES = {
    alca: '<g fill="currentColor" stroke="none"><circle cx="7.5" cy="5" r="1.3"/><circle cx="12.5" cy="5" r="1.3"/><circle cx="7.5" cy="10" r="1.3"/><circle cx="12.5" cy="10" r="1.3"/><circle cx="7.5" cy="15" r="1.3"/><circle cx="12.5" cy="15" r="1.3"/></g>',
    pontos: '<g fill="currentColor" stroke="none"><circle cx="4.5" cy="10" r="1.4"/><circle cx="10" cy="10" r="1.4"/><circle cx="15.5" cy="10" r="1.4"/></g>',
    seta: '<path d="m5.5 8 4.5 4.5L14.5 8"/>',
    mais: '<path d="M10 4.5v11M4.5 10h11"/>',
    usuario: '<circle cx="10" cy="7.2" r="3"/><path d="M4.6 16.5a5.4 5.4 0 0 1 10.8 0"/>',
    calendario: '<rect x="3" y="4.5" width="14" height="12.5" rx="2"/><path d="M3 8.5h14M7 3v3M13 3v3"/>',
    lixeira: '<path d="M4 6h12M8.2 6V4.2h3.6V6M5.8 6l.7 10.1a1 1 0 0 0 1 .9h5a1 1 0 0 0 1-.9L14.2 6M8.5 9v5M11.5 9v5"/>',
    lapis: '<path d="m12.5 4.5 3 3L8 15H5v-3zM11 6l3 3"/>',
    subir: '<path d="M10 16V4.5M5.5 9 10 4.5 14.5 9"/>',
    descer: '<path d="M10 4v11.5M5.5 11l4.5 4.5 4.5-4.5"/>',
    trocar: '<path d="M4 7.5h11.5M12.5 4.5l3 3-3 3M16 12.5H4.5M7.5 9.5l-3 3 3 3"/>',
    check: '<path d="m5 10.4 3.2 3.1L15 6.8"/>',
    alerta: '<circle cx="10" cy="10" r="7"/><path d="M10 6.4v4.4M10 13.6v.1"/>',
  };
  const ico = (nome, classe = '') =>
    `<svg class="qd-ico${classe ? ` ${classe}` : ''}" viewBox="0 0 20 20" aria-hidden="true" focusable="false">${ICONES[nome]}</svg>`;

  // ---------------------------------------------------------------- utilidades
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clonar = (o) => JSON.parse(JSON.stringify(o));
  const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
  const uid = (p) => `${p}${Date.now().toString(36).slice(-4)}${Math.random().toString(36).slice(2, 7)}`;
  const normalizar = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

  const pad = (n) => String(n).padStart(2, '0');
  const isoDe = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const dataDe = (iso) => { const [a, m, d] = iso.split('-').map(Number); return new Date(a, m - 1, d); };
  // AAAA-MM-DD com ano de 4 dígitos e data que existe (a volta pelo Date recusa 30/02, mês 99 e anos < 100)
  const isoOk = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && isoDe(dataDe(s)) === s;
  const hoje = () => isoDe(new Date());
  const curta = (iso) => { const d = dataDe(iso); return `${pad(d.getDate())} ${MESES[d.getMonth()]}`; };
  const longa = (iso) => { const d = dataDe(iso); return `${d.getDate()} de ${MESES_LONGOS[d.getMonth()]}`; };
  function intervalo(a, b) {
    if (a === b) return curta(a);
    const da = dataDe(a), db = dataDe(b);
    if (da.getMonth() === db.getMonth() && da.getFullYear() === db.getFullYear()) return `${pad(da.getDate())} – ${curta(b)}`;
    return `${curta(a)} – ${curta(b)}`;
  }

  // ---------------------------------------------------------------- dados de exemplo
  const TITULO_EXEMPLO = 'Festival de oficinas';
  const MAX_TITULO = 80;
  const MAX_NOME = 120;
  function exemplo() {
    const h = new Date();
    const ano = h.getFullYear(), mes = h.getMonth();
    const dia = (m, d) => isoDe(new Date(ano, m, Math.min(d, new Date(ano, m + 1, 0).getDate())));
    const a = (d) => dia(mes, d);
    const p = (d) => dia(mes + 1, d);
    const t = (id, grupo, nome, pessoa, status, inicio, fim, prazo) => ({ id, grupo, nome, pessoa, status, inicio, fim, prazo });
    return {
      titulo: TITULO_EXEMPLO,
      visao: 'tabela',
      pessoas: [
        { id: 'p1', nome: 'Lia Moura', iniciais: 'LM', avatar: 'a' },
        { id: 'p2', nome: 'Caio Teixeira', iniciais: 'CT', avatar: 'b' },
        { id: 'p3', nome: 'Bruna Sato', iniciais: 'BS', avatar: 'c' },
        { id: 'p4', nome: 'Davi Ramos', iniciais: 'DR', avatar: 'd' },
        { id: 'p5', nome: 'Iara Quintela', iniciais: 'IQ', avatar: 'e' },
      ],
      grupos: [
        { id: 'g1', nome: 'Bastidores', cor: 'azul', recolhido: false },
        { id: 'g2', nome: 'Reta final', cor: 'roxo', recolhido: false },
      ],
      tarefas: [
        t('t1', 'g1', 'Mapear entregas do trimestre', 'p1', 'feito', a(1), a(5), a(5)),
        t('t2', 'g1', 'Revisar orçamento com o financeiro', 'p2', 'andamento', a(6), a(16), a(16)),
        t('t3', 'g1', 'Montar roteiro das oficinas', 'p3', 'feito', a(3), a(9), a(9)),
        t('t4', 'g1', 'Fechar contrato de áudio e vídeo', 'p4', 'parado', a(8), a(20), a(20)),
        t('t5', 'g1', 'Testar o formulário de inscrição', 'p5', 'andamento', a(12), a(24), a(24)),
        t('t6', 'g2', 'Convidar facilitadores externos', 'p1', 'nao', p(2), p(9), p(9)),
        t('t7', 'g2', 'Preparar kit de boas-vindas', 'p3', 'nao', p(5), p(14), p(14)),
        t('t8', 'g2', 'Publicar a agenda no portal', 'p2', 'nao', p(10), p(16), p(16)),
        t('t9', 'g2', 'Ensaiar a abertura do evento', '', 'nao', p(20), p(26), p(26)),
      ],
    };
  }

  // ---------------------------------------------------------------- persistência
  const idOk = (x) => typeof x === 'string' && /^[a-z0-9_-]{1,40}$/i.test(x);
  /** Filtro que deixa passar só a 1ª ocorrência de cada id (as ações acham o item pelo id). */
  const unico = () => { const vistos = new Set(); return (x) => !vistos.has(x.id) && !!vistos.add(x.id); };
  function sanear(d) {
    if (!d || typeof d !== 'object' || !Array.isArray(d.grupos) || !Array.isArray(d.tarefas) || !Array.isArray(d.pessoas)) return null;
    const grupos = d.grupos
      .filter((g) => g && idOk(g.id) && typeof g.nome === 'string')
      .filter(unico())
      .map((g) => ({ id: g.id, nome: g.nome.slice(0, MAX_NOME) || 'Grupo', cor: CORES[g.cor] ? g.cor : 'azul', recolhido: !!g.recolhido }));
    if (!grupos.length) return null;
    let pessoas = d.pessoas
      .filter((p) => p && idOk(p.id) && typeof p.nome === 'string')
      .filter(unico())
      .map((p) => ({ id: p.id, nome: p.nome.slice(0, 60), iniciais: String(p.iniciais || p.nome).slice(0, 2).toUpperCase(), avatar: AVATARES.includes(p.avatar) ? p.avatar : 'a' }));
    if (!pessoas.length) pessoas = exemplo().pessoas;
    const idsG = new Set(grupos.map((g) => g.id));
    const idsP = new Set(pessoas.map((p) => p.id));
    const idsT = new Set();
    const tarefas = d.tarefas
      .filter((t) => t && idOk(t.id) && typeof t.nome === 'string' && idsG.has(t.grupo))
      .map((t) => {
        let inicio = isoOk(t.inicio) ? t.inicio : '';
        let fim = isoOk(t.fim) ? t.fim : '';
        if (!inicio || !fim || fim < inicio) { inicio = ''; fim = ''; }
        // id repetido: a tarefa é mantida, com um id novo
        let id = t.id;
        while (idsT.has(id)) id = uid('t');
        idsT.add(id);
        return { id, grupo: t.grupo, nome: t.nome.slice(0, MAX_NOME) || 'Tarefa', pessoa: idsP.has(t.pessoa) ? t.pessoa : '', status: ST[t.status] ? t.status : 'nao', inicio, fim, prazo: isoOk(t.prazo) ? t.prazo : '' };
      });
    const titulo = typeof d.titulo === 'string' && d.titulo.trim() ? d.titulo.slice(0, MAX_TITULO) : TITULO_EXEMPLO;
    return { titulo, visao: d.visao === 'kanban' ? 'kanban' : 'tabela', pessoas, grupos, tarefas };
  }

  function carregar() {
    try {
      const bruto = window.localStorage.getItem(CHAVE);
      return bruto ? sanear(JSON.parse(bruto)) : null;
    } catch (_) {
      return null; // storage bloqueado ou JSON inválido: segue com o exemplo
    }
  }

  function salvar() {
    dados.visao = ui.visao;
    try { window.localStorage.setItem(CHAVE, JSON.stringify(dados)); } catch (_) { /* sem storage: só em memória */ }
  }

  // ---------------------------------------------------------------- estado
  let dados = carregar() || exemplo();
  // rascunhos: texto digitado em "+ Adicionar tarefa" (por grupo), que sobrevive às re-renderizações
  const ui = { visao: dados.visao, busca: '', pessoa: '', status: '', rascunhos: {} };

  const grupo = (id) => dados.grupos.find((g) => g.id === id);
  const tarefa = (id) => dados.tarefas.find((t) => t.id === id);
  const pessoa = (id) => dados.pessoas.find((p) => p.id === id);
  const tarefasDo = (gid) => dados.tarefas.filter((t) => t.grupo === gid);
  const corGrupo = (g) => CORES[g && g.cor] || CORES.azul;
  const estiloGrupo = (g) => { const c = corGrupo(g); return `--g:${c.cor};--g-txt:${c.texto}`; };
  const atrasada = (t) => !!t.prazo && t.status !== 'feito' && t.prazo < hoje();

  const filtrando = () => !!(ui.busca.trim() || ui.pessoa || ui.status);
  function passa(t) {
    if (ui.pessoa === '-' && t.pessoa) return false;
    if (ui.pessoa && ui.pessoa !== '-' && t.pessoa !== ui.pessoa) return false;
    if (ui.status && t.status !== ui.status) return false;
    const q = normalizar(ui.busca);
    if (q) {
      const p = pessoa(t.pessoa);
      if (!normalizar(t.nome).includes(q) && !(p && normalizar(p.nome).includes(q))) return false;
    }
    return true;
  }

  function progresso(t) {
    if (t.status === 'feito') return 1;
    if (!t.inicio || !t.fim) return 0;
    const ini = dataDe(t.inicio).getTime();
    const fim = dataDe(t.fim).getTime() + 864e5; // fim inclusivo
    return Math.max(0, Math.min(1, (Date.now() - ini) / (fim - ini)));
  }

  // ---------------------------------------------------------------- elementos fixos
  const painelTabela = $('#qd-painel-tabela');
  const painelKanban = $('#qd-painel-kanban');
  const abas = $$('[role="tab"]');
  const campoBusca = $('#qd-busca');
  const selPessoa = $('#qd-f-pessoa');
  const selStatus = $('#qd-f-status');
  const info = $('#qd-filtro-info');
  const aviso = $('#qd-aviso');
  const toast = $('#qd-toast');
  const toastMsg = $('.qd-toast__msg', toast);
  const equipe = $('#qd-equipe');

  // ---------------------------------------------------------------- anúncios (aria-live)
  let avisoTimer = 0;
  function anunciar(msg) {
    clearTimeout(avisoTimer);
    aviso.textContent = '';
    avisoTimer = setTimeout(() => { aviso.textContent = msg; }, 50);
  }

  // ---------------------------------------------------------------- HTML: peças
  const htmlAvatar = (p, tam = 28) =>
    `<span class="avatar avatar--round avatar--${p.avatar}" style="--size:${tam}px" aria-hidden="true">${esc(p.iniciais)}</span>`;

  function btnPessoa(t) {
    const p = pessoa(t.pessoa);
    // o nome acessível começa pelo que se vê (iniciais), para quem usa comando de voz
    const rotulo = p ? `${p.iniciais}, responsável: ${p.nome}. Alterar` : 'Sem responsável. Definir';
    const miolo = p ? htmlAvatar(p) : `<span class="qd-sem-pessoa">${ico('usuario')}</span>`;
    return `<button type="button" class="qd-pessoa" data-acao="pessoa" data-id="${t.id}" data-k="pessoa:${t.id}" aria-haspopup="menu" aria-expanded="false" aria-label="${esc(rotulo)}" title="${esc(p ? p.nome : 'Sem responsável')}">${miolo}</button>`;
  }

  function btnCrono(t) {
    const base = `type="button" data-acao="crono" data-id="${t.id}" data-k="crono:${t.id}" aria-haspopup="dialog" aria-expanded="false"`;
    if (!t.inicio || !t.fim) {
      return `<button ${base} class="qd-crono is-vazio" aria-label="Definir datas do cronograma"><span class="qd-crono__barra"><span class="qd-crono__txt">Definir datas</span></span></button>`;
    }
    const pct = Math.round(progresso(t) * 100);
    const rotulo = `${intervalo(t.inicio, t.fim)}, cronograma: ${longa(t.inicio)} a ${longa(t.fim)}, ${pct}% concluído. Editar datas`;
    return `<button ${base} class="qd-crono" aria-label="${esc(rotulo)}" title="${esc(intervalo(t.inicio, t.fim))}"><span class="qd-crono__barra"><i style="width:${pct}%"></i><span class="qd-crono__txt">${esc(intervalo(t.inicio, t.fim))}</span></span></button>`;
  }

  function btnStatus(t) {
    const s = ST[t.status];
    return `<button type="button" class="qd-status" style="${estiloStatus(s)}" data-acao="status" data-id="${t.id}" data-k="status:${t.id}" data-status="${s.id}" aria-haspopup="menu" aria-expanded="false" aria-label="Status: ${esc(s.rotulo)}. Alterar">${esc(s.rotulo)}</button>`;
  }

  function btnPrazo(t) {
    const base = `type="button" data-acao="prazo" data-id="${t.id}" data-k="prazo:${t.id}" aria-haspopup="dialog" aria-expanded="false"`;
    if (!t.prazo) return `<button ${base} class="qd-prazo is-vazio" aria-label="Sem prazo. Definir">${ico('calendario')}</button>`;
    const late = atrasada(t);
    const marca = late
      ? `<span class="qd-prazo__marca is-atrasado" title="Atrasado">${ico('alerta')}</span>`
      : t.status === 'feito' ? `<span class="qd-prazo__marca is-ok">${ico('check')}</span>` : '';
    const rotulo = `${curta(t.prazo)}, prazo: ${longa(t.prazo)}${late ? ', atrasado' : ''}. Alterar`;
    return `<button ${base} class="qd-prazo${late ? ' is-atrasado' : ''}" aria-label="${esc(rotulo)}">${marca}<span>${curta(t.prazo)}</span></button>`;
  }

  /* Colunas de dados. Em telas estreitas o Status vem logo depois da Tarefa,
     para as cores aparecerem sem rolar a tabela. */
  const COLUNAS = {
    pessoa: { rotulo: 'Responsável', celula: btnPessoa, resumo: (r) => r.pessoas },
    crono: { rotulo: 'Cronograma', celula: btnCrono, resumo: (r) => r.crono },
    status: { rotulo: 'Status', celula: btnStatus, resumo: (r) => r.status },
    prazo: { rotulo: 'Prazo', celula: btnPrazo, resumo: (r) => r.prazo },
  };
  const mqEstreito = window.matchMedia('(max-width: 767px)');
  const ordemColunas = () => (mqEstreito.matches ? ['status', 'pessoa', 'crono', 'prazo'] : ['pessoa', 'crono', 'status', 'prazo']);

  function htmlLinha(t) {
    const nome = esc(t.nome);
    return `<tr data-id="${t.id}" draggable="true">
      <td class="qd-c-alca"><button type="button" class="qd-ibtn qd-alca" data-acao="menu-tarefa" data-id="${t.id}" data-k="alca:${t.id}" aria-haspopup="menu" aria-expanded="false" aria-label="Mover ou excluir ${nome}" aria-describedby="qd-dica-alca" title="Arraste para mover · clique para opções">${ico('alca')}</button></td>
      <th scope="row" class="qd-c-tarefa"><button type="button" class="qd-nome" data-acao="editar-nome" data-id="${t.id}" data-k="nome:${t.id}" aria-label="${nome}, editar nome"><span class="qd-nome__txt" data-txt>${nome}</span></button></th>
      ${ordemColunas().map((c) => `<td class="qd-c-${c}">${COLUNAS[c].celula(t)}</td>`).join('')}
      <td class="qd-c-fim"><button type="button" class="qd-ibtn qd-excluir" data-acao="excluir" data-id="${t.id}" data-k="excluir:${t.id}" aria-label="Excluir ${nome}" title="Excluir tarefa">${ico('lixeira')}</button></td>
    </tr>`;
  }

  function htmlResumo(g, lista) {
    const contagem = ORDEM_BATERIA.map((id) => [id, lista.filter((t) => t.status === id).length]).filter(([, n]) => n);
    const desc = contagem.length ? contagem.map(([id, n]) => `${ST[id].rotulo}: ${n}`).join(', ') : 'sem tarefas';
    const bateria = contagem
      .map(([id, n]) => `<span style="flex-grow:${n};background:${ST[id].cor}" title="${esc(ST[id].rotulo)}: ${n}"></span>`)
      .join('');
    const datas = lista.flatMap((t) => [t.inicio, t.fim]).filter(Boolean).sort();
    const prazos = lista.map((t) => t.prazo).filter(Boolean).sort();
    const ids = [...new Set(lista.map((t) => t.pessoa).filter(Boolean))];
    const pessoas = ids.map(pessoa).filter(Boolean);
    const stack = pessoas.slice(0, 3).map((p) => htmlAvatar(p, 22)).join('') + (pessoas.length > 3 ? `<span class="qd-sum-mais">+${pessoas.length - 3}</span>` : '');
    const partes = {
      pessoas: `<span class="qd-sum-pessoas" ${pessoas.length ? `role="img" aria-label="${esc(pessoas.map((p) => p.nome).join(', '))}"` : ''}>${stack}</span>`,
      crono: datas.length ? `<span class="qd-sum-crono">${esc(intervalo(datas[0], datas[datas.length - 1]))}</span>` : '',
      status: `<span class="qd-bateria" role="img" aria-label="Resumo de status: ${esc(desc)}">${bateria}</span>`,
      prazo: `<span class="qd-sum-prazo">${prazos.length ? esc(intervalo(prazos[0], prazos[prazos.length - 1])) : ''}</span>`,
    };
    const cols = ordemColunas();
    const celulas = cols.map((c, i) => {
      const extra = i === 0 ? ' qd-sum--primeira' : i === cols.length - 1 ? ' qd-sum--ultima' : '';
      return `<td class="qd-sum qd-sum--${c}${extra}">${COLUNAS[c].resumo(partes)}</td>`;
    });
    return `<tr class="qd-resumo">
      <td class="qd-c-alca"></td>
      <td class="qd-c-tarefa"><span class="sr-only">Resumo do grupo ${esc(g.nome)}</span></td>
      ${celulas.join('')}
      <td class="qd-c-fim"></td>
    </tr>`;
  }

  function htmlGrupo(g, lista, todas) {
    const nome = esc(g.nome);
    const cols = ordemColunas();
    const idT = `qd-gt-${g.id}`;
    const idB = `qd-gb-${g.id}`;
    const qtd = lista.length === todas.length ? plural(todas.length, 'tarefa', 'tarefas') : `${lista.length} de ${plural(todas.length, 'tarefa', 'tarefas')}`;
    const vazio = lista.length
      ? ''
      : `<tr class="qd-linha-vazia"><td class="qd-c-alca"></td><td class="qd-c-tarefa" colspan="6">Nenhuma tarefa neste grupo. Adicione abaixo ou arraste uma linha para cá.</td></tr>`;
    return `<div class="qd-grupo${g.recolhido ? ' is-recolhido' : ''}" style="${estiloGrupo(g)}" data-grupo="${g.id}">
      <table class="qd-tabela" aria-labelledby="${idT}">
        <colgroup><col class="qd-col-alca"><col class="qd-col-tarefa">${cols.map((c) => `<col class="qd-col-${c}">`).join('')}<col class="qd-col-fim"></colgroup>
        <thead>
          <tr>
            <td class="qd-c-alca"><button type="button" class="qd-ibtn qd-recolher" data-acao="recolher" data-id="${g.id}" data-k="recolher:${g.id}" aria-expanded="${!g.recolhido}" aria-controls="${idB}" aria-label="${g.recolhido ? 'Expandir' : 'Recolher'} grupo ${nome}">${ico('seta')}</button></td>
            <th scope="col" class="qd-c-tarefa" aria-label="Tarefas de ${nome}"><div class="qd-grupo__cab">
              <button type="button" class="qd-grupo__nome" data-acao="editar-grupo" data-id="${g.id}" data-k="gnome:${g.id}" aria-label="${nome}, renomear grupo"><span id="${idT}" data-txt>${nome}</span></button>
              <span class="qd-grupo__qtd">${qtd}</span>
              <button type="button" class="qd-ibtn qd-grupo__menu" data-acao="menu-grupo" data-id="${g.id}" data-k="gmenu:${g.id}" aria-haspopup="menu" aria-expanded="false" aria-label="Opções do grupo ${nome}">${ico('pontos')}</button>
            </div></th>
            ${cols.map((c) => `<th scope="col" class="qd-cab-col">${COLUNAS[c].rotulo}</th>`).join('')}
            <td class="qd-c-fim"></td>
          </tr>
        </thead>
        <tbody id="${idB}"${g.recolhido ? ' hidden' : ''}>
          ${lista.map(htmlLinha).join('')}${vazio}
          <tr class="qd-linha-add">
            <td class="qd-c-alca"></td>
            <td class="qd-c-tarefa"><input type="text" class="qd-add" data-add="${g.id}" data-k="add:${g.id}" value="${esc(ui.rascunhos[g.id] || '')}" placeholder="+ Adicionar tarefa" aria-label="Adicionar tarefa em ${nome}" maxlength="${MAX_NOME}" autocomplete="off" enterkeyhint="done"></td>
            <td class="qd-c-add-resto" colspan="5"></td>
          </tr>
        </tbody>
        <tfoot>${htmlResumo(g, lista)}</tfoot>
      </table>
    </div>`;
  }

  function htmlVazio() {
    return `<div class="qd-vazio">
      <svg viewBox="0 0 160 110" aria-hidden="true" focusable="false">
        <rect x="18" y="14" width="96" height="74" rx="8" fill="#fff" stroke="#c3c6d4" stroke-width="2"/>
        <path d="M18 34h96" stroke="#c3c6d4" stroke-width="2"/>
        <rect x="28" y="44" width="40" height="8" rx="4" fill="#e6e9ef"/><rect x="74" y="44" width="30" height="8" rx="2" fill="#c4f0dc"/>
        <rect x="28" y="60" width="32" height="8" rx="4" fill="#e6e9ef"/><rect x="74" y="60" width="30" height="8" rx="2" fill="#fee3bf"/>
        <circle cx="112" cy="70" r="20" fill="#f0f0ff" stroke="#6161ff" stroke-width="3"/>
        <path d="m126 85 16 16" stroke="#6161ff" stroke-width="5" stroke-linecap="round"/>
        <path d="M104 70h16" stroke="#6161ff" stroke-width="3" stroke-linecap="round"/>
      </svg>
      <p class="qd-vazio__titulo">Nenhuma tarefa por aqui</p>
      <p class="qd-vazio__texto">Nada combina com a busca e os filtros atuais. Tente outro termo ou volte a ver o quadro inteiro.</p>
      <button type="button" class="qd-btn qd-btn--contorno" data-acao="limpar-filtros" data-k="limpar-vazio">Limpar filtros</button>
    </div>`;
  }

  function htmlTabela() {
    const partes = [];
    let total = 0;
    for (const g of dados.grupos) {
      const todas = tarefasDo(g.id);
      const lista = todas.filter(passa);
      if (filtrando() && !lista.length) continue;
      total += lista.length;
      partes.push(htmlGrupo(g, lista, todas));
    }
    if (filtrando() && !total) return htmlVazio();
    return `<div class="qd-rolagem-moldura"><div class="qd-rolagem" data-rolagem>${partes.join('')}</div></div>
      <button type="button" class="qd-btn qd-btn--contorno qd-novo-grupo" data-acao="novo-grupo" data-k="novo-grupo">${ico('mais')}Novo grupo</button>`;
  }

  function htmlCard(t) {
    const g = grupo(t.grupo);
    const p = pessoa(t.pessoa);
    const nome = esc(t.nome);
    const late = atrasada(t);
    return `<li class="qd-card" data-id="${t.id}" draggable="true" style="${estiloGrupo(g)}">
      <p class="qd-card__grupo"><span class="qd-card__ponto" aria-hidden="true"></span><span class="sr-only">Grupo: </span><span class="qd-card__gnome" title="${esc(g.nome)}">${esc(g.nome)}</span></p>
      <button type="button" class="qd-card__nome" data-acao="editar-nome" data-id="${t.id}" data-k="nome:${t.id}" aria-label="${nome}, editar nome"><span data-txt>${nome}</span></button>
      <div class="qd-card__meta">
        ${p ? `${htmlAvatar(p, 24)}<span class="qd-card__pessoa">${esc(p.nome)}</span>` : '<span class="qd-card__pessoa is-vazio">Sem responsável</span>'}
        ${t.prazo ? `<span class="qd-card__prazo${late ? ' is-atrasado' : ''}">${ico(late ? 'alerta' : 'calendario')}<span class="sr-only">Prazo: </span>${curta(t.prazo)}${late ? '<span class="sr-only"> (atrasado)</span>' : ''}</span>` : ''}
        <button type="button" class="qd-ibtn qd-card__mover" data-acao="mover-card" data-id="${t.id}" data-k="mover:${t.id}" aria-haspopup="menu" aria-expanded="false" aria-label="Mover ${nome} para outra coluna" aria-describedby="qd-dica-card" title="Mover para outra coluna">${ico('trocar')}</button>
      </div>
    </li>`;
  }

  function htmlKanban() {
    const lista = dados.tarefas.filter(passa);
    if (filtrando() && !lista.length) return htmlVazio();
    const colunas = STATUS.map((s) => {
      const cards = lista.filter((t) => t.status === s.id);
      return `<div class="qd-coluna" role="group" aria-labelledby="qd-kc-${s.id}" data-drop-status="${s.id}" style="${estiloStatus(s)}">
        <div class="qd-coluna__cab"><h4 class="qd-coluna__titulo" id="qd-kc-${s.id}">${esc(s.rotulo)}</h4><span class="qd-coluna__qtd">${cards.length}<span class="sr-only"> ${cards.length === 1 ? 'tarefa' : 'tarefas'}</span></span></div>
        <ul class="qd-coluna__lista">${cards.map(htmlCard).join('') || '<li class="qd-coluna__vazia">Solte um cartão aqui</li>'}</ul>
        <button type="button" class="qd-coluna__add" data-acao="nova-tarefa-status" data-status="${s.id}" data-k="kadd:${s.id}" aria-label="Nova tarefa com status ${esc(s.rotulo)}">${ico('mais')}Nova tarefa</button>
      </div>`;
    });
    return `<div class="qd-kanban" data-rolagem-k>${colunas.join('')}</div>`;
  }

  // ---------------------------------------------------------------- renderização
  const painelAtual = () => (ui.visao === 'kanban' ? painelKanban : painelTabela);
  const focarPainel = () => painelAtual().focus({ preventScroll: true });

  function renderTitulo() {
    const b = $('.qd-titulo-btn');
    if (!b) return;
    b.textContent = dados.titulo;
    b.setAttribute('aria-label', `${dados.titulo}, editar título do quadro`);
  }

  function renderEquipe() {
    const ps = dados.pessoas;
    equipe.innerHTML = `<span class="avatar-stack" role="img" aria-label="Equipe do quadro: ${esc(ps.map((p) => p.nome).join(', '))}">${ps.map((p) => htmlAvatar(p, 30)).join('')}</span><span class="qd-equipe__txt" aria-hidden="true">${plural(ps.length, 'pessoa', 'pessoas')}</span>`;
  }

  function preencherPessoas() {
    const atual = selPessoa.value;
    selPessoa.innerHTML = `<option value="">Pessoa: todas</option>${dados.pessoas.map((p) => `<option value="${esc(p.id)}">${esc(p.nome)}</option>`).join('')}<option value="-">Sem responsável</option>`;
    selPessoa.value = atual === '-' || dados.pessoas.some((p) => p.id === atual) ? atual : '';
  }

  function sincronizarFiltros() {
    campoBusca.value = ui.busca;
    selPessoa.value = ui.pessoa;
    selStatus.value = ui.status;
    [campoBusca, selPessoa, selStatus].forEach((el) => el.classList.toggle('is-ativo', !!el.value));
  }

  function renderInfo() {
    if (!filtrando()) { info.hidden = true; info.innerHTML = ''; return; }
    const n = dados.tarefas.filter(passa).length;
    info.hidden = false;
    info.innerHTML = `<span>Mostrando <strong>${n}</strong> de ${plural(dados.tarefas.length, 'tarefa', 'tarefas')}</span><button type="button" class="qd-link" data-acao="limpar-filtros" data-k="limpar-info">Limpar filtros</button>`;
  }

  function sincronizarAbas() {
    abas.forEach((a) => {
      const sel = a.dataset.visao === ui.visao;
      a.setAttribute('aria-selected', String(sel));
      a.tabIndex = sel ? 0 : -1;
    });
  }

  /** Re-renderiza a visão atual a partir do estado. Mantém o foco no controle
      equivalente (data-k) e a rolagem horizontal; op.foco força o alvo. */
  function render(op = {}) {
    renderPendente = false;
    const ativo = document.activeElement;
    const ativoDentro = !!ativo && ativo !== document.body && raiz.contains(ativo);
    const explicito = 'foco' in op;
    const chave = explicito ? op.foco : ativoDentro ? ativo.getAttribute('data-k') : null;
    // cursor de um campo de texto focado (ex.: rascunho em "+ Adicionar tarefa")
    const cursor = ativoDentro && ativo.matches('input.qd-add') ? [ativo.selectionStart, ativo.selectionEnd] : null;
    const rol = $('[data-rolagem]');
    const rolX = rol ? rol.scrollLeft : 0;
    const kan = $('[data-rolagem-k]');
    const kanX = kan ? kan.scrollLeft : 0;

    sincronizarAbas();
    if (ui.visao === 'tabela') {
      painelTabela.innerHTML = htmlTabela();
      painelKanban.innerHTML = '';
    } else {
      painelKanban.innerHTML = htmlKanban();
      painelTabela.innerHTML = '';
    }
    painelTabela.hidden = ui.visao !== 'tabela';
    painelKanban.hidden = ui.visao !== 'kanban';
    const rol2 = $('[data-rolagem]');
    if (rol2) rol2.scrollLeft = rolX;
    const kan2 = $('[data-rolagem-k]');
    if (kan2) kan2.scrollLeft = kanX;
    renderInfo();

    let alvo = porChave(chave);
    if (!alvo && op.reserva) for (const k of op.reserva) { alvo = porChave(k); if (alvo) break; }
    if (alvo) {
      alvo.focus({ preventScroll: !explicito });
      if (cursor && alvo.matches('input.qd-add') && !explicito) { try { alvo.setSelectionRange(cursor[0], cursor[1]); } catch (_) { /* ignora */ } }
    } else if ((!document.activeElement || document.activeElement === document.body) && (ativoDentro || (explicito && op.foco))) focarPainel();

    // popover aberto cujo gatilho foi recriado: liga-o ao gatilho novo
    if (pop && !pop.gatilho.isConnected) {
      const g = porChave(pop.chave);
      if (g) {
        pop.gatilho = g;
        g.setAttribute('aria-expanded', 'true');
        g.setAttribute('aria-controls', 'qd-pop');
        posicionar();
      } else fecharPop(false);
    }
    atualizarRolagem();
  }

  /* Re-render adiado: espera terminar o gesto em curso (clique, toque, arraste) e a
     edição inline aberta, para não trocar o elemento sob o ponteiro nem fechar o editor. */
  let renderPendente = false;
  let ponteiroBaixo = false;
  function agendarRender() {
    renderPendente = true;
    setTimeout(talvezRender, 0);
  }
  function talvezRender() {
    if (!renderPendente || ponteiroBaixo || arrastando || raiz.querySelector('.qd-edit')) return;
    render();
  }
  document.addEventListener('pointerdown', () => { ponteiroBaixo = true; }, true);
  const soltouPonteiro = () => { ponteiroBaixo = false; setTimeout(talvezRender, 0); };
  document.addEventListener('pointerup', soltouPonteiro, true);
  document.addEventListener('pointercancel', soltouPonteiro, true);
  window.addEventListener('blur', soltouPonteiro); // botão solto fora da janela
  mqEstreito.addEventListener('change', agendarRender);

  // sombras que indicam rolagem horizontal da tabela (borda direita e coluna fixa)
  function atualizarRolagem() {
    const rol = $('[data-rolagem]');
    if (!rol) return;
    const resto = rol.scrollWidth - rol.clientWidth - rol.scrollLeft;
    rol.classList.toggle('is-rolada', rol.scrollLeft > 1);
    if (rol.parentElement) rol.parentElement.classList.toggle('is-mais', resto > 1);
  }

  // ---------------------------------------------------------------- desfazer
  /* Pilha de ações reversíveis (exclusões e "Restaurar exemplo"). Cada entrada sabe
     se desfazer sozinha: reinsere só o que saiu, sem voltar o resto do quadro no tempo.
     O aviso some depois de alguns segundos, mas Ctrl+Z continua valendo enquanto a
     página estiver aberta (sem limite de tempo para quem navega pelo teclado). */
  const pilha = [];
  const MAX_PILHA = 30;
  let lote = 0; // ações feitas com o mesmo aviso aberto
  let toastTimer = 0;
  function armarToast() {
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      if (toast.contains(document.activeElement) || toast.matches(':hover')) armarToast();
      else esconderToast();
    }, 10000);
  }
  function mostrarToast(msg) {
    toastMsg.textContent = msg;
    toast.hidden = false;
    armarToast();
  }
  function registrarDesfazer(acao) {
    if (toast.hidden) lote += 1;
    pilha.push({ ...acao, lote });
    if (pilha.length > MAX_PILHA) pilha.shift();
    mostrarToast(acao.msg);
    anunciar(`${acao.msg} Para reverter, use Desfazer ou Ctrl+Z.`);
  }
  function esconderToast() {
    clearTimeout(toastTimer);
    const tinhaFoco = toast.contains(document.activeElement);
    toast.hidden = true;
    if (tinhaFoco) focarPainel();
  }
  function desfazer() {
    const acao = pilha.pop();
    if (!acao) { anunciar('Não há nada para desfazer'); return; }
    const aberto = !toast.hidden;
    const r = acao.desfazer() || {};
    salvar();
    preencherPessoas();
    renderTitulo();
    renderEquipe();
    // a ação anterior do mesmo lote continua à mão no aviso
    const anterior = pilha[pilha.length - 1];
    const seguir = aberto && anterior && anterior.lote === acao.lote;
    if (seguir) mostrarToast(anterior.msg);
    else { clearTimeout(toastTimer); toast.hidden = true; }
    render({ foco: r.foco || null, reserva: r.reserva });
    anunciar(`Desfeito: ${r.msg || 'ação revertida'}.${seguir ? ` Ainda dá para desfazer: ${anterior.msg}` : ''}`);
  }

  // ---------------------------------------------------------------- popovers
  let pop = null;
  const SEP = '<div role="separator" class="qd-menu-sep"></div>';
  const itemMenu = (op, texto, icone, { desativado = false, perigo = false } = {}) =>
    `<button type="button" role="menuitem" tabindex="-1" class="qd-menu-item${perigo ? ' is-perigo' : ''}" data-op="${esc(op)}"${desativado ? ' aria-disabled="true"' : ''}>${ico(icone)}<span>${esc(texto)}</span></button>`;

  function posicionar() {
    if (!pop || !pop.gatilho.isConnected) return;
    const { el, gatilho } = pop;
    const r = gatilho.getBoundingClientRect();
    const base = raiz.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    let x = pop.alinhar === 'inicio' ? r.left - 4 : r.left + r.width / 2 - w / 2;
    x = Math.max(8, Math.min(x, vw - w - 8));
    let y = r.bottom + 6;
    if (y + h > window.innerHeight - 8 && r.top - h - 6 > 8) y = r.top - h - 6;
    el.style.left = `${Math.round(x - base.left)}px`;
    el.style.top = `${Math.round(y - base.top)}px`;
  }

  function abrirPop(gatilho, { html, tipo = 'menu', rotulo = '', rotuloId = '', classe = '', aoAcao, focar = '', alinhar = 'centro' }) {
    fecharPop(false);
    const el = document.createElement('div');
    el.className = `qd-pop ${classe}`.trim();
    el.id = 'qd-pop';
    el.setAttribute('role', tipo);
    if (rotuloId) el.setAttribute('aria-labelledby', rotuloId);
    else if (rotulo) el.setAttribute('aria-label', rotulo);
    el.tabIndex = -1;
    // diálogos: sentinelas nas pontas prendem o Tab e o Shift+Tab, inclusive a partir
    // de um segmento do campo de data ou do rádio marcado (o teclado não sai do diálogo)
    el.innerHTML = tipo === 'dialog'
      ? `<span class="qd-guarda" tabindex="0" data-guarda="inicio"></span>${html}<span class="qd-guarda" tabindex="0" data-guarda="fim"></span>`
      : html;
    raiz.appendChild(el);
    if (tipo === 'dialog') {
      el.addEventListener('focusin', (e) => {
        const lado = e.target.dataset && e.target.dataset.guarda;
        if (!lado) return;
        const foc = tabulaveis(el);
        const alvo = lado === 'inicio' ? foc[foc.length - 1] : foc[0];
        (alvo || el).focus();
      });
    }
    gatilho.setAttribute('aria-expanded', 'true');
    gatilho.setAttribute('aria-controls', 'qd-pop');
    pop = { el, gatilho, chave: gatilho.getAttribute('data-k'), tipo, alinhar };
    posicionar();
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-op]');
      if (!b || b.disabled || b.getAttribute('aria-disabled') === 'true') return;
      e.stopPropagation();
      if (aoAcao) aoAcao(b.dataset.op, b, el);
    });
    el.addEventListener('keydown', teclaPop);
    const alvo = (focar && el.querySelector(focar))
      || el.querySelector('[role^="menuitem"][aria-checked="true"]')
      || el.querySelector('[role^="menuitem"]:not([aria-disabled="true"])')
      || el.querySelector('input, select, button')
      || el;
    alvo.focus({ preventScroll: true });
    return el;
  }

  /** Elementos que o Tab visita dentro do popover (um só rádio por grupo). */
  function tabulaveis(el) {
    return $$('input, select, button, [tabindex]', el).filter((x) => {
      if (x.disabled || x.tabIndex < 0 || x.dataset.guarda || x.offsetParent === null) return false;
      if (x.type === 'radio') {
        const marcado = el.querySelector(`input[type="radio"][name="${CSS.escape(x.name)}"]:checked`);
        return marcado ? marcado === x : el.querySelector(`input[type="radio"][name="${CSS.escape(x.name)}"]`) === x;
      }
      return true;
    });
  }

  function fecharPop(devolverFoco) {
    if (!pop) return;
    const { el, gatilho, chave } = pop;
    pop = null;
    el.remove();
    const g = gatilho.isConnected ? gatilho : porChave(chave);
    if (!g) return;
    g.setAttribute('aria-expanded', 'false');
    g.removeAttribute('aria-controls');
    if (devolverFoco) g.focus({ preventScroll: true });
  }

  function teclaPop(e) {
    if (!pop) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); fecharPop(true); return; }
    if (pop.tipo === 'menu') {
      const itens = $$('[role^="menuitem"]', pop.el);
      const i = itens.indexOf(document.activeElement);
      let n = null;
      if (e.key === 'ArrowDown') n = (i + 1) % itens.length;
      else if (e.key === 'ArrowUp') n = (i - 1 + itens.length) % itens.length;
      else if (e.key === 'Home') n = 0;
      else if (e.key === 'End') n = itens.length - 1;
      else if (e.key === 'Tab') { fecharPop(true); return; } // o Tab segue a partir do gatilho
      if (n !== null && itens[n]) { e.preventDefault(); itens[n].focus(); }
    }
    // diálogos: o Tab é preso pelas sentinelas (.qd-guarda)
  }

  // clique fora fecha e devolve o foco ao gatilho (se o clique não levou o foco a outro controle)
  document.addEventListener('pointerdown', (e) => {
    if (!pop || pop.el.contains(e.target) || pop.gatilho.contains(e.target)) return;
    const { gatilho, chave } = pop;
    fecharPop(false);
    setTimeout(() => {
      const a = document.activeElement;
      if (!a || a === document.body) {
        const g = gatilho.isConnected ? gatilho : porChave(chave);
        if (g) g.focus({ preventScroll: true });
      }
    }, 0);
  }, true);
  document.addEventListener('focusin', (e) => {
    if (pop && !pop.el.contains(e.target) && e.target !== pop.gatilho) fecharPop(false);
  });
  window.addEventListener('resize', posicionar);
  raiz.addEventListener('scroll', (e) => { if (pop && !pop.el.contains(e.target)) posicionar(); }, true);

  // ---- status
  function abrirStatus(gatilho, id, kanban) {
    const t = tarefa(id);
    if (!t) return;
    const html = STATUS.map((s) => `<button type="button" role="menuitemradio" tabindex="-1" aria-checked="${s.id === t.status}" class="qd-op-status" style="${estiloStatus(s)}" data-op="${s.id}">${esc(s.rotulo)}${ico('check', 'qd-check')}</button>`).join('');
    abrirPop(gatilho, {
      html,
      rotulo: kanban ? `Mover “${t.nome}” para a coluna` : `Status de “${t.nome}”`,
      classe: 'qd-pop--status',
      aoAcao: (op) => { fecharPop(true); definirStatus(id, op); },
    });
  }

  function definirStatus(id, st) {
    const t = tarefa(id);
    if (!t || !ST[st]) return;
    const mudou = t.status !== st;
    t.status = st;
    if (mudou) salvar();
    render({ foco: ui.visao === 'kanban' ? `mover:${id}` : `status:${id}` });
    anunciar(mudou ? `Status alterado para ${ST[st].rotulo}` : `Status mantido: ${ST[st].rotulo}`);
  }

  // ---- responsável
  function abrirPessoa(gatilho, id) {
    const t = tarefa(id);
    if (!t) return;
    const itens = dados.pessoas.map((p) => `<button type="button" role="menuitemradio" tabindex="-1" aria-checked="${t.pessoa === p.id}" class="qd-menu-item" data-op="${esc(p.id)}">${htmlAvatar(p, 26)}<span>${esc(p.nome)}</span>${ico('check', 'qd-check')}</button>`).join('');
    const nenhum = `<button type="button" role="menuitemradio" tabindex="-1" aria-checked="${!t.pessoa}" class="qd-menu-item" data-op="-"><span class="qd-sem-pessoa qd-sem-pessoa--mini">${ico('usuario')}</span><span>Sem responsável</span>${ico('check', 'qd-check')}</button>`;
    abrirPop(gatilho, {
      html: `<p class="qd-menu-rotulo" aria-hidden="true">Responsável</p>${itens}${SEP}${nenhum}`,
      rotulo: `Responsável por “${t.nome}”`,
      classe: 'qd-pop--menu',
      aoAcao: (op) => { fecharPop(true); definirPessoa(id, op === '-' ? '' : op); },
    });
  }

  function definirPessoa(id, pid) {
    const t = tarefa(id);
    if (!t) return;
    t.pessoa = pid;
    salvar();
    render({ foco: `pessoa:${id}` });
    const p = pessoa(pid);
    anunciar(p ? `Responsável alterado para ${p.nome}` : 'Responsável removido');
  }

  // ---- datas (cronograma e prazo)
  const DATA_MIN = '1900-01-01';
  const DATA_MAX = '9999-12-31';
  /** Mensagem de erro para um input date (ano fora de 4 dígitos, data incompleta ou ausente). */
  function problemaData(input, de, final) {
    if (input.value && !isoOk(input.value)) return `Data ${de} inválida: use um ano com 4 dígitos.`;
    if (input.value && input.value < DATA_MIN) return `Data ${de} inválida: use um ano a partir de 1900.`;
    if (final && !input.value && input.validity && input.validity.badInput) return `Complete a data ${de} (dia, mês e ano).`;
    return '';
  }

  function dialogoDatas({ titulo, sub, campos, limpar = true }) {
    return `<form class="qd-pop__form" novalidate>
      <p class="qd-pop__titulo" id="qd-pop-titulo">${esc(titulo)}</p>
      <p class="qd-pop__sub">${esc(sub)}</p>
      <div class="qd-pop__campos${campos.length === 1 ? ' is-um' : ''}">${campos.join('')}</div>
      <p class="qd-pop__erro" id="qd-pop-erro" role="alert"></p>
      <div class="qd-pop__acoes">
        ${limpar ? '<button type="button" class="qd-btn qd-btn--sutil" data-op="limpar">Limpar</button>' : ''}
        <span class="qd-pop__espaco"></span>
        <button type="button" class="qd-btn qd-btn--sutil" data-op="cancelar">Cancelar</button>
        <button type="submit" class="qd-btn qd-btn--primario">Salvar</button>
      </div>
    </form>`;
  }

  function abrirCrono(gatilho, id) {
    const t = tarefa(id);
    if (!t) return;
    const html = dialogoDatas({
      titulo: 'Cronograma',
      sub: t.nome,
      campos: [
        `<label class="qd-campo"><span>Início</span><input type="date" name="inicio" value="${t.inicio}" min="${DATA_MIN}" max="${DATA_MAX}" aria-describedby="qd-pop-erro"></label>`,
        `<label class="qd-campo"><span>Fim</span><input type="date" name="fim" value="${t.fim}" min="${t.inicio || DATA_MIN}" max="${DATA_MAX}" aria-describedby="qd-pop-erro"></label>`,
      ],
    });
    const el = abrirPop(gatilho, {
      html, tipo: 'dialog', rotuloId: 'qd-pop-titulo', classe: 'qd-pop--dialogo',
      aoAcao: (op) => {
        if (op === 'cancelar') fecharPop(true);
        else if (op === 'limpar') { fecharPop(true); definirCrono(id, '', ''); }
      },
    });
    const form = $('form', el);
    const ini = form.elements.inicio;
    const fim = form.elements.fim;
    const erro = $('.qd-pop__erro', el);
    const salvarBtn = $('[type="submit"]', form);
    const validar = (final) => {
      let msg = '';
      let campo = null;
      let travar = false; // erro que só se resolve mudando a data: desativa Salvar
      const mi = problemaData(ini, 'de início', final);
      const mf = problemaData(fim, 'de fim', final);
      if (mi) { msg = mi; campo = ini; travar = !!ini.value; }
      else if (mf) { msg = mf; campo = fim; travar = !!fim.value; }
      else if (ini.value && fim.value && fim.value < ini.value) { msg = 'O fim precisa ser no mesmo dia ou depois do início.'; campo = fim; travar = true; }
      else if (final && !ini.value) { msg = 'Escolha a data de início (ou use Limpar).'; campo = ini; }
      else if (final && !fim.value) { msg = 'Escolha a data de fim (ou use Limpar).'; campo = fim; }
      erro.textContent = msg;
      ini.setAttribute('aria-invalid', String(campo === ini));
      fim.setAttribute('aria-invalid', String(campo === fim));
      salvarBtn.disabled = travar;
      return { ok: !msg, campo };
    };
    ini.addEventListener('input', () => { fim.min = isoOk(ini.value) ? ini.value : DATA_MIN; validar(false); });
    fim.addEventListener('input', () => validar(false));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const { ok, campo } = validar(true);
      if (!ok) { if (campo) campo.focus(); return; }
      fecharPop(true);
      definirCrono(id, ini.value, fim.value);
    });
  }

  function definirCrono(id, inicio, fim) {
    const t = tarefa(id);
    if (!t) return;
    t.inicio = inicio;
    t.fim = fim;
    salvar();
    render({ foco: `crono:${id}` });
    anunciar(inicio ? `Cronograma definido: ${longa(inicio)} a ${longa(fim)}` : 'Datas do cronograma removidas');
  }

  function abrirPrazo(gatilho, id) {
    const t = tarefa(id);
    if (!t) return;
    const html = dialogoDatas({
      titulo: 'Prazo',
      sub: t.nome,
      campos: [`<label class="qd-campo"><span>Entregar até</span><input type="date" name="prazo" value="${t.prazo}" min="${DATA_MIN}" max="${DATA_MAX}" aria-describedby="qd-pop-erro"></label>`],
    });
    const el = abrirPop(gatilho, {
      html, tipo: 'dialog', rotuloId: 'qd-pop-titulo', classe: 'qd-pop--dialogo qd-pop--prazo',
      aoAcao: (op) => {
        if (op === 'cancelar') fecharPop(true);
        else if (op === 'limpar') { fecharPop(true); definirPrazo(id, ''); }
      },
    });
    const form = $('form', el);
    const campo = form.elements.prazo;
    const erro = $('.qd-pop__erro', el);
    const salvarBtn = $('[type="submit"]', form);
    const validar = (final) => {
      const msg = problemaData(campo, 'do prazo', final) || (final && !campo.value ? 'Escolha uma data (ou use Limpar).' : '');
      erro.textContent = msg;
      campo.setAttribute('aria-invalid', String(!!msg));
      salvarBtn.disabled = !!msg && !!campo.value;
      return !msg;
    };
    campo.addEventListener('input', () => validar(false));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!validar(true)) { campo.focus(); return; }
      fecharPop(true);
      definirPrazo(id, campo.value);
    });
  }

  function definirPrazo(id, prazo) {
    const t = tarefa(id);
    if (!t) return;
    t.prazo = prazo;
    salvar();
    render({ foco: `prazo:${id}` });
    anunciar(prazo ? `Prazo definido para ${longa(prazo)}` : 'Prazo removido');
  }

  // ---- menu da tarefa (alternativa de teclado ao arrastar)
  function abrirMenuTarefa(gatilho, id) {
    const t = tarefa(id);
    if (!t) return;
    const irmas = tarefasDo(t.grupo).filter(passa); // só as visíveis: a mesma ordem que se vê
    const i = irmas.indexOf(t);
    const outros = dados.grupos.filter((g) => g.id !== t.grupo);
    let html = itemMenu('renomear', 'Editar nome', 'lapis')
      + itemMenu('cima', 'Mover para cima', 'subir', { desativado: i <= 0 })
      + itemMenu('baixo', 'Mover para baixo', 'descer', { desativado: i >= irmas.length - 1 });
    if (outros.length) {
      html += `${SEP}<div role="group" aria-labelledby="qd-pop-grupos"><p class="qd-menu-rotulo" id="qd-pop-grupos">Mover para o grupo</p>${outros
        .map((g) => `<button type="button" role="menuitem" tabindex="-1" class="qd-menu-item" data-op="grupo:${esc(g.id)}" style="${estiloGrupo(g)}" aria-label="Mover para o grupo ${esc(g.nome)}"><span class="qd-ponto" aria-hidden="true"></span><span>${esc(g.nome)}</span></button>`)
        .join('')}</div>`;
    }
    html += SEP + itemMenu('excluir', 'Excluir tarefa', 'lixeira', { perigo: true });
    abrirPop(gatilho, {
      html,
      rotulo: `Ações de “${t.nome}”`,
      classe: 'qd-pop--menu',
      alinhar: 'inicio',
      aoAcao: (op) => {
        fecharPop(false);
        if (op === 'renomear') { const b = porChave(`nome:${id}`); if (b) editarNome(b, id); }
        else if (op === 'cima' || op === 'baixo') moverRelativo(id, op === 'cima' ? -1 : 1);
        else if (op.startsWith('grupo:')) moverTarefa(id, op.slice(6), {}, `alca:${id}`);
        else if (op === 'excluir') excluirTarefa(id, 'alca');
      },
    });
  }

  // ---- menu do grupo
  function abrirMenuGrupo(gatilho, gid) {
    const g = grupo(gid);
    if (!g) return;
    const unico = dados.grupos.length <= 1;
    const html = itemMenu('renomear', 'Renomear grupo', 'lapis')
      + itemMenu('recolher', g.recolhido ? 'Expandir grupo' : 'Recolher grupo', 'seta')
      + itemMenu('adicionar', 'Adicionar tarefa', 'mais')
      + SEP
      + itemMenu('excluir', unico ? 'Excluir grupo (é o único)' : 'Excluir grupo…', 'lixeira', { desativado: unico, perigo: true });
    abrirPop(gatilho, {
      html,
      rotulo: `Opções do grupo ${g.nome}`,
      classe: 'qd-pop--menu',
      alinhar: 'inicio',
      aoAcao: (op) => {
        if (op === 'excluir') { pedirExcluirGrupo(gatilho, gid); return; }
        fecharPop(false);
        if (op === 'renomear') { const b = porChave(`gnome:${gid}`); if (b) editarGrupo(b, gid); }
        else if (op === 'recolher') alternarGrupo(gid, `gmenu:${gid}`);
        else if (op === 'adicionar') { g.recolhido = false; salvar(); render({ foco: `add:${gid}` }); }
      },
    });
  }

  function pedirExcluirGrupo(gatilho, gid) {
    const g = grupo(gid);
    if (!g || dados.grupos.length <= 1) return;
    const n = tarefasDo(gid).length;
    if (!n) { fecharPop(false); excluirGrupo(gid, null); return; }
    const outros = dados.grupos.filter((x) => x.id !== gid);
    const html = `<p class="qd-pop__titulo" id="qd-pop-titulo">Excluir “${esc(g.nome)}”?</p>
      <p class="qd-pop__texto">O grupo tem ${plural(n, 'tarefa', 'tarefas')}. O que fazer com ${n === 1 ? 'ela' : 'elas'}?</p>
      <fieldset class="qd-pop__opcoes">
        <legend class="sr-only">Destino das tarefas</legend>
        <label class="qd-radio"><input type="radio" name="destino" value="mover" checked><span>Mover para</span></label>
        <select class="qd-select qd-select--mini" name="grupo-destino" aria-label="Grupo de destino">${outros.map((o) => `<option value="${esc(o.id)}">${esc(o.nome)}</option>`).join('')}</select>
        <label class="qd-radio"><input type="radio" name="destino" value="apagar"><span>Excluir as tarefas também</span></label>
      </fieldset>
      <div class="qd-pop__acoes"><span class="qd-pop__espaco"></span>
        <button type="button" class="qd-btn qd-btn--sutil" data-op="cancelar">Cancelar</button>
        <button type="button" class="qd-btn qd-btn--perigo" data-op="confirmar">Excluir grupo</button>
      </div>`;
    const el = abrirPop(gatilho, {
      html, tipo: 'dialog', rotuloId: 'qd-pop-titulo', classe: 'qd-pop--dialogo', focar: '[data-op="cancelar"]',
      aoAcao: (op, _b, caixa) => {
        if (op === 'cancelar') { fecharPop(true); return; }
        const modo = $('[name="destino"]:checked', caixa).value;
        const destino = $('[name="grupo-destino"]', caixa).value;
        fecharPop(false);
        excluirGrupo(gid, modo === 'mover' ? destino : 'apagar');
      },
    });
    const sel = $('[name="grupo-destino"]', el);
    const radios = $$('[name="destino"]', el);
    radios.forEach((r) => r.addEventListener('change', () => { sel.disabled = radios[1].checked; }));
    sel.addEventListener('focus', () => { radios[0].checked = true; sel.disabled = false; });
  }

  // ---------------------------------------------------------------- edição inline
  function editarInline(botao, { valor, rotulo, classe = '', max = MAX_NOME, aoSalvar, aoTerminar }) {
    if (!botao || !botao.isConnected) return;
    fecharPop(false);
    const input = document.createElement('input');
    input.type = 'text';
    input.className = `qd-edit ${classe}`.trim();
    input.value = valor;
    input.maxLength = max; // o mesmo limite que é gravado: nada é cortado em silêncio
    input.autocomplete = 'off';
    input.setAttribute('aria-label', rotulo);
    const arrastavel = botao.closest('[draggable="true"]');
    if (arrastavel) arrastavel.draggable = false;
    botao.replaceWith(input);
    input.focus();
    input.select();
    let encerrado = false;
    const terminar = (salvarValor, viaTeclado) => {
      if (encerrado) return;
      encerrado = true;
      const novo = input.value.replace(/\s+/g, ' ').trim();
      const mudou = salvarValor && !!novo && novo !== valor;
      if (mudou) aoSalvar(novo);
      if (input.isConnected) input.replaceWith(botao);
      if (arrastavel) arrastavel.draggable = true;
      aoTerminar({ mudou, novo: mudou ? novo : valor, viaTeclado, botao });
      setTimeout(talvezRender, 0); // re-render que ficou esperando o fim da edição
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); terminar(true, true); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); terminar(false, true); }
    });
    // no blur: salva e atualiza o botão na hora; o re-render completo (rótulos, filtro,
    // contagem) espera o fim do clique/Tab que causou o blur, para não engolir esse clique
    input.addEventListener('blur', () => terminar(true, false));
  }

  function editarNome(botao, id) {
    const t = tarefa(id);
    if (!t) return;
    editarInline(botao, {
      valor: t.nome,
      rotulo: 'Nome da tarefa',
      classe: 'qd-edit--nome',
      aoSalvar: (novo) => { t.nome = novo.slice(0, MAX_NOME); salvar(); },
      aoTerminar: ({ mudou, novo, viaTeclado, botao: b }) => {
        const txt = b.querySelector('[data-txt]') || b;
        txt.textContent = novo;
        b.setAttribute('aria-label', `${novo}, editar nome`);
        if (viaTeclado) { if (mudou) render({ foco: b.dataset.k }); else b.focus(); }
        else if (mudou) agendarRender();
        if (mudou) anunciar(`Tarefa renomeada para “${novo}”`);
      },
    });
  }

  function editarGrupo(botao, gid) {
    const g = grupo(gid);
    if (!g) return;
    editarInline(botao, {
      valor: g.nome,
      rotulo: 'Nome do grupo',
      classe: 'qd-edit--grupo',
      aoSalvar: (novo) => { g.nome = novo.slice(0, MAX_NOME); salvar(); },
      aoTerminar: ({ mudou, novo, viaTeclado, botao: b }) => {
        const txt = b.querySelector('[data-txt]') || b;
        txt.textContent = novo;
        b.setAttribute('aria-label', `${novo}, renomear grupo`);
        if (viaTeclado) { if (mudou) render({ foco: b.dataset.k }); else b.focus(); }
        else if (mudou) agendarRender();
        if (mudou) anunciar(`Grupo renomeado para “${novo}”`);
      },
    });
  }

  function editarTitulo(botao) {
    editarInline(botao, {
      valor: dados.titulo,
      rotulo: 'Título do quadro',
      classe: 'qd-edit--titulo',
      max: MAX_TITULO,
      aoSalvar: (novo) => { dados.titulo = novo.slice(0, MAX_TITULO); salvar(); },
      aoTerminar: ({ mudou, viaTeclado, botao: b }) => {
        renderTitulo();
        if (viaTeclado) b.focus();
        if (mudou) anunciar(`Título do quadro alterado para “${dados.titulo}”`);
      },
    });
  }

  // ---------------------------------------------------------------- ações
  function garantirVisivel(t) {
    if (passa(t)) return false;
    ui.busca = ''; ui.pessoa = ''; ui.status = '';
    sincronizarFiltros();
    return true;
  }

  function novaTarefaBase(g, extras = {}) {
    return {
      id: uid('t'),
      grupo: g.id,
      nome: 'Nova tarefa',
      pessoa: ui.pessoa && ui.pessoa !== '-' ? ui.pessoa : '',
      status: ui.status || 'nao',
      inicio: '', fim: '', prazo: '',
      ...extras,
    };
  }

  function novaTarefa({ status = '' } = {}) {
    const g = dados.grupos[0];
    const t = novaTarefaBase(g, status ? { status } : {});
    const idx = dados.tarefas.findIndex((x) => x.grupo === g.id);
    dados.tarefas.splice(idx === -1 ? dados.tarefas.length : idx, 0, t);
    g.recolhido = false;
    const limpou = garantirVisivel(t);
    salvar();
    render({ foco: `nome:${t.id}` });
    anunciar(`Tarefa criada em ${g.nome}${limpou ? ', filtros limpos para exibi-la' : ''}. Digite o nome e pressione Enter.`);
    const b = porChave(`nome:${t.id}`);
    if (b) editarNome(b, t.id);
  }

  function criarNoGrupo(gid, nome) {
    const g = grupo(gid);
    if (!g) return;
    const t = novaTarefaBase(g, { nome: nome.slice(0, MAX_NOME) });
    let ult = -1;
    dados.tarefas.forEach((x, i) => { if (x.grupo === gid) ult = i; });
    dados.tarefas.splice(ult === -1 ? dados.tarefas.length : ult + 1, 0, t);
    delete ui.rascunhos[gid];
    const limpou = garantirVisivel(t);
    salvar();
    render({ foco: `add:${gid}` });
    anunciar(`Tarefa “${t.nome}” adicionada em ${g.nome}${limpou ? '; filtros limpos para exibi-la' : ''}`);
  }

  /** Insere a tarefa t no grupo dela: antes de `depois`, senão logo após `antes`, senão no fim do grupo. */
  function inserirNoGrupo(t, { antes, depois } = {}) {
    let idx = depois ? dados.tarefas.findIndex((x) => x.id === depois && x.grupo === t.grupo) : -1;
    if (idx === -1 && antes) { idx = dados.tarefas.findIndex((x) => x.id === antes && x.grupo === t.grupo); if (idx !== -1) idx += 1; }
    if (idx === -1) {
      let ult = -1;
      dados.tarefas.forEach((x, i) => { if (x.grupo === t.grupo) ult = i; });
      idx = ult === -1 ? dados.tarefas.length : ult + 1;
    }
    dados.tarefas.splice(idx, 0, t);
  }

  function excluirTarefa(id, origem = 'excluir') {
    const t = tarefa(id);
    if (!t) return;
    const ordem = $$('tr[data-id], li.qd-card[data-id]').map((el) => el.dataset.id);
    const i = ordem.indexOf(id);
    const vizinhos = [ordem[i + 1], ordem[i - 1]].filter((x) => x && tarefa(x) && tarefa(x).grupo === t.grupo);
    // vizinhas no grupo (com ou sem filtro), para reinserir no mesmo lugar ao desfazer
    const irmas = tarefasDo(t.grupo);
    const pos = irmas.indexOf(t);
    const lugar = { antes: irmas[pos - 1] && irmas[pos - 1].id, depois: irmas[pos + 1] && irmas[pos + 1].id };
    const copia = clonar(t);
    dados.tarefas = dados.tarefas.filter((x) => x !== t);
    salvar();
    render({ foco: vizinhos[0] ? `${origem}:${vizinhos[0]}` : `add:${t.grupo}`, reserva: [vizinhos[1] && `${origem}:${vizinhos[1]}`, `add:${t.grupo}`].filter(Boolean) });
    registrarDesfazer({
      msg: `Tarefa “${t.nome}” excluída.`,
      desfazer: () => {
        if (tarefa(copia.id)) return { foco: `nome:${copia.id}`, msg: `tarefa “${copia.nome}” já estava no quadro` };
        const volta = clonar(copia);
        if (!grupo(volta.grupo)) volta.grupo = dados.grupos[0].id;
        if (volta.pessoa && !pessoa(volta.pessoa)) volta.pessoa = '';
        inserirNoGrupo(volta, lugar);
        grupo(volta.grupo).recolhido = false;
        const limpou = garantirVisivel(volta);
        return { foco: `nome:${volta.id}`, msg: `tarefa “${volta.nome}” restaurada${limpou ? '; filtros limpos para exibi-la' : ''}` };
      },
    });
  }

  /** Alt+Seta / "Mover para cima/baixo": troca com a vizinha VISÍVEL (respeita busca e filtros). */
  function moverRelativo(id, dir) {
    const t = tarefa(id);
    if (!t) return;
    const visiveis = tarefasDo(t.grupo).filter(passa);
    const i = visiveis.indexOf(t);
    if (i === -1) return;
    const outra = visiveis[i + dir];
    if (!outra) { anunciar(dir < 0 ? 'Já é a primeira do grupo' : 'Já é a última do grupo'); return; }
    dados.tarefas.splice(dados.tarefas.indexOf(t), 1);
    const j = dados.tarefas.indexOf(outra);
    dados.tarefas.splice(dir < 0 ? j : j + 1, 0, t);
    salvar();
    render({ foco: `alca:${id}` });
    anunciar(`“${t.nome}” agora é a ${i + dir + 1}ª de ${plural(visiveis.length, 'tarefa', 'tarefas')}${filtrando() ? ' visíveis' : ''} em ${grupo(t.grupo).nome}`);
  }

  /** Move a tarefa para o grupo gid; pos = {antes: id} | {depois: id} | {} (fim do grupo). */
  function moverTarefa(id, gid, pos = {}, foco) {
    const t = tarefa(id);
    const g = grupo(gid);
    if (!t || !g || pos.antes === id || pos.depois === id) return;
    const origem = t.grupo;
    const lista = dados.tarefas.filter((x) => x !== t);
    let idx = -1;
    if (pos.antes) idx = lista.findIndex((x) => x.id === pos.antes);
    else if (pos.depois) { idx = lista.findIndex((x) => x.id === pos.depois); if (idx !== -1) idx += 1; }
    if (idx === -1) {
      let ult = -1;
      lista.forEach((x, i) => { if (x.grupo === gid) ult = i; });
      idx = ult === -1 ? lista.length : ult + 1;
    }
    t.grupo = gid;
    lista.splice(idx, 0, t);
    dados.tarefas = lista;
    g.recolhido = false;
    salvar();
    render(foco ? { foco } : {});
    anunciar(origem === gid ? `“${t.nome}” reordenada em ${g.nome}` : `“${t.nome}” movida para ${g.nome}`);
  }

  function alternarGrupo(gid, foco) {
    const g = grupo(gid);
    if (!g) return;
    g.recolhido = !g.recolhido;
    salvar();
    render({ foco: foco || `recolher:${gid}` });
    anunciar(`Grupo ${g.nome} ${g.recolhido ? 'recolhido' : 'expandido'}`);
  }

  function novoGrupo() {
    const usadas = new Set(dados.grupos.map((g) => g.cor));
    const nomes = Object.keys(CORES);
    const cor = nomes.find((c) => !usadas.has(c)) || nomes[dados.grupos.length % nomes.length];
    const g = { id: uid('g'), nome: 'Novo grupo', cor, recolhido: false };
    dados.grupos.push(g);
    if (filtrando()) { ui.busca = ''; ui.pessoa = ''; ui.status = ''; sincronizarFiltros(); }
    salvar();
    render({ foco: `gnome:${g.id}` });
    anunciar('Grupo criado. Digite o nome e pressione Enter.');
    const b = porChave(`gnome:${g.id}`);
    if (b) editarGrupo(b, g.id);
  }

  function excluirGrupo(gid, destino) {
    const g = grupo(gid);
    if (!g || dados.grupos.length <= 1) return;
    const copiaG = clonar(g);
    const idx = dados.grupos.indexOf(g);
    const minhas = tarefasDo(gid);
    const ids = minhas.map((t) => t.id);
    const copias = clonar(minhas);
    const moveu = !!(minhas.length && destino && destino !== 'apagar' && grupo(destino));
    let msg = `Grupo “${g.nome}” excluído.`;
    if (moveu) {
      const dst = grupo(destino);
      const resto = dados.tarefas.filter((t) => t.grupo !== gid);
      let ult = -1;
      resto.forEach((t, i) => { if (t.grupo === destino) ult = i; });
      minhas.forEach((t) => { t.grupo = destino; });
      resto.splice(ult === -1 ? resto.length : ult + 1, 0, ...minhas);
      dados.tarefas = resto;
      dst.recolhido = false;
      msg = `Grupo “${g.nome}” excluído; ${plural(minhas.length, 'tarefa movida', 'tarefas movidas')} para ${dst.nome}.`;
    } else if (minhas.length) {
      dados.tarefas = dados.tarefas.filter((t) => t.grupo !== gid);
      msg = `Grupo “${g.nome}” excluído com ${plural(minhas.length, 'tarefa', 'tarefas')}.`;
    }
    dados.grupos.splice(idx, 1);
    delete ui.rascunhos[gid];
    salvar();
    const viz = dados.grupos[idx] || dados.grupos[idx - 1];
    render({ foco: `gnome:${viz.id}`, reserva: ['novo-grupo'] });
    registrarDesfazer({
      msg,
      // devolve o grupo e as tarefas dele, mantendo o que foi editado nelas depois
      desfazer: () => {
        if (grupo(copiaG.id)) return { foco: `gnome:${copiaG.id}`, msg: `grupo “${copiaG.nome}” já estava no quadro` };
        dados.grupos.splice(Math.min(idx, dados.grupos.length), 0, clonar(copiaG));
        let voltam;
        if (moveu) {
          voltam = ids.map(tarefa).filter(Boolean);
          dados.tarefas = dados.tarefas.filter((t) => !voltam.includes(t));
        } else {
          voltam = copias.filter((c) => !tarefa(c.id)).map((c) => ({ ...c, pessoa: pessoa(c.pessoa) ? c.pessoa : '' }));
        }
        voltam.forEach((t) => { t.grupo = copiaG.id; });
        dados.tarefas.push(...voltam);
        return { foco: `gnome:${copiaG.id}`, msg: `grupo “${copiaG.nome}” restaurado${voltam.length ? ` com ${plural(voltam.length, 'tarefa', 'tarefas')}` : ''}` };
      },
    });
  }

  function restaurar() {
    const snap = clonar(dados);
    dados = exemplo();
    ui.busca = ''; ui.pessoa = ''; ui.status = ''; ui.rascunhos = {};
    preencherPessoas();
    sincronizarFiltros();
    salvar();
    renderTitulo();
    renderEquipe();
    render({ foco: 'restaurar' });
    registrarDesfazer({
      msg: 'Quadro restaurado para o exemplo.',
      // aqui desfazer é voltar ao quadro anterior inteiro (é o que a ação substituiu)
      desfazer: () => { dados = snap; return { foco: 'restaurar', msg: 'quadro anterior recuperado' }; },
    });
  }

  function limparFiltros(foco = 'busca') {
    ui.busca = ''; ui.pessoa = ''; ui.status = '';
    sincronizarFiltros();
    render({ foco });
    anunciar('Filtros limpos. Mostrando todas as tarefas.');
  }

  function trocarVisao(v, focarAba) {
    if (v !== 'tabela' && v !== 'kanban') return;
    fecharPop(false);
    ui.visao = v;
    salvar();
    render(focarAba ? { foco: `aba:${v}` } : {});
  }

  let contagemTimer = 0;
  function anunciarContagem() {
    clearTimeout(contagemTimer);
    contagemTimer = setTimeout(() => {
      if (!filtrando()) { anunciar('Mostrando todas as tarefas.'); return; }
      const n = dados.tarefas.filter(passa).length;
      anunciar(n ? plural(n, 'tarefa encontrada', 'tarefas encontradas') : 'Nenhuma tarefa encontrada');
    }, 450);
  }

  // ---------------------------------------------------------------- eventos: cliques
  const SEM_REPETIR = new Set(['excluir', 'nova-tarefa', 'nova-tarefa-status', 'novo-grupo', 'restaurar', 'desfazer']);
  raiz.addEventListener('click', (e) => {
    const b = e.target.closest('[data-acao]');
    if (!b || !raiz.contains(b)) return;
    const id = b.dataset.id;
    const acao = b.dataset.acao;
    // segundo clique no gatilho de um popover aberto apenas fecha
    if (pop && pop.gatilho === b) { fecharPop(true); return; }
    // duplo clique não repete ações que criam, excluem ou desfazem: depois do 1º clique
    // outro controle pode estar sob o ponteiro (a linha de baixo sobe, o editor abre)
    if (e.detail > 1 && SEM_REPETIR.has(acao)) return;
    switch (acao) {
      case 'editar-titulo': editarTitulo(b); break;
      case 'editar-nome': editarNome(b, id); break;
      case 'editar-grupo': editarGrupo(b, id); break;
      case 'recolher': alternarGrupo(id); break;
      case 'status': abrirStatus(b, id, false); break;
      case 'mover-card': abrirStatus(b, id, true); break;
      case 'pessoa': abrirPessoa(b, id); break;
      case 'crono': abrirCrono(b, id); break;
      case 'prazo': abrirPrazo(b, id); break;
      case 'menu-tarefa': abrirMenuTarefa(b, id); break;
      case 'menu-grupo': abrirMenuGrupo(b, id); break;
      case 'excluir': excluirTarefa(id); break;
      case 'novo-grupo': novoGrupo(); break;
      case 'nova-tarefa': novaTarefa(); break;
      case 'nova-tarefa-status': novaTarefa({ status: b.dataset.status }); break;
      case 'restaurar': restaurar(); break;
      case 'limpar-filtros': limparFiltros(); break;
      case 'desfazer': desfazer(); break;
      case 'fechar-toast': esconderToast(); break;
      default: break;
    }
  });

  // ---------------------------------------------------------------- eventos: teclado
  raiz.addEventListener('keydown', (e) => {
    const alvo = e.target;
    if (!(alvo instanceof Element)) return;

    // linha "+ Adicionar tarefa"
    if (alvo.matches('.qd-add')) {
      if (e.key === 'Enter') {
        e.preventDefault();
        const nome = alvo.value.replace(/\s+/g, ' ').trim();
        if (nome) criarNoGrupo(alvo.dataset.add, nome);
        else anunciar('Digite um nome para a tarefa');
      } else if (e.key === 'Escape') {
        alvo.value = '';
        delete ui.rascunhos[alvo.dataset.add];
      }
      return;
    }

    // Alt + setas: reordenar linha / trocar cartão de coluna
    if (e.altKey && alvo.matches('.qd-alca') && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      moverRelativo(alvo.dataset.id, e.key === 'ArrowUp' ? -1 : 1);
      return;
    }
    if (e.altKey && alvo.matches('.qd-card__mover') && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault();
      const t = tarefa(alvo.dataset.id);
      if (!t) return;
      const i = STATUS.findIndex((s) => s.id === t.status) + (e.key === 'ArrowLeft' ? -1 : 1);
      if (i < 0 || i >= STATUS.length) { anunciar('Não há coluna nessa direção'); return; }
      definirStatus(t.id, STATUS[i].id);
      return;
    }

    // abas: setas, Home, End (ativação automática)
    if (alvo.matches('[role="tab"]')) {
      const i = abas.indexOf(alvo);
      let n = null;
      if (e.key === 'ArrowRight') n = (i + 1) % abas.length;
      else if (e.key === 'ArrowLeft') n = (i - 1 + abas.length) % abas.length;
      else if (e.key === 'Home') n = 0;
      else if (e.key === 'End') n = abas.length - 1;
      if (n !== null) { e.preventDefault(); trocarVisao(abas[n].dataset.visao, true); }
      return;
    }

    // Ctrl/Cmd + Z desfaz a última exclusão/restauração (sem prazo: vale depois que o aviso some)
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'z' && pilha.length && !alvo.matches('input, textarea, select')) {
      e.preventDefault();
      desfazer();
    }
  });

  abas.forEach((a) => a.addEventListener('click', () => trocarVisao(a.dataset.visao, true)));

  // rascunho da linha "+ Adicionar tarefa"
  raiz.addEventListener('input', (e) => {
    const el = e.target;
    if (el instanceof HTMLInputElement && el.matches('.qd-add')) {
      if (el.value) ui.rascunhos[el.dataset.add] = el.value;
      else delete ui.rascunhos[el.dataset.add];
    }
  });

  // ---------------------------------------------------------------- foco sempre à vista
  /* Ao navegar pelo teclado, o controle focado não pode ficar escondido sob as colunas
     fixas da tabela (alça + Tarefa, quando ela rola na horizontal) nem sob o cabeçalho
     fixo da página. O navegador só rola se o elemento estiver fora da área visível. */
  raiz.addEventListener('focusin', (e) => {
    const el = e.target;
    // só foco de teclado: rolar durante um clique/toque tiraria o alvo de baixo do ponteiro
    if (!(el instanceof Element) || el.closest('.qd-pop, .qd-toast') || !el.matches(':focus-visible')) return;
    const rol = el.closest('[data-rolagem]');
    const tr = rol && el.closest('tr');
    if (tr && !el.closest('.qd-c-alca, .qd-c-tarefa')) {
      // o Chrome não rola um controle que já aparece em parte (sob a coluna fixa ou
      // cortado na borda direita); aqui ele é trazido inteiro para a área livre
      const fixa = tr.querySelector('.qd-c-tarefa');
      const esq = fixa ? fixa.getBoundingClientRect().right : rol.getBoundingClientRect().left;
      const dir = rol.getBoundingClientRect().right;
      const r = el.getBoundingClientRect();
      if (r.left < esq) rol.scrollLeft -= esq - r.left + 8;
      else if (r.right > dir) rol.scrollLeft += Math.min(r.right - dir + 8, r.left - esq);
    }
    let topo = 0;
    for (const x of document.querySelectorAll('body > header, body > .topo')) {
      const pos = getComputedStyle(x).position;
      if (pos === 'sticky' || pos === 'fixed') topo = Math.max(topo, x.getBoundingClientRect().bottom);
    }
    const r = el.getBoundingClientRect();
    if (topo > 0 && r.top < topo + 8) window.scrollBy({ top: r.top - topo - 16, behavior: 'instant' });
  });
  raiz.addEventListener('scroll', (e) => { if (e.target instanceof Element && e.target.matches('[data-rolagem]')) atualizarRolagem(); }, true);
  window.addEventListener('resize', atualizarRolagem);

  // ---------------------------------------------------------------- busca e filtros
  campoBusca.addEventListener('input', () => {
    ui.busca = campoBusca.value;
    campoBusca.classList.toggle('is-ativo', !!campoBusca.value);
    render();
    anunciarContagem();
  });
  selPessoa.addEventListener('change', () => {
    ui.pessoa = selPessoa.value;
    selPessoa.classList.toggle('is-ativo', !!selPessoa.value);
    render();
    anunciarContagem();
  });
  selStatus.addEventListener('change', () => {
    ui.status = selStatus.value;
    selStatus.classList.toggle('is-ativo', !!selStatus.value);
    render();
    anunciarContagem();
  });

  // ---------------------------------------------------------------- arrastar e soltar
  let arrastando = null;

  function limparMarcas() {
    $$('.is-drop-antes, .is-drop-depois, .is-drop-alvo').forEach((el) => el.classList.remove('is-drop-antes', 'is-drop-depois', 'is-drop-alvo'));
  }
  function encerrarArraste() {
    limparMarcas();
    $$('.is-arrastando').forEach((el) => el.classList.remove('is-arrastando'));
    arrastando = null;
    setTimeout(talvezRender, 0); // re-render que esperava o fim do arraste
  }

  // Tabela: linhas entre/dentro de grupos
  painelTabela.addEventListener('dragstart', (e) => {
    const tr = e.target instanceof Element ? e.target.closest('tr[data-id]') : null;
    if (!tr || tr.querySelector('.qd-edit')) { if (tr) e.preventDefault(); return; }
    fecharPop(false);
    arrastando = { id: tr.dataset.id, tipo: 'linha' };
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', tr.dataset.id); } catch (_) { /* ignora */ }
    requestAnimationFrame(() => tr.classList.add('is-arrastando'));
  });

  function alvoLinha(e) {
    if (!(e.target instanceof Element)) return null;
    const tr = e.target.closest('tr[data-id]');
    const bloco = e.target.closest('.qd-grupo[data-grupo]');
    if (!bloco) return null;
    if (tr) {
      const r = tr.getBoundingClientRect();
      return { el: tr, grupo: bloco.dataset.grupo, ref: tr.dataset.id, depois: e.clientY > r.top + r.height / 2 };
    }
    return { el: bloco, grupo: bloco.dataset.grupo, ref: null };
  }

  painelTabela.addEventListener('dragover', (e) => {
    if (!arrastando || arrastando.tipo !== 'linha') return;
    const alvo = alvoLinha(e);
    if (!alvo) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    limparMarcas();
    if (alvo.ref === arrastando.id) return;
    if (alvo.ref) alvo.el.classList.add(alvo.depois ? 'is-drop-depois' : 'is-drop-antes');
    else alvo.el.classList.add('is-drop-alvo');
  });
  painelTabela.addEventListener('dragleave', (e) => {
    if (!e.relatedTarget || !painelTabela.contains(e.relatedTarget)) limparMarcas();
  });
  painelTabela.addEventListener('drop', (e) => {
    if (!arrastando || arrastando.tipo !== 'linha') return;
    const alvo = alvoLinha(e);
    e.preventDefault();
    const id = arrastando.id;
    encerrarArraste();
    if (!alvo || alvo.ref === id) return;
    moverTarefa(id, alvo.grupo, alvo.ref ? (alvo.depois ? { depois: alvo.ref } : { antes: alvo.ref }) : {});
  });
  painelTabela.addEventListener('dragend', encerrarArraste);

  // Kanban: cartões entre colunas (muda o status)
  painelKanban.addEventListener('dragstart', (e) => {
    const card = e.target instanceof Element ? e.target.closest('.qd-card[data-id]') : null;
    if (!card || card.querySelector('.qd-edit')) { if (card) e.preventDefault(); return; }
    fecharPop(false);
    arrastando = { id: card.dataset.id, tipo: 'card' };
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', card.dataset.id); } catch (_) { /* ignora */ }
    requestAnimationFrame(() => card.classList.add('is-arrastando'));
  });
  painelKanban.addEventListener('dragover', (e) => {
    if (!arrastando || arrastando.tipo !== 'card' || !(e.target instanceof Element)) return;
    const col = e.target.closest('[data-drop-status]');
    if (!col) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!col.classList.contains('is-drop-alvo')) { limparMarcas(); col.classList.add('is-drop-alvo'); }
  });
  painelKanban.addEventListener('dragleave', (e) => {
    if (!e.relatedTarget || !painelKanban.contains(e.relatedTarget)) limparMarcas();
  });
  painelKanban.addEventListener('drop', (e) => {
    if (!arrastando || arrastando.tipo !== 'card' || !(e.target instanceof Element)) return;
    const col = e.target.closest('[data-drop-status]');
    e.preventDefault();
    const id = arrastando.id;
    encerrarArraste();
    if (!col) return;
    const t = tarefa(id);
    if (t && t.status !== col.dataset.dropStatus) {
      t.status = col.dataset.dropStatus;
      salvar();
      render({});
      anunciar(`Status alterado para ${ST[t.status].rotulo}`);
    }
  });
  painelKanban.addEventListener('dragend', encerrarArraste);

  // ---------------------------------------------------------------- início
  preencherPessoas();
  sincronizarFiltros();
  renderTitulo();
  renderEquipe();
  render({ foco: null });
})();
