import { magnetize } from './magnetic';

// Faixa "Amostras Explore": entrada "pilha → leque" (adaptada do StackLoader da Hyperiux, sem GSAP nem SplitText;
// Web Animations API pura). Quando a faixa chega à tela, uma vez:
// 1. as cinco amostras sobem de baixo empilhadas, uma sobre a outra;
// 2. o título entra palavra por palavra, girando de 90° para 0° (como o SplitText do original);
// 3. a pilha vira uma torre: cada amostra de cima um pouco maior e mais alta, mostrando as bordas de todas;
// 4. a torre se abre no leque final, e o "50 × 50" gigante sobe ao fundo;
// 5. o texto e o botão entram por último, girando como o título.
// No fim, as animações são canceladas e o CSS assume (mesma posição), então o leque volta a abrir com o mouse.
// Sem JavaScript ou com movimento reduzido, tudo aparece pronto e parado. Saindo da tela no meio, termina na hora.

const INTRO = 'cubic-bezier(0.25, 1, 0.5, 1)'; // a INTRO_EASE do original
const IN_OUT = 'cubic-bezier(0.65, 0, 0.35, 1)'; // power3.inOut
const TEXT_FROM = 'perspective(1000px) rotateX(90deg)';
const TEXT_TO = 'perspective(1000px) rotateX(0deg)';
const RISE = 650;
const RISE_STAGGER = 45;
const TOWER_AT = 900;
const TOWER = 900;
const SPREAD_AT = 2000;
const SPREAD = 1000;
const STACK_SCALE_STEP = 0.1;
const STACK_Y_STEP = 0.14; // fração da altura da amostra

