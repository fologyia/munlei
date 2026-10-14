// 20 — Controle: acordeão só no mobile (<768px).
// Na marcação estática cada título é texto simples (<span class="controle__botao">),
// o que serve sem JS e no desktop/tablet, onde todos os textos ficam à mostra.
// No mobile o span vira <button aria-expanded aria-controls>; ao voltar para
// ≥768px, volta a ser span. Assim nunca há um botão anunciado que não faz nada.
// O estado aberto/fechado de cada item vive na classe .is-aberto (só vale no mobile).
(() => {
  const secao = document.querySelector('.controle');
  if (!secao) return;

  const itens = [...secao.querySelectorAll('.controle__item')];
  const mobile = window.matchMedia('(max-width: 767px)');

  // Desliga as transições por dois quadros (montagem e troca de modo).
  const semTransicao = () => {
    secao.classList.add('controle--sem-transicao');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      secao.classList.remove('controle--sem-transicao');
    }));
  };

  // Troca o elemento do título mantendo classe, id e filhos.
  const trocar = (el, tag) => {
    if (el.localName === tag) return el;
    const novo = document.createElement(tag);
    novo.className = el.className;
    novo.id = el.id;
    novo.append(...el.childNodes);
    el.replaceWith(novo);
    return novo;
  };

  const sincronizar = () => {
    const ehMobile = mobile.matches;
    itens.forEach((item) => {
      const titulo = trocar(item.querySelector('.controle__botao'), ehMobile ? 'button' : 'span');
      if (!ehMobile) return;
      titulo.type = 'button';
      titulo.setAttribute('aria-controls', item.querySelector('.controle__painel').id);
      titulo.setAttribute('aria-expanded', String(item.classList.contains('is-aberto')));
    });
  };

  // Enter e Espaço já disparam "click" em <button>; no desktop não há botão.
  secao.addEventListener('click', (e) => {
    const botao = e.target.closest('button.controle__botao');
    if (!botao || !mobile.matches) return;
    const aberto = botao.closest('.controle__item').classList.toggle('is-aberto');
    botao.setAttribute('aria-expanded', String(aberto));
  });

  const aoTrocarModo = () => { semTransicao(); sincronizar(); };
  if (mobile.addEventListener) mobile.addEventListener('change', aoTrocarModo);
  else mobile.addListener(aoTrocarModo);

  semTransicao();
  secao.classList.add('controle--acordeao');
  sincronizar();
})();
