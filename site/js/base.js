// Comportamentos compartilhados: animação de entrada e marquee duplicado.
(() => {
  const reveal = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target); }
      }
    }, { rootMargin: '0px 0px -10% 0px' });
    reveal.forEach((el) => io.observe(el));
  } else {
    reveal.forEach((el) => el.classList.add('is-visible'));
  }

  // Marquee contínuo: duplica o conteúdo da trilha (a animação vai até -50%).
  document.querySelectorAll('.marquee__track').forEach((track) => {
    if (track.dataset.cloned) return;
    track.dataset.cloned = '1';
    [...track.children].forEach((child) => {
      const clone = child.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      track.appendChild(clone);
    });
  });
})();
