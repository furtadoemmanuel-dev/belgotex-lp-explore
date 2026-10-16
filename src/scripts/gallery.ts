import { track } from './analytics';

// Carrossel "squeeze" dos ambientes (adaptado do componente SqueezeCarousel).
// A fila é uma faixa que desliza, não um anel que gira: até 4 colunas dividem o espaço que sobra depois da
// foto aberta, das lâminas e dos espaços, e o resto vira lâmina. Avançar acrescenta cartões ao fim da faixa e
// a desliza para a esquerda (a foto que sai vira lâmina e sai pela borda); voltar acrescenta no começo.
// Terminado o movimento, a faixa é cortada de volta aos cartões à vista, sem animação (a imagem é a mesma).
// As larguras são calculadas em CSS (calc com --sq-hero e --sq-room); o script só troca estilos e classes.

/** Parte do espaço livre de cada coluna (somam 1). A foto aberta parte de 16:9 e devolve um pouco. */
const SHARES: Record<number, number[]> = {
  1: [0],
  2: [-0.06, 1.06],
  3: [-0.06, 0.66, 0.4],
  4: [-0.06, 0.61, 0.3, 0.15],
};
/** Com o mouse em cima, a coluna cresce e as outras cedem: a aberta 0,06, as demais 0,02 cada. */
const GIVE = (col: number) => (col === 0 ? 0.06 : 0.02);

type Card = { el: HTMLButtonElement; slide: number };

