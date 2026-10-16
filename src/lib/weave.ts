/**
 * Lógica do compositor "Combine & Multiplique", usada no build (primeira pintura) e no navegador.
 * A grade representa placas de 50 × 50 cm; a paginação é sempre a Tecelagem (cada placa gira 90° em
 * relação às vizinhas), a única indicada no catálogo do Explore.
 */
export type Mode = 'mistura' | 'xadrez' | 'faixas';

export const COLS = 10;
export const ROWS = 7;
export const TILE_M = 0.5;
export const M2_PER_BOX = 5;
export const TILES_PER_BOX = 20; // 5 m² ÷ (0,5 m × 0,5 m)

/** Giro da placa na Tecelagem. */
export const weaveRotation = (x: number, y: number): number => ((x + y) % 2 ? 90 : 0);

/** Gerador pseudoaleatório com semente (mulberry32): a mesma semente sempre dá a mesma mistura. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Índice da cor (0 a k-1) de cada placa, linha a linha. */
export function layout(k: number, mode: Mode, seed = 1, cols = COLS, rows = ROWS): number[] {
  const n = cols * rows;
  if (k <= 1) return new Array(n).fill(0);
  if (mode === 'xadrez') return Array.from({ length: n }, (_, i) => ((i % cols) + Math.floor(i / cols)) % k);
  if (mode === 'faixas') return Array.from({ length: n }, (_, i) => Math.floor((i % cols) / 2) % k);
  // Mistura equilibrada: o mesmo número de placas de cada cor, embaralhado
  const out = Array.from({ length: n }, (_, i) => i % k);
  const r = rng(seed);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Estimativa de caixas por cor, na proporção da composição (sem recortes nem reserva). */
export function boxes(areaM2: number, shares: number[]): { total: number; perColor: number[] } {
  const perColor = shares.map((s) => Math.ceil((areaM2 * s) / M2_PER_BOX));
  return { total: perColor.reduce((a, b) => a + b, 0), perColor };
}
