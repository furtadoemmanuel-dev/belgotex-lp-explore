// Compositor "Combine & Multiplique" (Composer.astro). A grade vem pintada do build; aqui ela troca de cor
// numa onda diagonal (cada placa recebe a nova textura numa segunda camada que entra por cima), muda de
// vista (perspectiva ou de cima) e mostra as setas do verso na Tecelagem.
import { boxes, layout, type Mode } from '../lib/weave';
import { byId, type ColorData } from './colors';
import { MAX_COLORS, setSelection } from './state';
import { track } from './analytics';

const group = (c: ColorData) => (c.tone.length === 3 ? 'x' : c.tone);

export function initComposer(): void {
  const root = document.querySelector<HTMLElement>('[data-composer]');
  if (!root) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const floor = root.querySelector<HTMLElement>('[data-floor]')!;
  const view = root.querySelector<HTMLElement>('.c-view')!;
  const tiles = [...floor.querySelectorAll<HTMLElement>('.t')];
  const slots = root.querySelector<HTMLElement>('[data-slots]')!;
  const legend = root.querySelector<HTMLElement>('[data-legend]')!;
  const msg = root.querySelector<HTMLElement>('[data-msg]')!;
  const same = root.querySelector<HTMLInputElement>('[data-same]')!;
  const area = root.querySelector<HTMLInputElement>('[data-area]')!;
  const estimate = root.querySelector<HTMLElement>('[data-estimate]')!;
  const shuffleBtn = root.querySelector<HTMLButtonElement>('[data-shuffle]')!;
  const palette = [...root.querySelectorAll<HTMLButtonElement>('[data-add]')];

  let colors: string[] = JSON.parse(root.dataset.start ?? '[]');
  // No celular a perspectiva deixa as placas pequenas demais: começa na vista de cima
  if (window.matchMedia('(max-width: 639px)').matches) {
    view.dataset.viewMode = 'cima';
    root.querySelectorAll('[data-view]').forEach((b) =>
      b.setAttribute('aria-checked', String((b as HTMLElement).dataset.view === 'cima')),
    );
  }
  let mode: Mode = 'mistura';
  let seed = 1;
  let touched = false;

  const say = (text: string) => {
    msg.textContent = text;
  };

  function paint(animate: boolean): void {
    fill();
    const idx = layout(colors.length, mode, seed);
    tiles.forEach((t, i) => {
      const id = colors.length ? colors[idx[i]!]! : '';
      if (t.dataset.c === id) return;
      t.dataset.c = id;
      const c = id ? byId(id) : undefined;
      const url = c ? `url(${c.tile})` : 'none';
      const [base, top] = t.querySelectorAll<HTMLElement>('.l');
      if (!animate || reduce) {
        base!.style.backgroundImage = url;
        return;
      }
      top!.getAnimations().forEach((a) => a.cancel());
      top!.style.backgroundImage = url;
      const r = getComputedStyle(t).getPropertyValue('--r').trim() || '0deg';
      const d = Number(getComputedStyle(t).getPropertyValue('--d')) || 0;
      const anim = top!.animate(
        [
          { opacity: 0, transform: `rotate(${r}) scale(1.25)`, filter: 'brightness(1.6)' },
          { opacity: 1, transform: `rotate(${r}) scale(1)`, filter: 'brightness(1)' },
        ],
        { duration: 620, delay: d * 34, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'both' },
      );
      anim.onfinish = () => {
        base!.style.backgroundImage = url;
        anim.cancel();
      };
    });
    const names = colors.map((id) => byId(id)!.name);
    floor.setAttribute(
      'aria-label',
      names.length ? `Composição em Tecelagem com ${names.join(', ')}` : 'Composição vazia: escolha uma cor',
    );
  }

  function renderPanel(): void {
    // Vagas
    [...slots.children].forEach((li, i) => {
      const id = colors[i];
      const c = id ? byId(id) : undefined;
      if (c) {
        if ((li.firstElementChild as HTMLElement | null)?.dataset.remove === id) return;
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'slot-on pop';
        b.dataset.remove = c.id;
        b.setAttribute('aria-label', `Remover ${c.name}`);
        b.innerHTML = `<img src="${c.thumb}" width="40" height="40" alt=""><span>${c.name}</span><span class="x" aria-hidden="true">×</span>`;
        li.replaceChildren(b);
      } else {
        const s = document.createElement('span');
        s.className = 'slot-empty';
        s.textContent = i === 0 ? 'Escolha abaixo' : 'Opcional';
        li.replaceChildren(s);
      }
    });
    // Paleta: marcadas e bloqueadas (fora do tom, quando "mesmo tom" está ligado)
    const first = colors[0] ? byId(colors[0]) : undefined;
    const lock = same.checked && first ? group(first) : null;
    palette.forEach((b) => {
      b.setAttribute('aria-pressed', String(colors.includes(b.dataset.add!)));
      const off = lock !== null && (b.dataset.tone === 'x' ? 'x' : b.dataset.tone) !== lock;
      if (off) b.setAttribute('aria-disabled', 'true');
      else b.removeAttribute('aria-disabled');
    });
    // Legenda
    legend.replaceChildren(
      ...colors.map((id) => {
        const c = byId(id)!;
        const li = document.createElement('li');
        li.innerHTML = `<img src="${c.thumb}" width="28" height="28" alt="">${c.name}`;
        return li;
      }),
    );
    shuffleBtn.disabled = mode !== 'mistura' || colors.length < 2;
    renderEstimate();
  }

  function renderEstimate(): void {
    const m2 = Number(area.value.replace(',', '.'));
    if (!m2 || m2 <= 0 || !colors.length) {
      estimate.hidden = true;
      return;
    }
    const idx = layout(colors.length, mode, seed);
    const shares = colors.map((_, k) => idx.filter((v) => v === k).length / idx.length);
    const est = boxes(m2, shares);
    estimate.querySelector('[data-est-total]')!.textContent =
      `≈ ${est.total} ${est.total === 1 ? 'caixa' : 'caixas'} de 5 m²`;
    estimate.querySelector('[data-est-list]')!.replaceChildren(
      ...colors.map((id, k) => {
        const li = document.createElement('li');
        li.textContent = `${byId(id)!.name}: ${est.perColor[k]} ${est.perColor[k] === 1 ? 'caixa' : 'caixas'} (${Math.round(shares[k]! * 100)}%)`;
        return li;
      }),
    );
    estimate.hidden = false;
  }

  function commit(reason: string): void {
    touched = true;
    paint(true);
    renderPanel();
    setSelection(colors);
    track('composer_change', { reason, colors: colors.join(','), mode });
  }

  function add(id: string, from = 'palette'): void {
    const c = byId(id);
    if (!c) return;
    say('');
    if (colors.includes(id)) {
      colors = colors.filter((x) => x !== id);
      return commit('remove');
    }
    const first = colors[0] ? byId(colors[0]) : undefined;
    if (same.checked && first && group(first) !== group(c)) {
      if (from === 'palette') {
        say('Essa cor é de outro tom. Desligue "Só cores do mesmo tom" para misturar tons.');
        return;
      }
      colors = [id];
      say(`Nova composição com ${c.name}, de outro tom.`);
      return commit('add');
    }
    if (colors.length >= MAX_COLORS) {
      colors = [...colors.slice(0, MAX_COLORS - 1), id];
      say(`Máximo de ${MAX_COLORS} cores: ${c.name} entrou no lugar da última.`);
    } else colors = [...colors, id];
    commit('add');
  }

  root.addEventListener('click', (e) => {
    const t = e.target as Element;
    const addBtn = t.closest<HTMLButtonElement>('[data-add]');
    if (addBtn) {
      if (addBtn.getAttribute('aria-disabled') === 'true') {
        say('Essa cor é de outro tom. Desligue "Só cores do mesmo tom" para misturar tons.');
        return;
      }
      return add(addBtn.dataset.add!);
    }
    const rm = t.closest<HTMLButtonElement>('[data-remove]');
    if (rm) {
      colors = colors.filter((x) => x !== rm.dataset.remove);
      say('');
      commit('remove');
      (palette.find((b) => b.dataset.add === rm.dataset.remove) ?? palette[0])?.focus();
      return;
    }
    const preset = t.closest<HTMLButtonElement>('[data-preset]');
    if (preset) {
      colors = JSON.parse(preset.dataset.preset!);
      const mixed = new Set(colors.map((id) => group(byId(id)!))).size > 1;
      if (mixed) same.checked = false;
      say('');
      return commit('preset');
    }
    const m = t.closest<HTMLButtonElement>('[data-mode]');
    if (m) {
      mode = m.dataset.mode as Mode;
      root.querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-checked', String(b === m)));
      return commit('mode');
    }
    if (t.closest('[data-shuffle]')) {
      seed = (seed * 9301 + 49297) % 233280 || 7;
      return commit('shuffle');
    }
    const v = t.closest<HTMLButtonElement>('[data-view]');
    if (v) {
      view.dataset.viewMode = v.dataset.view!;
      root.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-checked', String(b === v)));
      track('composer_view', { view: v.dataset.view });
    }
  });

  // Setas do teclado nos grupos de rádio (vista e distribuição)
  root.querySelectorAll<HTMLElement>('[role="radiogroup"]').forEach((g) =>
    g.addEventListener('keydown', (e) => {
      if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      const items = [...g.querySelectorAll<HTMLButtonElement>('[role="radio"]')];
      const i = items.indexOf(document.activeElement as HTMLButtonElement);
      const next = items[(i + (e.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length]!;
      next.focus();
      next.click();
    }),
  );

  // Antes dos atalhos de amostra, cotação e WhatsApp (que escutam no document), publica as cores atuais
  root.addEventListener(
    'click',
    (e) => {
      if ((e.target as Element).closest('[data-sample-from-composer], [data-cta="quote"], a.js-wa'))
        setSelection(colors);
    },
    true,
  );

  root.querySelector<HTMLInputElement>('[data-arrows]')!.addEventListener('change', (e) => {
    const on = (e.target as HTMLInputElement).checked;
    if (on) floor.dataset.arrows = '';
    else delete floor.dataset.arrows;
    track('composer_arrows', { on });
  });
  same.addEventListener('change', () => {
    say('');
    renderPanel();
  });
  area.addEventListener('input', renderEstimate);
  area.addEventListener('change', () => {
    if (area.value) track('composer_area', { m2: area.value });
  });

  // "Usar na composição" da matriz de cores
  document.addEventListener('composer:add', (e) => add((e as CustomEvent).detail.id as string, 'matrix'));

  // As texturas da grade só carregam quando o compositor se aproxima da tela (não disputam com o hero)
  const fill = () =>
    tiles.forEach((t) => {
      const l = t.querySelector<HTMLElement>('.l[data-bg]');
      if (!l) return;
      l.style.backgroundImage = `url(${l.dataset.bg})`;
      delete l.dataset.bg;
    });
  const near = new IntersectionObserver(
    ([en]) => {
      if (!en!.isIntersecting) return;
      near.disconnect();
      fill();
    },
    { rootMargin: '800px 0px' },
  );
  near.observe(view);

  // Uma primeira "onda" quando o compositor aparece, para mostrar que a grade é viva
  if (!reduce) {
    const io = new IntersectionObserver(
      ([en]) => {
        if (!en!.isIntersecting) return;
        io.disconnect();
        if (touched) return;
        seed = 3;
        paint(true);
      },
      { threshold: 0.45 },
    );
    io.observe(view);
  }

  renderPanel();
}
