// Matriz design × tom: escolher uma cor atualiza o painel (textura em Tecelagem, cores do mesmo tom e ações).
// Passar o mouse numa célula acende a coluna do tom, para mostrar que a coluna inteira combina.
import { byId, getColors, matches, type ColorData } from './colors';
import { track } from './analytics';

export function initDesigns(): void {
  const root = document.querySelector<HTMLElement>('#designs');
  const table = root?.querySelector<HTMLTableElement>('[data-matrix]');
  const detail = root?.querySelector<HTMLElement>('[data-detail]');
  if (!root || !table || !detail) return;
  const texts = JSON.parse(document.getElementById('designs-data')?.textContent ?? '{}') as Record<
    string,
    { title: string; text: string }
  >;
  const imgs = [...detail.querySelectorAll<HTMLImageElement>('[data-d-img]')];
  const $ = (sel: string) => detail.querySelector<HTMLElement>(sel)!;
  const swatches = [...root.querySelectorAll<HTMLButtonElement>('.sw[data-color]')];
  let current = 'frontier-203';

  const markColumn = (tone: string | null) => {
    table.querySelectorAll('[data-col]').forEach((el) => {
      if (tone && (el as HTMLElement).dataset.col === tone) el.setAttribute('data-col-on', '');
      else el.removeAttribute('data-col-on');
    });
  };

  const renderMatches = (c: ColorData) => {
    const list = $('[data-d-match]');
    list.replaceChildren(
      ...matches(c).map((m) => {
        const li = document.createElement('li');
        const b = document.createElement('button');
        b.type = 'button';
        b.dataset.pick = m.id;
        const img = document.createElement('img');
        img.src = m.thumb;
        img.alt = '';
        img.width = img.height = 28;
        b.append(img, m.name);
        li.append(b);
        return li;
      }),
    );
  };

  function select(id: string, user = true): void {
    const c = byId(id);
    if (!c) return;
    current = id;
    swatches.forEach((s) => s.setAttribute('aria-pressed', String(s.dataset.color === id)));
    imgs.forEach((img) => (img.src = c.large));
    $('[data-d-tone]').textContent = c.tone.length === 3 ? `${c.tone} · ${c.toneLabel} (exclusiva)` : `${c.tone} · ${c.toneLabel}`;
    $('[data-d-name]').textContent = c.name;
    $('[data-d-title]').textContent = texts[c.design]?.title ?? '';
    $('[data-d-text]').textContent = texts[c.design]?.text ?? '';
    const skp = detail!.querySelector<HTMLAnchorElement>('[data-d-skp]')!;
    skp.hidden = !c.skp;
    if (c.skp) skp.href = c.skp;
    $('[data-d-sample]').dataset.sampleColor = c.id;
    renderMatches(c);
    markColumn(c.tone.length === 3 ? null : c.tone);
    if (user) {
      detail!.classList.remove('swap');
      void detail!.offsetWidth;
      detail!.classList.add('swap');
      track('color_select', { color: c.id, design: c.design, tone: c.tone, location: 'designs' });
    }
  }

  root.addEventListener('click', (e) => {
    const t = e.target as Element;
    const sw = t.closest<HTMLButtonElement>('.sw[data-color]');
    if (sw) return select(sw.dataset.color!);
    const pick = t.closest<HTMLButtonElement>('[data-pick]');
    if (pick) {
      select(pick.dataset.pick!);
      root.querySelector<HTMLButtonElement>(`.sw[data-color="${pick.dataset.pick}"]`)?.focus({ preventScroll: true });
      return;
    }
    if (t.closest('[data-d-add]')) {
      document.dispatchEvent(new CustomEvent('composer:add', { detail: { id: current } }));
      document.getElementById('combine')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }
  });

  // Coluna do tom acende no hover (só mouse)
  table.addEventListener('pointerover', (e) => {
    if ((e as PointerEvent).pointerType !== 'mouse') return;
    const td = (e.target as Element).closest<HTMLElement>('td[data-col]');
    if (!td) return;
    table.dataset.hover = '';
    markColumn(td.dataset.col!);
  });
  table.addEventListener('pointerleave', () => {
    delete table.dataset.hover;
    const c = byId(current);
    markColumn(c && c.tone.length === 2 ? c.tone : null);
  });

  // Setas do teclado andam pela matriz
  table.addEventListener('keydown', (e) => {
    const k = e.key;
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(k)) return;
    const td = (e.target as Element).closest('td');
    const tr = td?.parentElement as HTMLTableRowElement | undefined;
    if (!td || !tr) return;
    e.preventDefault();
    const col = (td as HTMLTableCellElement).cellIndex;
    const rows = [...table.tBodies[0]!.rows];
    const r = rows.indexOf(tr);
    const nr = k === 'ArrowUp' ? r - 1 : k === 'ArrowDown' ? r + 1 : r;
    const nc = k === 'ArrowLeft' ? col - 1 : k === 'ArrowRight' ? col + 1 : col;
    rows[Math.max(0, Math.min(rows.length - 1, nr))]?.cells[Math.max(1, Math.min(6, nc))]
      ?.querySelector<HTMLButtonElement>('button')
      ?.focus();
  });

  if (getColors().length) select(current, false);
}
