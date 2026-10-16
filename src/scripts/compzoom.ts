import { track } from './analytics';

// Zoom do compositor: aproxima para ver a textura de cada placa e afasta para ver a composição inteira.
// - botões − / 100% / +;
// - pinça (toque ou trackpad) e Ctrl/⌘ + rolagem, aproximando em direção ao ponto apontado. A rolagem
//   comum continua rolando a página;
// - duplo clique (ou toque duplo) alterna entre 100% e 250% no ponto clicado;
// - com zoom, arrastar move o piso (sem deixar que ele saia do quadro).
// A camada de zoom é separada do piso, então "Perspectiva" e "Vista de cima" continuam funcionando por baixo.

const MIN = 0.7;
const MAX = 3.5;
const STEP = 1.45;
const DOUBLE = 2.5;

export function initCompZoom(): void {
  const view = document.querySelector<HTMLElement>('[data-zoom-view]');
  const layer = view?.querySelector<HTMLElement>('[data-zoom-layer]');
  if (!view || !layer) return;
  const label = view.querySelector<HTMLElement>('[data-zoom-label]')!;
  const hint = view.querySelector<HTMLElement>('[data-zoom-hint]');
  const btnIn = view.querySelector<HTMLButtonElement>('[data-zoom="in"]')!;
  const btnOut = view.querySelector<HTMLButtonElement>('[data-zoom="out"]')!;

  let z = 1;
  let x = 0;
  let y = 0;

  const size = () => ({ w: view.clientWidth, h: view.clientHeight });

  /** Mantém o piso no quadro: ampliado, as bordas não passam do centro; reduzido, fica centralizado. */
  const clampPan = () => {
    const { w, h } = size();
    if (z <= 1) {
      x = (w - w * z) / 2;
      y = (h - h * z) / 2;
      return;
    }
    x = Math.min(0, Math.max(w - w * z, x));
    y = Math.min(0, Math.max(h - h * z, y));
  };

  const apply = (live = false) => {
    clampPan();
    if (live) view.dataset.zoomLive = '';
    else delete view.dataset.zoomLive;
    layer.style.setProperty('--z', z.toFixed(4));
    layer.style.setProperty('--zx', `${x.toFixed(1)}px`);
    layer.style.setProperty('--zy', `${y.toFixed(1)}px`);
    label.textContent = `${Math.round(z * 100)}%`;
    btnIn.disabled = z >= MAX - 0.001;
    btnOut.disabled = z <= MIN + 0.001;
    if (z > 1.001) view.dataset.zoomed = '';
    else delete view.dataset.zoomed;
    if (hint && z !== 1) hint.hidden = true;
  };

  /** Zoom para `next`, mantendo parado o ponto (px, py) do quadro. */
  const zoomAt = (next: number, px: number, py: number, live = false) => {
    const n = Math.min(MAX, Math.max(MIN, next));
    x = px - ((px - x) * n) / z;
    y = py - ((py - y) * n) / z;
    z = n;
    apply(live);
  };
  const centre = () => {
    const { w, h } = size();
    return [w / 2, h / 2] as const;
  };
  const local = (cx: number, cy: number) => {
    const r = view.getBoundingClientRect();
    return [cx - r.left, cy - r.top] as const;
  };

  btnIn.addEventListener('click', () => {
    zoomAt(z * STEP, ...centre());
    track('composer_zoom', { zoom: Math.round(z * 100) });
  });
  btnOut.addEventListener('click', () => {
    zoomAt(z / STEP, ...centre());
    track('composer_zoom', { zoom: Math.round(z * 100) });
  });
  view.querySelector('[data-zoom="reset"]')!.addEventListener('click', () => {
    z = 1;
    apply();
  });

  // Pinça no trackpad (o navegador manda wheel com ctrlKey) e Ctrl/⌘ + rolagem
  let wheelEnd = 0;
  view.addEventListener(
    'wheel',
    (e) => {
      if (!e.ctrlKey && !e.metaKey) return; // rolagem comum: a página rola
      e.preventDefault();
      const [px, py] = local(e.clientX, e.clientY);
      zoomAt(z * Math.exp(-e.deltaY * 0.01), px, py, true);
      clearTimeout(wheelEnd);
      wheelEnd = window.setTimeout(() => apply(), 120);
    },
    { passive: false },
  );

  view.addEventListener('dblclick', (e) => {
    if ((e.target as Element).closest('.c-zoomctl')) return;
    const [px, py] = local(e.clientX, e.clientY);
    zoomAt(z > 1.05 ? 1 : DOUBLE, px, py);
    track('composer_zoom', { zoom: Math.round(z * 100), via: 'dblclick' });
  });

  // Ponteiros: um arrasta (só com zoom), dois fazem a pinça
  const pts = new Map<number, { x: number; y: number }>();
  let pinch: { d: number; z: number } | null = null;
  let lastTap = 0;
  view.addEventListener('pointerdown', (e) => {
    if ((e.target as Element).closest('.c-zoomctl')) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      pinch = { d: Math.hypot(a!.x - b!.x, a!.y - b!.y), z };
    }
    if (z > 1.001 || pts.size === 2) view.setPointerCapture(e.pointerId);
    // toque duplo no celular (o dblclick nem sempre chega com toque)
    if (e.pointerType === 'touch' && pts.size === 1) {
      const now = performance.now();
      if (now - lastTap < 300) {
        const [px, py] = local(e.clientX, e.clientY);
        zoomAt(z > 1.05 ? 1 : DOUBLE, px, py);
        lastTap = 0;
      } else lastTap = now;
    }
  });
  view.addEventListener('pointermove', (e) => {
    const prev = pts.get(e.pointerId);
    if (!prev) return;
    const cur = { x: e.clientX, y: e.clientY };
    pts.set(e.pointerId, cur);
    if (pts.size === 2 && pinch) {
      const [a, b] = [...pts.values()];
      const d = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      const [px, py] = local((a!.x + b!.x) / 2, (a!.y + b!.y) / 2);
      zoomAt((pinch.z * d) / Math.max(pinch.d, 1), px, py, true);
    } else if (pts.size === 1 && z > 1.001) {
      x += cur.x - prev.x;
      y += cur.y - prev.y;
      apply(true);
    }
  });
  const end = (e: PointerEvent) => {
    pts.delete(e.pointerId);
    if (pts.size < 2) pinch = null;
    if (!pts.size) apply();
  };
  view.addEventListener('pointerup', end);
  view.addEventListener('pointercancel', end);

  // Teclado: + e − quando o foco está no quadro ou nos botões
  view.addEventListener('keydown', (e) => {
    if (e.key === '+' || e.key === '=') zoomAt(z * STEP, ...centre());
    else if (e.key === '-' || e.key === '_') zoomAt(z / STEP, ...centre());
    else if (e.key === '0') {
      z = 1;
      apply();
    } else return;
    e.preventDefault();
  });

  new ResizeObserver(() => apply()).observe(view);
  apply();
}
