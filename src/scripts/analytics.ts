/** dataLayer mapeado ao KPI (form_submit + whatsapp_click). Os eventos entram no dataLayer sempre; o GTM só carrega após o consentimento. */
type Payload = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    dataLayer: unknown[];
  }
}

export function track(event: string, data: Payload = {}): void {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event, ...data });
  if (import.meta.env.DEV) console.debug('[dataLayer]', event, data);
}

export function initAnalytics(): void {
  // Cliques em CTAs (cotação, amostra, simulador, documentos). WhatsApp tem tratamento próprio.
  document.addEventListener('click', (e) => {
    const el = (e.target as Element).closest<HTMLElement>('[data-cta]');
    if (!el || el.classList.contains('js-wa')) return;
    const type = el.dataset.cta!;
    track('cta_click', { cta_id: el.dataset.ctaId, cta_type: type, location: el.dataset.loc });
    if (el.dataset.doc) track('document_download', { doc_id: el.dataset.doc });
  });

  // section_view: uma vez por seção, ao ficar 40% visível
  const seen = new Set<string>();
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const id = (entry.target as HTMLElement).dataset.sectionId!;
        if (entry.isIntersecting && !seen.has(id)) {
          seen.add(id);
          track('section_view', { section_id: id });
          io.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.4 },
  );
  document.querySelectorAll<HTMLElement>('main [data-section-id]').forEach((s) => io.observe(s));

  // scroll_depth: 25, 50, 75, 90
  const marks = [25, 50, 75, 90];
  const hit = new Set<number>();
  let ticking = false;
  const onScroll = () => {
    ticking = false;
    const doc = document.documentElement;
    const pct = ((window.scrollY + window.innerHeight) / doc.scrollHeight) * 100;
    for (const m of marks) {
      if (pct >= m && !hit.has(m)) {
        hit.add(m);
        track('scroll_depth', { percent: m });
      }
    }
    if (hit.size === marks.length) window.removeEventListener('scroll', schedule);
  };
  const schedule = () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(onScroll);
    }
  };
  window.addEventListener('scroll', schedule, { passive: true });
}