export function initSampleFx(): void {
  const card = document.querySelector<HTMLElement>('[data-sc-card]');
  if (!card) return;
  const fan = card.querySelector<HTMLElement>('.sc-fan')!;
  const giant = card.querySelector<HTMLElement>('[data-sc-giant]')!;
  const eyebrow = card.querySelector<HTMLElement>('.sc-eyebrow')!;
  const title = card.querySelector<HTMLElement>('#amostra-title')!;
  const lead = card.querySelector<HTMLElement>('.sc-lead')!;
  const actions = card.querySelector<HTMLElement>('[data-sc-rest] .actions')!;
  const swatches = [...fan.querySelectorAll<HTMLElement>('li')];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  magnetize(card.querySelectorAll<HTMLElement>('[data-magnetic]'));

  // Brilho que respira só com a faixa na tela
  new IntersectionObserver(([e]) => card.classList.toggle('is-live', e!.isIntersecting), {
    rootMargin: '100px 0px',
  }).observe(card);

  if (reduce || !('animate' in card)) return;

  // Título em palavras (o leitor de tela continua lendo a frase inteira: o h2 recebe o texto como rótulo)
  const text = title.textContent?.trim() ?? '';
  title.setAttribute('aria-label', text);
  title.replaceChildren(
    ...text.split(/\s+/).flatMap((w, i) => {
      const s = document.createElement('span');
      s.textContent = w;
      s.setAttribute('aria-hidden', 'true');
      s.style.display = 'inline-block';
      s.style.transformOrigin = '50% 100%';
      return i ? [document.createTextNode(' '), s] : [s];
    }),
  );
  const words = [eyebrow, ...title.querySelectorAll<HTMLElement>('span')];
  const late = [lead, actions];
  const hidden = [...words, ...late, giant, ...swatches];

  // Estado inicial: escondido até a faixa chegar (só com JavaScript; a primeira pintura já sai assim)
  hidden.forEach((el) => (el.style.opacity = '0'));

  let anims: Animation[] = [];
  let started = false;
  let done = false;

  const cleanup = () => {
    if (done) return;
    done = true;
    hidden.forEach((el) => (el.style.opacity = ''));
    anims.forEach((a) => a.cancel()); // o CSS assume, na mesma posição
    anims = [];
  };

  function play(): void {
    started = true;
    const n = swatches.length;
    const mid = (n - 1) / 2;
    const h = swatches[0]!.offsetHeight || 150;
    const step = Math.min(86, Math.max(52, innerWidth * 0.07)); // o mesmo clamp(52px, 7vw, 86px) do CSS
    const t = (x: number, y: number, s: number, r: number) =>
      `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) scale(${s}) rotate(${r}deg)`;

    swatches.forEach((li, i) => {
      const a0 = i * RISE_STAGGER;
      const a1 = a0 + RISE;
      const a2 = TOWER_AT + (n - 1 - i) * 10; // a do topo da pilha começa primeiro, como o stagger "from end"
      const a3 = a2 + TOWER;
      const a4 = SPREAD_AT + (n - 1 - i) * 10;
      const a5 = a4 + SPREAD;
      const D = a5 - a0;
      const at = (ms: number) => (ms - a0) / D;
      const stacked = t(0, 0, 1, 0);
      const tower = t(0, -i * STACK_Y_STEP * h, 1 + i * STACK_SCALE_STEP, 0);
      const final = t((i - mid) * step, Math.abs(i - mid) * 10, 1, (i - mid) * 7);
      anims.push(
        li.animate(
          [
            { offset: 0, transform: t(0, h * 2.2, 1, 0), opacity: 0, easing: INTRO },
            { offset: at(a1), transform: stacked, opacity: 1 },
            { offset: at(a2), transform: stacked, opacity: 1, easing: IN_OUT },
            { offset: at(a3), transform: tower, opacity: 1 },
            { offset: at(a4), transform: tower, opacity: 1, easing: IN_OUT },
            { offset: 1, transform: final, opacity: 1 },
          ],
          { delay: a0, duration: D, fill: 'both' },
        ),
      );
    });

    const flip = (el: HTMLElement, delay: number, duration: number) =>
      anims.push(
        el.animate(
          [
            { transform: TEXT_FROM, opacity: 0 },
            { transform: TEXT_TO, opacity: 1 },
          ],
          { delay, duration, easing: INTRO, fill: 'both' },
        ),
      );
    words.forEach((el, i) => {
      el.style.transformOrigin = '50% 100%';
      flip(el, 450 + i * 80, 900);
    });
    late.forEach((el, i) => flip(el, SPREAD_AT + 250 + i * 120, 900));

    anims.push(
      giant.animate(
        [
          { transform: 'translateY(60px) scale(0.85)', opacity: 0 },
          { transform: 'translateY(0) scale(1)', opacity: 1 },
        ],
        { delay: SPREAD_AT, duration: 1300, easing: INTRO, fill: 'both' },
      ),
    );

    Promise.all(anims.map((a) => a.finished))
      .then(cleanup)
      .catch(() => undefined);
  }

  // Começa quando o topo da faixa passa de 80% da altura da tela. As fotos das amostras carregam antes,
  // para a pilha não subir com quadros vazios.
  const imgs = [...fan.querySelectorAll<HTMLImageElement>('img')];
  new IntersectionObserver(
    ([e], io) => {
      if (!e!.isIntersecting) return;
      imgs.forEach((im) => (im.loading = 'eager'));
      io.disconnect();
    },
    { rootMargin: '600px 0px' },
  ).observe(card);

  new IntersectionObserver(
    ([e]) => {
      if (e!.isIntersecting && !started) {
        const ready = Promise.all(imgs.map((im) => im.decode().catch(() => undefined)));
        const timeout = new Promise((r) => setTimeout(r, 700));
        void Promise.race([ready, timeout]).then(() => {
          if (!started) play();
        });
      } else if (!e!.isIntersecting && started && !done) {
        // Passou direto pela faixa: termina já, para ela estar pronta quando a pessoa voltar
        anims.forEach((a) => a.finish());
      }
    },
    { rootMargin: '0px 0px -20% 0px' },
  ).observe(card);
}
