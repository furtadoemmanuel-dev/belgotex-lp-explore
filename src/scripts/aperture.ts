import { createMorph, hideMorph, parsePos, type Morph } from './morph';

// Carrossel do hero. Com WebGL, a foto atual se desfaz em ruído enquanto a próxima aparece (morph.ts);
// sem WebGL, a próxima foto abre num círculo que cresce a partir do clique, com um anel fino na borda. Clique na metade direita avança, na esquerda volta; também aceita
// arrastar, setas do teclado e os botões. Com movimento reduzido vira um fade e não troca sozinho.

/** Raio que cobre uma caixa w×h a partir de (x, y): a distância até o canto mais longe. */
const coverRadius = (x: number, y: number, w: number, h: number) =>
  Math.hypot(Math.max(x, w - x), Math.max(y, h - y));
const wrap = (i: number, n: number) => ((i % n) + n) % n;
const pad2 = (n: number) => String(n).padStart(2, '0');
const EASE = 'cubic-bezier(.7,0,.2,1)';
// Cliques nestes elementos são da página, não do carrossel
const IGNORE = 'a, button, input, select, textarea, .hero-copy, .ap-bar';

export function initAperture(): void {
  const root = document.querySelector<HTMLElement>('[data-aperture]');
  if (!root) return;
  const slides = [...root.querySelectorAll<HTMLElement>('.ap-slide')];
  const n = slides.length;
  if (n < 2) return;

  const captions = JSON.parse(root.dataset.captions ?? '[]') as string[];
  const autoplay = Number(root.dataset.autoplay ?? 0);
  const duration = Number(root.dataset.duration ?? 1100);
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ring = root.querySelector<HTMLElement>('.ap-ring')!;
  const tiles = [...root.querySelectorAll<HTMLElement>('.ap-tile')]; // de trás para a frente
  const cursorLabel = root.querySelector<HTMLElement>('.ap-cursor-label')!;
  const fill = root.querySelector<HTMLElement>('.ap-fill')!;
  const live = root.querySelector<HTMLElement>('[data-ap-live]')!;
  let caption = root.querySelector<HTMLElement>('[data-ap-caption]')!;
  const counter = root.querySelector<HTMLElement>('[data-ap-index]')!;
  const pauseBtn = root.querySelector<HTMLButtonElement>('[data-ap-pause]')!;

  let index = 0;
  let busy = false;
  let userPaused = reduce;
  let hold = false; // fora da tela ou aba em segundo plano
  root.style.setProperty('--ap-dur', `${autoplay}ms`);
  // O morph só é criado na primeira troca: nada de GPU antes de a pessoa (ou o tempo) pedir
  const host = root.querySelector<HTMLElement>('.ap-slides')!;
  let morph: Morph | null | undefined;
  const getMorph = () => {
    if (morph === undefined) morph = reduce ? null : createMorph(host, { duration: Number(root.dataset.morph ?? 1500) });
    return morph && morph.ok() ? morph : null;
  };
  const posOf = (el: HTMLElement) => parsePos(el.style.getPropertyValue('--pos') || '50% 50%');
  if (reduce || !autoplay) root.dataset.static = '';

  // Só baixa as outras fotos depois que a página carregou, para não disputar com a primeira, e só as
  // vizinhas da atual (a próxima e a anterior): no celular isso evita baixar o carrossel inteiro de uma vez
  const hydrate = (slide: HTMLElement) => {
    const img = slide.querySelector<HTMLImageElement>('img[data-srcset]');
    if (!img) return;
    // o recorte vertical do celular (<source>) primeiro, para o navegador já escolher entre os dois
    slide.querySelectorAll<HTMLSourceElement>('source[data-srcset]').forEach((src) => {
      src.srcset = src.dataset.srcset!;
      src.removeAttribute('data-srcset');
    });
    img.srcset = img.dataset.srcset!;
    img.src = img.dataset.src!;
    img.removeAttribute('data-srcset');
  };
  const hydrateNear = () => [1, -1].forEach((d) => hydrate(slides[wrap(index + d, n)]!));
  // No carregamento só a próxima; a anterior entra depois da primeira troca
  const hydrateNext = () => hydrate(slides[wrap(index + 1, n)]!);
  const later = () =>
    setTimeout(() => ('requestIdleCallback' in window ? requestIdleCallback(hydrateNext) : hydrateNext()), 2500);
  if (document.readyState === 'complete') later();
  else window.addEventListener('load', later, { once: true });

  const syncPaused = () => {
    if (userPaused || hold) root.dataset.paused = '';
    else delete root.dataset.paused;
  };
  const runFill = () => {
    fill.classList.remove('run');
    if (reduce || !autoplay || userPaused) return;
    void fill.offsetWidth; // reinicia a animação
    fill.classList.add('run');
  };
  fill.addEventListener('animationend', () => go(1));

  const showCaption = (i: number) => {
    counter.textContent = pad2(i + 1);
    const fresh = caption.cloneNode() as HTMLElement;
    fresh.textContent = captions[i] ?? '';
    caption.replaceWith(fresh); // elemento novo = a animação de subida roda de novo
    caption = fresh;
  };

  async function go(dir: number, x?: number, y?: number): Promise<void> {
    if (busy) return;
    busy = true;
    fill.classList.remove('run');
    const to = wrap(index + dir, n);
    const next = slides[to]!;
    const img = next.querySelector<HTMLImageElement>('img')!;
    hydrate(next);
    try {
      await img.decode();
    } catch {
      /* segue mesmo assim */
    }
    const { width: w, height: h } = root!.getBoundingClientRect();
    const cx = x ?? (dir > 0 ? w * 0.85 : w * 0.15);
    const cy = y ?? h * 0.5;
    const R = coverRadius(cx, cy, w, h);
    const at = ` at ${cx}px ${cy}px)`;
    next.classList.add('is-incoming');
    showCaption(to);

    const m = getMorph();
    const cur = slides[index]!;
    const curImg = cur.querySelector<HTMLImageElement>('img')!;
    if (m && curImg.complete && curImg.naturalWidth && img.naturalWidth) {
      next.classList.remove('is-incoming');
      await m.run(curImg, img, posOf(cur), posOf(next), dir > 0 ? 1 : -1);
      cur.classList.remove('is-current');
      next.classList.add('is-current');
      hideMorph(host);
      index = to;
      busy = false;
      hydrateNear();
      runFill();
      return;
    }

    const anims: Animation[] = [];
    if (reduce) {
      anims.push(next.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, fill: 'both' }));
    } else {
      anims.push(
        next.animate([{ clipPath: `circle(0px${at}` }, { clipPath: `circle(${R}px${at}` }], {
          duration,
          easing: EASE,
          fill: 'both',
        }),
        img.animate([{ transform: 'scale(1.18)' }, { transform: 'scale(1)' }], {
          duration: duration * 1.25,
          easing: 'cubic-bezier(.2,.7,.2,1)',
          fill: 'both',
        }),
      );
      ring.style.width = ring.style.height = `${R * 2}px`;
      const t = `translate(${cx - R}px,${cy - R}px)`;
      anims.push(
        ring.animate(
          [
            { transform: `${t} scale(0)`, opacity: 1 },
            { opacity: 1, offset: 0.7 },
            { transform: `${t} scale(1)`, opacity: 0 },
          ],
          { duration, easing: EASE, fill: 'both' },
        ),
      );
    }
    await anims[0]!.finished.catch(() => undefined);
    slides[index]!.classList.remove('is-current');
    next.classList.add('is-current');
    next.classList.remove('is-incoming');
    // a escala da foto termina depois do círculo; deixa terminar antes de soltar
    anims
      .slice(1)
      .forEach((a) => (a.playState === 'finished' ? a.cancel() : (a.onfinish = () => a.cancel())));
    anims[0]!.cancel();
    index = to;
    busy = false;
    hydrateNear();
    runFill();
  }

  // Ação da pessoa: anuncia a legenda para leitores de tela (na troca automática fica em silêncio)
  const userGo = (dir: number, x?: number, y?: number) => {
    live.setAttribute('aria-live', 'polite');
    void go(dir, x, y);
  };

  root.querySelector('[data-ap-prev]')!.addEventListener('click', () => userGo(-1));
  root.querySelector('[data-ap-next]')!.addEventListener('click', () => userGo(1));
  pauseBtn.addEventListener('click', () => {
    userPaused = !userPaused;
    pauseBtn.setAttribute('aria-pressed', String(userPaused));
    pauseBtn.setAttribute(
      'aria-label',
      userPaused ? 'Retomar troca de ambientes' : 'Pausar troca de ambientes',
    );
    syncPaused();
    if (!userPaused && !fill.classList.contains('run')) runFill();
  });
  root.querySelector('.ap-ctrl')!.addEventListener('keydown', (e) => {
    const k = (e as KeyboardEvent).key;
    if (k !== 'ArrowRight' && k !== 'ArrowLeft') return;
    e.preventDefault();
    userGo(k === 'ArrowRight' ? 1 : -1);
  });

  // Clique / toque / arrasto na foto
  const local = (e: PointerEvent) => {
    const r = root.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width };
  };
  let down: { x: number; y: number } | null = null;
  root.addEventListener('pointerdown', (e) => {
    down = (e.target as Element).closest(IGNORE) ? null : { x: e.clientX, y: e.clientY };
  });
  root.addEventListener('pointerup', (e) => {
    const start = down;
    down = null;
    if (!start) return;
    const p = local(e);
    const dx = e.clientX - start.x;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(e.clientY - start.y)) userGo(dx < 0 ? 1 : -1, p.x, p.y);
    else if (Math.abs(dx) < 8) userGo(p.x >= p.w / 2 ? 1 : -1, p.x, p.y);
  });

  // Cursor de placas (só com mouse e fora do texto e dos controles): a placa da frente segue o mouse de perto,
  // as de trás vêm atrasadas e giradas 90° em relação à da frente, como placas em tecelagem. A seta vira
  // para o lado em que o clique vai levar (metade direita: próximo; esquerda: anterior).
  const LAG = reduce ? [1, 1, 1] : [0.07, 0.13, 0.32]; // de trás para a frente
  const pos = tiles.map(() => ({ x: 0, y: 0 }));
  const target = { x: 0, y: 0 };
  let cursorRaf = 0;
  let placed = false;
  let last = 0;
  const drawCursor = (now: number) => {
    cursorRaf = 0;
    // atraso medido em tempo, não em quadros: igual em telas de 60 e de 120 Hz
    const dt = last ? Math.min(now - last, 64) : 16.7;
    last = now;
    let moving = false;
    tiles.forEach((t, i) => {
      const p = pos[i]!;
      const k = 1 - (1 - LAG[i]!) ** (dt / 16.7);
      // parado, as placas de trás ficam um pouco deslocadas, como uma pilha
      const off = (tiles.length - 1 - i) * 5;
      const tx = target.x + off;
      const ty = target.y + off;
      p.x += (tx - p.x) * k;
      p.y += (ty - p.y) * k;
      if (Math.abs(tx - p.x) > 0.3 || Math.abs(ty - p.y) > 0.3) moving = true;
      // giro leve conforme o atraso, mais o quarto de volta da placa do meio
      const lagRot = (tx - p.x) * 0.08;
      const quarter = i === tiles.length - 2 ? 90 : 0;
      t.style.transform = `translate(${p.x}px,${p.y}px) rotate(${quarter + lagRot}deg)`;
    });
    const front = pos[pos.length - 1]!;
    cursorLabel.style.transform = `translate(${front.x}px,${front.y}px)`;
    if (moving) cursorRaf = requestAnimationFrame(drawCursor);
    else last = 0;
  };
  root.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const over = (e.target as Element).closest(IGNORE);
    root.classList.toggle('lens-on', !over);
    if (over) return;
    const p = local(e);
    target.x = p.x;
    target.y = p.y;
    if (!placed) {
      // primeira entrada: as placas aparecem já no lugar, sem vir voando do canto
      pos.forEach((q) => Object.assign(q, target));
      placed = true;
    }
    const prev = p.x < p.w / 2;
    root.dataset.cursorDir = prev ? 'prev' : 'next';
    const label = prev ? 'Anterior' : 'Próximo';
    if (cursorLabel.textContent !== label) cursorLabel.textContent = label;
    if (!cursorRaf) cursorRaf = requestAnimationFrame(drawCursor);
  });
  root.addEventListener('pointerleave', () => {
    root.classList.remove('lens-on');
    placed = false;
  });
  root.addEventListener('pointerdown', () => root.classList.add('is-pressed'));
  root.addEventListener('pointerup', () => root.classList.remove('is-pressed'));

  // Pausa o tempo quando o hero sai da tela ou a aba fica em segundo plano
  let seen = true;
  const sync = () => {
    hold = !seen || document.hidden;
    syncPaused();
  };
  new IntersectionObserver(([e]) => {
    seen = e!.isIntersecting;
    sync();
  }).observe(root);
  document.addEventListener('visibilitychange', sync);

  syncPaused();
  pauseBtn.setAttribute('aria-pressed', String(userPaused));
  runFill();
}
