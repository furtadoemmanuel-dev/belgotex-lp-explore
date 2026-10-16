import { whatsappHref } from '../lib/whatsapp';
import { colorLabel, getSelection } from './state';
import { track } from './analytics';

/** Atualiza o link no clique para incluir as cores escolhidas na página. */
export function initWhatsApp(number: string, campaign: string): void {
  document.addEventListener('click', (e) => {
    const a = (e.target as Element).closest<HTMLAnchorElement>('a.js-wa');
    if (!a) return;
    const sel = getSelection();
    const location = a.dataset.loc ?? 'unknown';
    const colors = sel.chosen ? sel.colors.map(colorLabel).join(', ') : undefined;
    a.href = whatsappHref({ number, campaign, location, colors });
    track('cta_click', { cta_id: `consultant_${location}`, cta_type: 'consultant', location });
    track('whatsapp_click', { location, colors: sel.chosen ? sel.colors.join(',') : '' });
  });
}
