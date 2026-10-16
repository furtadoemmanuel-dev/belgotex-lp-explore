/** Dados das 39 cores publicados pela matriz (Designs.astro) em #colors-data. */
export interface ColorData {
  id: string;
  design: string;
  code: string;
  tone: string;
  toneLabel: string;
  hex: string;
  skp: string;
  name: string;
  thumb: string;
  tile: string;
  large: string;
}

let cache: ColorData[] | null = null;

export function getColors(): ColorData[] {
  if (cache) return cache;
  const el = document.getElementById('colors-data');
  cache = el ? (JSON.parse(el.textContent ?? '[]') as ColorData[]) : [];
  return cache;
}

export const byId = (id: string): ColorData | undefined => getColors().find((c) => c.id === id);

/** Cores que combinam: o mesmo tom nos outros designs; nas exclusivas do Horizon, as outras exclusivas. */
export function matches(c: ColorData): ColorData[] {
  const all = getColors();
  const exclusive = c.tone.length === 3;
  return all.filter((x) => x.id !== c.id && (exclusive ? x.tone.length === 3 : x.tone === c.tone));
}
