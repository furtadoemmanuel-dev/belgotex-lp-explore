/** Cores escolhidas na página (compositor e matriz), compartilhadas com o WhatsApp, a amostra e o formulário. */
export interface Selection {
  /** ids das cores, por exemplo "frontier-202" (no máximo 3, na ordem em que foram escolhidas). */
  colors: string[];
  /** true depois que a pessoa escolhe algo (antes disso não pré-preenchemos nada). */
  chosen: boolean;
}

export const MAX_COLORS = 3;
const selection: Selection = { colors: [], chosen: false };

export const getSelection = (): Readonly<Selection> => selection;

export function setSelection(colors: string[]): void {
  selection.colors = colors.slice(0, MAX_COLORS);
  selection.chosen = selection.colors.length > 0;
  document.dispatchEvent(new CustomEvent('selection:change', { detail: { ...selection } }));
}

/** "frontier-202" → "Frontier 202" */
export const colorLabel = (id: string): string =>
  id.replace(/^(\w)(\w*)-(\d+)$/, (_, a: string, b: string, n: string) => `${a.toUpperCase()}${b} ${n}`);
