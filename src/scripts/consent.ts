import { persistUtms } from './utm';
import { track } from './analytics';

const KEY = 'lp_explore_consent_v1';
type Choice = 'granted' | 'denied';

declare function gtag(...args: unknown[]): void;

function loadGtm(id: string): void {
  if (!id || document.getElementById('gtm-script')) return;
  window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
  const s = document.createElement('script');
  s.id = 'gtm-script';
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(id)}`;
  document.head.appendChild(s);
}

function apply(choice: Choice, gtmId: string): void {
  gtag('consent', 'update', {
    ad_storage: choice,
    ad_user_data: choice,
    ad_personalization: choice,
    analytics_storage: choice,
  });
  if (choice === 'granted') {
    persistUtms();
    loadGtm(gtmId);
  }
}

export function initConsent(gtmId: string): void {
  const bar = document.querySelector<HTMLElement>('[data-consent-bar]');
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(KEY);
  } catch {
    /* sem armazenamento: pergunta a cada visita */
  }
  if (saved === 'granted' || saved === 'denied') {
    apply(saved, gtmId);
    return;
  }
  if (!bar) return;
  bar.hidden = false;
  bar.addEventListener('click', (e) => {
    const btn = (e.target as Element).closest<HTMLButtonElement>('[data-consent]');
    if (!btn) return;
    const choice = btn.dataset.consent as Choice;
    try {
      localStorage.setItem(KEY, choice);
    } catch {
      /* ignora */
    }
    apply(choice, gtmId);
    track('consent_update', { analytics_storage: choice, ad_storage: choice });
    bar.hidden = true;
  });
}
