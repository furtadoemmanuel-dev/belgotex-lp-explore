const DDDS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38, 41, 42, 43, 44, 45, 46,
  47, 48, 49, 51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69, 71, 73, 74, 75, 77, 79, 81, 82, 83, 84, 85,
  86, 87, 88, 89, 91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

export const onlyDigits = (v: string): string => v.replace(/\D/g, '');

/** Telefone BR com DDD: fixo (10 dígitos) ou celular (11 dígitos começando com 9). */
export function isValidPhoneBR(v: string): boolean {
  const d = onlyDigits(v);
  if (d.length !== 10 && d.length !== 11) return false;
  if (!DDDS.has(Number(d.slice(0, 2)))) return false;
  if (d.length === 11 && d[2] !== '9') return false;
  return true;
}

export function maskPhoneBR(v: string): string {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export const isValidEmail = (v: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

/** CEP: 8 dígitos. */
export const isValidCEP = (v: string): boolean => onlyDigits(v).length === 8;

export function maskCEP(v: string): string {
  const d = onlyDigits(v).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}
