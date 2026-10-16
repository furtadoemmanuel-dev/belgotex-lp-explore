import { initAnalytics } from './analytics';
import { initWhatsApp } from './whatsapp';
import { initConsent } from './consent';
import { captureUtms } from './utm';
import { initAperture } from './aperture';
import { initReveal } from './reveal';

export function initPage(cfg: { whatsapp: string; campaign: string; gtmId: string }): void {
  captureUtms();
  initAnalytics();
  initWhatsApp(cfg.whatsapp, cfg.campaign);
  initConsent(cfg.gtmId);
  initAperture();
  initReveal();
  document.querySelector('[data-consent-reopen]')?.addEventListener('click', () => {
    try {
      localStorage.removeItem('lp_explore_consent_v1');
    } catch {
      /* ignora */
    }
    location.reload();
  });
}
