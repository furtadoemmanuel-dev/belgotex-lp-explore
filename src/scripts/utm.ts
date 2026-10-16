const KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const;
const STORE = 'lp_explore_utm';
let memory: Record<string, string> = {};

/** Lê UTMs da URL. Só persiste no localStorage depois do consentimento. */
export function captureUtms(): void {
  const params = new URLSearchParams(location.search);
  const found = Object.fromEntries(KEYS.filter((k) => params.get(k)).map((k) => [k, params.get(k)!]));
  if (Object.keys(found).length) memory = found;
}

export function persistUtms(): void {
  try {
    if (Object.keys(memory).length) localStorage.setItem(STORE, JSON.stringify(memory));
  } catch {
    /* armazenamento indisponível */
  }
}

export function getUtms(): Record<string, string> {
  if (Object.keys(memory).length) return memory;
  try {
    return JSON.parse(localStorage.getItem(STORE) || '{}');
  } catch {
    return {};
  }
}
