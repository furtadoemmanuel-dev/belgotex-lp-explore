// Linha do tempo dos selos (SealTimeline.astro), adaptada do Timeline da Hyperiux Vault sem GSAP:
// - desktop: a seção ganha altura de rolagem e a faixa fica presa no topo; a rolagem vertical vira deslize
//   horizontal (o "scrub" do original). A linha central se estende até o centro da tela e cada selo revela
//   haste, ponto, imagem e texto conforme se aproxima do centro (--r de 0 a 1 em CSS);
// - celular: linha vertical; a linha cresce e cada selo se revela ao subir na tela;
// - movimento reduzido: nada preso nem animado, tudo visível (no desktop a faixa rola para o lado).

const HEADER = 68;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const ease = (t: number) => 1 - Math.pow(1 - t, 3); // power2/3.out

export function initSealTimeline(): void {
  const found = document.querySelector<HTMLElement>('[data-st]');
  if (!found) return;
  const root: HTMLElement = found;
  const pin = root.querySelector<HTMLElement>('[data-st-pin]')!;
  const track = root.querySelector<HTMLElement>('[data-st-track]')!;
  const line = root.querySelector<HTMLElement>('[data-st-line]')!;
  const lineBox = line.parentElement!;
  const items = [...root.querySelectorAll<HTMLElement>('[data-st-item]')];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const wide = matchMedia('(min-width: 760px)');

  let mode: 'pinned' | 'vertical' | 'static' = 'static';
  let distance = 0;
  let raf = 0;

  const setR = (el: HTMLElement, r: number) => el.style.setProperty('--r', ease(clamp01(r)).toFixed(3));

  function layout(): void {
    const next = !wide.matches ? 'vertical' : reduce.matches ? 'static' : 'pinned';
    mode = next;
    root.classList.toggle('is-pinned', mode === 'pinned');
    root.classList.toggle('is-vertical', mode === 'vertical');
    track.style.transform = '';
    root.style.height = '';
    if (mode === 'pinned') {
      distance = Math.max(0, track.scrollWidth - pin.clientWidth);
      // altura = a faixa presa + o caminho do deslize
      root.style.height = `${pin.offsetHeight + distance}px`;
    }
    if (reduce.matches) {
      items.forEach((it) => it.style.setProperty('--r', '1'));
      line.style.setProperty('--line', '1');
    }
    frame();
  }

  function frame(): void {
    raf = 0;
    if (reduce.matches) return;
    const vw = innerWidth;
    const vh = innerHeight;
    if (mode === 'pinned') {
      const top = root.getBoundingClientRect().top - HEADER;
      const p = distance ? clamp01(-top / distance) : 0;
      track.style.transform = `translate3d(${(-p * distance).toFixed(1)}px, 0, 0)`;
      const lb = lineBox.getBoundingClientRect();
      // a linha vai à frente dos selos: chega aonde eles começam a aparecer
      line.style.setProperty('--line', clamp01((vw * 0.92 - lb.left) / lb.width).toFixed(4));
      items.forEach((it) => {
        const x = it.getBoundingClientRect().left;
        setR(it, (vw * 0.88 - x) / (vw * 0.28));
      });
    } else if (mode === 'vertical') {
      const lb = lineBox.getBoundingClientRect();
      line.style.setProperty('--line', clamp01((vh * 0.92 - lb.top) / lb.height).toFixed(4));
      items.forEach((it) => {
        const y = it.getBoundingClientRect().top;
        setR(it, (vh * 0.9 - y) / (vh * 0.25));
      });
    } else {
      items.forEach((it) => it.style.setProperty('--r', '1'));
      line.style.setProperty('--line', '1');
    }
  }
  const tick = () => {
    if (!raf) raf = requestAnimationFrame(frame);
  };

  root.style.setProperty('--n', String(items.length));
  addEventListener('scroll', tick, { passive: true });
  addEventListener('resize', () => requestAnimationFrame(layout));
  wide.addEventListener('change', layout);
  reduce.addEventListener('change', layout);
  // As imagens e a fonte mudam a largura da faixa: recalcula quando tudo carregar
  addEventListener('load', layout, { once: true });
  void document.fonts?.ready.then(layout);
  layout();
}
