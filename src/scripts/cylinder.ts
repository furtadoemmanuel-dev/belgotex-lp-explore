import { track } from './analytics';

// Cilindro de texturas (TextureCylinder.astro), adaptado do ThreeDPhotoCarousel:
// - as placas ficam em volta de um cilindro (rotateY + translateZ) e o anel gira inteiro;
// - gira devagar sozinho com a faixa na tela; para com o mouse em cima, no arrasto e com movimento reduzido;
// - arrastar gira e, ao soltar, o giro continua e desacelera (a "mola" do original);
// - as placas de trás ficam mais apagadas, para a frente do cilindro se destacar;
// - clicar numa placa (sem arrastar) a amplia num dialog, saindo do lugar dela (como o layoutId do original);
// - com o teclado, focar uma placa gira o cilindro até ela ficar de frente.

const AUTO = 7; // graus por segundo
const DRAG = 0.28; // graus por px arrastado
const FRICTION = 3.2; // desaceleração da inércia (por segundo)

export function initCylinder(): void {
  const root = document.querySelector<HTMLElement>('[data-cyl]');
  if (!root) return;
  const scene = root.querySelector<HTMLElement>('[data-cyl-scene]')!;
  const ring = root.querySelector<HTMLElement>('[data-cyl-ring]')!;
  const faces = [...root.querySelectorAll<HTMLButtonElement>('[data-cyl-face]')];
  const dlg = root.querySelector<HTMLDialogElement>('[data-cyl-dialog]')!;
  const big = dlg.querySelector<HTMLImageElement>('[data-cyl-big]')!;
  const cap = dlg.querySelector<HTMLElement>('[data-cyl-cap]')!;
  const n = faces.length;
  const step = 360 / n;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let rot = 0;
  let vel = 0; // graus por segundo (inércia)
  let target: number | null = null; // giro até uma placa (teclado)
  let hover = false;
  let dragging = false;
  let visible = false;
  let raf = 0;
  let last = 0;

  const paint = () => {
    ring.style.setProperty('--rot', `${rot.toFixed(2)}deg`);
    faces.forEach((f, i) => {
      // ângulo da placa em relação a quem olha: 0 = de frente, 180 = de costas
      const a = (((i * step + rot) % 360) + 360) % 360;
      const facing = Math.cos((a * Math.PI) / 180); // 1 de frente, -1 de costas
      f.style.setProperty('--o', (0.12 + 0.88 * Math.max(0, (facing + 0.35) / 1.35)).toFixed(3));
      f.style.setProperty('--b', (0.7 + 0.3 * Math.max(0, facing)).toFixed(3));
      f.tabIndex = facing > 0.6 ? 0 : -1; // só as da frente entram na ordem do Tab
    });
  };

  const frame = (now: number) => {
    raf = 0;
    const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
    last = now;
    let moving = false;
    if (target !== null) {
      const d = target - rot;
      rot += d * Math.min(1, dt * 8);
      if (Math.abs(d) < 0.05) {
        rot = target;
        target = null;
      } else moving = true;
    } else if (!dragging && Math.abs(vel) > 0.5) {
      rot += vel * dt;
      vel *= Math.exp(-FRICTION * dt);
      moving = true;
    } else if (!dragging && !hover && !reduce && !dlg.open) {
      rot -= AUTO * dt;
      moving = true;
    }
    paint();
    if (moving && visible) raf = requestAnimationFrame(frame);
    else last = 0;
  };
  const kick = () => {
    if (!raf && visible) raf = requestAnimationFrame(frame);
  };

  // Arrastar (o toque usa só o movimento para os lados; a rolagem vertical continua com a página)
  let start: { x: number; t: number; moved: number } | null = null;
  scene.addEventListener('pointerdown', (e) => {
    start = { x: e.clientX, t: performance.now(), moved: 0 };
    dragging = true;
    vel = 0;
    target = null;
    kick();
  });
  scene.addEventListener('pointermove', (e) => {
    if (!start) return;
    const dx = e.clientX - start.x;
    const now = performance.now();
    const dt = Math.max(now - start.t, 1) / 1000;
    start.moved += Math.abs(dx);
    if (start.moved > 4 && e.pointerType === 'mouse') scene.setPointerCapture(e.pointerId);
    rot += dx * DRAG;
    vel = (dx * DRAG) / dt; // velocidade do último trecho, para a inércia
    start.x = e.clientX;
    start.t = now;
    paint();
  });
  const release = () => {
    dragging = false;
    vel = Math.max(-500, Math.min(500, vel));
    kick();
  };
  scene.addEventListener('pointerup', (e) => {
    const s = start;
    start = null;
    release();
    if (s && s.moved < 6) {
      const face = (e.target as Element).closest<HTMLButtonElement>('[data-cyl-face]');
      if (face) open(face);
    }
  });
  scene.addEventListener('pointercancel', () => {
    start = null;
    release();
  });
  scene.addEventListener('mouseenter', () => (hover = true));
  scene.addEventListener('mouseleave', () => {
    hover = false;
    kick();
  });
  // O clique do teclado (Enter/Espaço) chega como click sem pointerdown/pointerup
  faces.forEach((f) =>
    f.addEventListener('click', (e) => {
      if ((e as MouseEvent).detail === 0) open(f);
    }),
  );
  // Teclado: focar uma placa traz ela para a frente (pelo caminho mais curto)
  faces.forEach((f, i) =>
    f.addEventListener('focus', () => {
      if (!f.matches(':focus-visible')) return; // foco vindo do mouse/toque: não gira
      const want = -i * step;
      target = rot + ((((want - rot) % 360) + 540) % 360) - 180;
      kick();
    }),
  );

  // Ampliação: a imagem grande sai da posição da placa (FLIP) e volta para ela ao fechar
  let from: HTMLButtonElement | null = null;
  const flip = (el: HTMLElement, r: DOMRect, reverse: boolean) => {
    const to = el.getBoundingClientRect();
    const dx = r.left + r.width / 2 - (to.left + to.width / 2);
    const dy = r.top + r.height / 2 - (to.top + to.height / 2);
    const s = r.width / to.width;
    const frames = [
      { transform: `translate(${dx}px, ${dy}px) scale(${s})`, opacity: 0.6 },
      { transform: 'none', opacity: 1 },
    ];
    return el.animate(reverse ? frames.reverse() : frames, {
      duration: reverse ? 350 : 500,
      easing: 'cubic-bezier(0.32, 0.72, 0, 1)',
      fill: 'both',
    });
  };
  function open(face: HTMLButtonElement): void {
    from = face;
    big.src = face.dataset.big ?? '';
    big.alt = `Textura do carpete modular Explore ${face.dataset.name ?? ''}`;
    cap.textContent = face.dataset.name ?? '';
    dlg.classList.remove('is-closing');
    dlg.showModal();
    if (!reduce) flip(big, face.getBoundingClientRect(), false);
    track('texture_zoom', { color: face.dataset.name });
  }
  const close = async () => {
    if (!dlg.open) return;
    if (!reduce && from) {
      dlg.classList.add('is-closing');
      await flip(big, from.getBoundingClientRect(), true).finished.catch(() => undefined);
    }
    dlg.close();
  };
  dlg.querySelector('[data-cyl-close]')!.addEventListener('click', close);
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg || e.target === big) void close();
  });
  dlg.addEventListener('cancel', (e) => {
    e.preventDefault();
    void close();
  });
  dlg.addEventListener('close', () => {
    big.getAnimations().forEach((a) => a.cancel());
    from?.focus({ preventScroll: true });
    kick();
  });

  new IntersectionObserver(([e]) => {
    visible = e!.isIntersecting;
    if (visible) kick();
  }).observe(scene);
  paint();
}