export function initGallery(): void {
  const root = document.querySelector<HTMLElement>('[data-gallery-root]');
  const dlg = document.querySelector<HTMLDialogElement>('[data-lightbox]');
  if (!root || !dlg) return;

  const row = root.querySelector<HTMLElement>('.sq-row')!;
  const strip = root.querySelector<HTMLElement>('[data-sq-strip]')!;
  const copies = [...root.querySelectorAll<HTMLElement>('[data-sq-copy]')];
  const live = root.querySelector<HTMLElement>('[data-sq-live]')!;
  const counter = root.querySelector<HTMLElement>('[data-sq-count]')!;
  const prevBtn = root.querySelector<HTMLButtonElement>('[data-sq-prev]')!;
  const nextBtn = root.querySelector<HTMLButtonElement>('[data-sq-next]')!;
  const all = [...root.querySelectorAll<HTMLTemplateElement>('template[data-sq-slide]')];
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const pad2 = (n: number) => String(n).padStart(2, '0');
  const ms = () => (reduce.matches ? 0 : 1000);

  let slides = all; // os da categoria escolhida no filtro
  let cards: Card[] = [];
  let column = 0; // coluna do primeiro cartão da faixa (negativa enquanto a faixa desliza para a esquerda)
  let k = 4; // colunas em uso
  let visible = 7; // colunas + lâminas
  let hover = -1;
  let moving = false;
  let queued = 0;
  let eager = false; // a seção já está perto: as fotos dos cartões novos carregam na hora
  let timer = 0;

  const count = () => slides.length;
  const wrap = (i: number) => ((i % count()) + count()) % count();
  const front = () => cards[-column];
  const open = () => front()?.slide ?? 0;
  const tpl = (slide: number) => slides[slide]!;

  function sizes(): void {
    const css = parseInt(getComputedStyle(row).getPropertyValue('--sq-slats')) || 3;
    k = Math.min(4, count());
    const slats = Math.max(0, Math.min(count() - 4, css));
    visible = k + slats;
    row.style.setProperty('--sq-k', String(k));
    row.style.setProperty('--sq-n', String(slats));
  }

  const shareOf = (col: number): number => {
    const base = SHARES[k]![col]!;
    if (hover < 0 || hover >= k || reduce.matches) return base;
    if (col !== hover) return base - GIVE(col);
    let gain = 0;
    for (let c = 0; c < k; c++) if (c !== hover) gain += GIVE(c);
    return base + gain;
  };
  const widthOf = (col: number): string => {
    if (col < 0 || col >= k) return 'var(--sq-slat)';
    if (col === 0) return `calc(var(--sq-hero) + var(--sq-room) * ${shareOf(0)})`;
    return `calc(var(--sq-room) * ${shareOf(col)})`;
  };

  function makeCard(slide: number): Card {
    const t = tpl(slide);
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'sq-card';
    el.setAttribute('role', 'tab');
    el.setAttribute('aria-controls', 'sq-panel');
    el.append(t.content.cloneNode(true));
    if (eager) el.querySelectorAll('img').forEach((im) => (im.loading = 'eager'));
    return { el, slide };
  }

  function layout(animate: boolean): void {
    if (!animate) strip.dataset.still = '';
    cards.forEach((c, p) => {
      const col = p + column;
      const w = widthOf(col);
      const s = c.el.style;
      s.width = w;
      s.marginLeft = p === 0 ? '0px' : col < k ? 'var(--sq-gap)' : 'var(--sq-slat-gap)';
      s.borderRadius = `min(6px, calc(${w} / 2))`;
      const isFront = col === 0;
      c.el.classList.toggle('is-front', isFront);
      c.el.setAttribute('aria-selected', String(isFront));
      c.el.tabIndex = isFront ? 0 : -1;
      const caption = tpl(c.slide).dataset.caption ?? '';
      c.el.setAttribute('aria-label', `${isFront ? 'Ampliar foto' : 'Ver ambiente'}: ${caption}`);
    });
    strip.style.transform = `translateX(calc(${column} * (var(--sq-slat) + var(--sq-gap))))`;
    if (!animate) {
      void strip.offsetWidth; // aplica sem transição antes de religar
      delete strip.dataset.still;
    }
  }

  function panel(announce: boolean): void {
    const t = tpl(open());
    const id = t.dataset.sqSlide;
    copies.forEach((c) => {
      const on = c.dataset.sqCopy === id;
      c.classList.toggle('on', on);
      c.setAttribute('aria-hidden', String(!on));
      c.querySelectorAll<HTMLElement>('button, a').forEach((b) => (b.tabIndex = on ? 0 : -1));
    });
    counter.textContent = `${pad2(open() + 1)} / ${pad2(count())}`;
    const many = count() > 1;
    prevBtn.hidden = nextBtn.hidden = !many;
    if (announce) live.textContent = `Ambiente ${open() + 1} de ${count()}: ${t.dataset.caption ?? ''}`;
  }

  function build(): void {
    clearTimeout(timer);
    moving = false;
    queued = 0;
    hover = -1;
    column = 0;
    sizes();
    cards = Array.from({ length: visible }, (_, p) => makeCard(wrap(p)));
    strip.replaceChildren(...cards.map((c) => c.el));
    layout(false);
    panel(false);
  }

  /** Corta a faixa de volta aos cartões à vista e zera o deslize, sem animação. */
  function settle(): void {
    cards = cards.filter((c, p) => {
      const col = p + column;
      const keep = col >= 0 && col < visible;
      if (!keep) c.el.remove();
      return keep;
    });
    column = 0;
    layout(false);
    moving = false;
    if (queued) {
      const q = queued;
      queued = 0;
      step(q);
    }
  }

  function step(by: number, focus = false): void {
    if (count() < 2 || by === 0) return;
    if (moving) {
      queued += by; // cliques rápidos: soma e anda assim que este passo assentar
      return;
    }
    moving = true;
    if (by > 0) {
      // os cartões novos entram no fim da fila, já fora da borda, antes de qualquer coisa se mexer
      const last = cards[cards.length - 1]!.slide;
      const add = Array.from({ length: by }, (_, i) => makeCard(wrap(last + 1 + i)));
      strip.append(...add.map((c) => c.el));
      cards.push(...add);
      layout(false);
      column -= by;
    } else {
      // voltando, a faixa cresce no começo: os novos entram como lâminas fora da borda esquerda
      const first = cards[0]!.slide;
      const add = Array.from({ length: -by }, (_, i) => makeCard(wrap(first + by + i)));
      strip.prepend(...add.map((c) => c.el));
      cards.unshift(...add);
      column = by;
      layout(false);
      column = 0;
    }
    layout(true);
    panel(true);
    if (focus) front()?.el.focus({ preventScroll: true });
    timer = window.setTimeout(settle, ms() + 30);
  }

  /** Vai até um ambiente pelo caminho mais curto. */
  function go(to: number): void {
    const d = wrap(to - open());
    if (d) step(d <= count() / 2 ? d : d - count());
  }

  // Cliques: na lâmina ou coluna, abre; na foto aberta, amplia
  strip.addEventListener('click', (e) => {
    if (swiped) return;
    const el = (e.target as Element).closest<HTMLButtonElement>('.sq-card');
    if (!el) return;
    const p = cards.findIndex((c) => c.el === el);
    const col = p + column;
    if (col > 0) step(col);
    else if (col === 0) {
      show(open());
      dlg.showModal();
      track('gallery_open', { photo: tpl(open()).dataset.caption });
    }
  });

  // Mouse em cima alarga a coluna
  strip.addEventListener('mousemove', (e) => {
    const el = (e.target as Element).closest<HTMLButtonElement>('.sq-card');
    const p = el ? cards.findIndex((c) => c.el === el) : -1;
    const col = p < 0 ? -1 : p + column;
    if (col === hover) return;
    hover = col;
    layout(true);
  });
  strip.addEventListener('mouseleave', () => {
    if (hover === -1) return;
    hover = -1;
    layout(true);
  });

  strip.addEventListener('keydown', (e) => {
    const by = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!by) return;
    e.preventDefault();
    step(by, true);
  });
  prevBtn.addEventListener('click', () => step(-1));
  nextBtn.addEventListener('click', () => step(1));

  // Arrastar para os lados
  let down: { id: number; x: number; y: number } | null = null;
  let swiped = false;
  row.addEventListener('pointerdown', (e) => {
    down = { id: e.pointerId, x: e.clientX, y: e.clientY };
    swiped = false;
  });
  row.addEventListener('pointerup', (e) => {
    const start = down;
    down = null;
    if (!start || start.id !== e.pointerId) return;
    const dx = e.clientX - start.x;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(e.clientY - start.y)) {
      swiped = true;
      step(dx < 0 ? 1 : -1);
      setTimeout(() => (swiped = false), 0);
    }
  });
  row.addEventListener('pointercancel', () => (down = null));

  // Lightbox (ampliar)
  const img = dlg.querySelector<HTMLImageElement>('[data-lb-img]')!;
  const cap = dlg.querySelector<HTMLElement>('[data-lb-caption]')!;
  let current = 0;
  const show = (slide: number) => {
    current = wrap(slide);
    const t = tpl(current);
    img.srcset = t.dataset.full ?? '';
    img.src = t.dataset.fullDefault ?? '';
    img.alt = t.dataset.alt ?? '';
    cap.textContent = t.dataset.caption ?? '';
  };
  dlg.querySelector('[data-lb-prev]')!.addEventListener('click', () => show(current - 1));
  dlg.querySelector('[data-lb-next]')!.addEventListener('click', () => show(current + 1));
  dlg.querySelector('[data-lb-close]')!.addEventListener('click', () => dlg.close());
  dlg.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') show(current - 1);
    if (e.key === 'ArrowRight') show(current + 1);
  });
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg) dlg.close();
  });
  // Ao fechar, o carrossel para na última foto vista na ampliação
  dlg.addEventListener('close', () => {
    go(current);
    front()?.el.focus({ preventScroll: true });
  });

  // Filtros
  const buttons = [...root.querySelectorAll<HTMLButtonElement>('[data-filter]')];
  buttons.forEach((btn) =>
    btn.addEventListener('click', () => {
      const f = btn.dataset.filter!;
      buttons.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      slides = all.filter((t) => f === 'todos' || t.dataset.type === f);
      build();
      live.textContent = `${count()} ambientes: ${btn.textContent?.trim() ?? ''}`;
    }),
  );

  // Celular ↔ desktop muda o número de lâminas: remonta a fila
  let slatsNow = getComputedStyle(row).getPropertyValue('--sq-slats');
  new ResizeObserver(() => {
    const s = getComputedStyle(row).getPropertyValue('--sq-slats');
    if (s === slatsNow) return;
    slatsNow = s;
    build();
  }).observe(root);

  // Cartões fora da borda não contam como "na tela" para o lazy loading: carrega quando a seção se aproxima
  const io = new IntersectionObserver(
    ([e]) => {
      if (!e!.isIntersecting) return;
      eager = true;
      strip.querySelectorAll<HTMLImageElement>('img[loading="lazy"]').forEach((im) => (im.loading = 'eager'));
      io.disconnect();
    },
    { rootMargin: '600px 0px' },
  );
  io.observe(root);

  build();
}
