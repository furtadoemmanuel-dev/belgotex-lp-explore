// Entradas suaves: elementos com [data-reveal] (sobe e aparece, CSS global) ou [data-stagger] (o componente
// define a animação dos filhos) ganham .in quando aparecem, uma vez só.
// O estado inicial (data-wait) só é aplicado por aqui, então sem JavaScript tudo aparece normalmente.
export function initReveal(): void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const els = [...document.querySelectorAll<HTMLElement>('[data-reveal], [data-stagger]')];
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const el = e.target as HTMLElement;
        if (!e.isIntersecting) continue;
        delete el.dataset.wait;
        el.classList.add('in');
        io.unobserve(el);
      }
    },
    { threshold: 0.2, rootMargin: '0px 0px -8% 0px' },
  );
  for (const el of els) {
    const r = el.getBoundingClientRect();
    if (r.top < innerHeight && r.bottom > 0) continue; // já visível no carregamento
    el.dataset.wait = '';
    io.observe(el);
  }
}
