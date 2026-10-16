// Cortina do rodapé (adaptada do CinematicFooter, sem GSAP).
// - "Explore" gigante sobe, cresce e aparece conforme a cortina é revelada (de "topo a 80% da tela" até
//   "fim da cortina no fim da tela"); título e botões entram depois (a partir de 40%), um após o outro.
//   O valor segue a rolagem com um pequeno atraso, como o scrub: 1 do GSAP.
// - Botões magnéticos: ver magnetic.ts.
// - As animações em loop só rodam com a cortina na tela; com movimento reduzido, tudo fica parado e visível.

import { magnetize } from './magnetic';

const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1);

export function initFooter(): void {
  const curtain = document.querySelector<HTMLElement>('[data-f-curtain]');
  const stage = document.querySelector<HTMLElement>('[data-f-stage]');
  if (!curtain || !stage) return;
  const giant = stage.querySelector<HTMLElement>('[data-f-giant]')!;
  const heading = stage.querySelector<HTMLElement>('[data-f-heading]')!;
  const links = stage.querySelector<HTMLElement>('[data-f-links]')!;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  stage.querySelector('[data-f-top]')?.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    // o foco volta para o começo do conteúdo (senão o próximo Tab continuaria no rodapé)
    const main = document.getElementById('conteudo');
    if (main) {
      if (!main.hasAttribute('tabindex')) main.tabIndex = -1;
      main.focus({ preventScroll: true });
    }
  });

  // Teclado: um botão da cortina recebendo foco com ela fora da tela traz a cortina inteira para a vista
  stage.addEventListener('focusin', () => {
    const r = curtain.getBoundingClientRect();
    if (r.top > 1 || r.bottom > innerHeight + 1) curtain.scrollIntoView({ block: 'end' });
  });

  // Loops só com a cortina na tela; a rolagem também só é acompanhada nesse trecho
  let near = false;
  new IntersectionObserver(
    ([e]) => {
      near = e!.isIntersecting;
      stage.classList.toggle('is-live', near);
      if (near && !reduce) tick();
    },
    { rootMargin: '0px 0px 200px 0px' },
  ).observe(curtain);

  if (reduce) return;

  // Rolagem → progresso
  let a = 0; // "Explore" gigante (alvo)
  let b = 0; // título e botões (alvo)
  let ca = 0; // valores atuais, que perseguem o alvo
  let cb = 0;
  let raf = 0;
  const read = () => {
    const vh = innerHeight;
    const top = curtain.getBoundingClientRect().top;
    a = clamp01((vh * 0.8 - top) / (vh * 0.8));
    b = clamp01((vh * 0.4 - top) / (vh * 0.4));
  };
  const paint = () => {
    giant.style.transform = `translateX(-50%) translateY(${(1 - ca) * 10}vh) scale(${0.8 + 0.2 * ca})`;
    giant.style.opacity = String(ca);
    const h = clamp01(cb * 1.15);
    const l = clamp01(cb * 1.15 - 0.15);
    heading.style.transform = `translateY(${(1 - h) * 50}px)`;
    heading.style.opacity = String(h);
    links.style.transform = `translateY(${(1 - l) * 50}px)`;
    links.style.opacity = String(l);
  };
  let last = 0;
  const frame = (now: number) => {
    raf = 0;
    // perseguição medida em tempo (igual em 60 e 120 Hz)
    const k = 1 - 0.88 ** ((last ? Math.min(now - last, 64) : 16.7) / 16.7);
    last = now;
    ca += (a - ca) * k;
    cb += (b - cb) * k;
    if (Math.abs(a - ca) < 0.001) ca = a;
    if (Math.abs(b - cb) < 0.001) cb = b;
    paint();
    if (ca !== a || cb !== b) raf = requestAnimationFrame(frame);
    else last = 0;
  };
  function tick(): void {
    read();
    if (!raf) raf = requestAnimationFrame(frame);
  }
  // Estado inicial já de acordo com a posição (ex.: recarregar a página no fim)
  read();
  ca = a;
  cb = b;
  paint();
  addEventListener('scroll', () => near && tick(), { passive: true });
  addEventListener('resize', () => near && tick());

  magnetize(stage.querySelectorAll<HTMLElement>('.f-pill, [data-f-top]'));
}
