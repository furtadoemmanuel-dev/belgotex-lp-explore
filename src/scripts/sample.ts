// Pedido de amostra pelo correio (Sample.astro): painel em 2 etapas (cores → contato e endereço).
// Qualquer link/botão com data-sample-open abre o painel. data-sample-color pré-marca uma cor (ou várias, separadas por espaço); sem ele, entram
// as cores já escolhidas na página (compositor ou matriz).
import { createLeadProvider, submitLead, type SampleLeadPayload } from '../lib/lead';
import { isValidCEP, isValidEmail, isValidPhoneBR, maskCEP, maskPhoneBR } from '../lib/validation';
import { colorLabel, getSelection } from './state';
import { getUtms } from './utm';
import { track } from './analytics';

const MIN_FILL_MS = 3000;
const MAX_COLORS = 3; // amostras por pedido (definição da Belgotex)

type Rule = (f: HTMLFormElement) => string;
const val = (f: HTMLFormElement, n: string) =>
  ((f.elements.namedItem(n) as HTMLInputElement | HTMLSelectElement | null)?.value ?? '').trim();
const checkedColors = (f: HTMLFormElement) =>
  [...f.querySelectorAll<HTMLInputElement>('input[name="colors"]:checked')].map((i) => i.value);

const rules: Record<string, Rule> = {
  colors: (f) => {
    const n = checkedColors(f).length;
    if (!n) return 'Escolha pelo menos uma cor.';
    return n > MAX_COLORS ? `Escolha até ${MAX_COLORS} cores por pedido.` : '';
  },
  profile: (f) => (val(f, 'profile') ? '' : 'Selecione o seu perfil.'),
  name: (f) => (val(f, 'name').length >= 3 ? '' : 'Informe o nome completo de quem vai receber.'),
  email: (f) =>
    isValidEmail(val(f, 'email')) ? '' : 'Informe um e-mail válido, por exemplo nome@empresa.com.br.',
  phone: (f) =>
    isValidPhoneBR(val(f, 'phone')) ? '' : 'Informe um telefone com DDD, por exemplo (42) 99999-0000.',
  cep: (f) => (isValidCEP(val(f, 'cep')) ? '' : 'Informe o CEP com 8 números.'),
  street: (f) => (val(f, 'street').length >= 3 ? '' : 'Informe a rua ou avenida.'),
  number: (f) => (val(f, 'number') ? '' : 'Informe o número (ou "s/n").'),
  district: (f) => (val(f, 'district').length >= 2 ? '' : 'Informe o bairro.'),
  city: (f) => (val(f, 'city').length >= 2 ? '' : 'Informe a cidade.'),
  uf: (f) => (val(f, 'uf') ? '' : 'Selecione a UF.'),
  consent: (f) =>
    (f.elements.namedItem('consent') as HTMLInputElement).checked
      ? ''
      : 'Para enviar, é preciso concordar com o uso dos dados.',
};
const STEP: Record<number, string[]> = {
  1: ['colors', 'profile'],
  2: ['name', 'email', 'phone', 'cep', 'street', 'number', 'district', 'city', 'uf', 'consent'],
};

export function initSample(): void {
  const dlg = document.querySelector<HTMLDialogElement>('[data-sample-dialog]');
  const form = document.querySelector<HTMLFormElement>('[data-sample-form]');
  if (!dlg || !form) return;
  const provider = createLeadProvider(form.dataset.endpoint ?? '');
  const steps = [...form.querySelectorAll<HTMLFieldSetElement>('[data-sp-step]')];
  const label = form.querySelector<HTMLElement>('[data-sp-step-label]')!;
  const progress = form.querySelector<HTMLElement>('[data-sp-progress]')!;
  const progress2 = form.querySelector<HTMLElement>('[data-sp-progress-2]')!;
  const errorBox = form.querySelector<HTMLElement>('[data-sp-error]')!;
  const success = form.querySelector<HTMLElement>('[data-sp-success]')!;
  const summary = form.querySelector<HTMLElement>('[data-sp-summary]')!;
  const submitBtn = form.querySelector<HTMLButtonElement>('[data-sp-submit]')!;
  let step = 1;
  let openedAt = 0;
  let origin = 'direct';
  let opener: HTMLElement | null = null;
  let started = false;
  const boxes = [...form.querySelectorAll<HTMLInputElement>('input[name="colors"]')];
  const count = form.querySelector<HTMLElement>('[data-sp-count]')!;
  // Limite de cores: ao chegar em MAX_COLORS, as não marcadas ficam desabilitadas
  const syncLimit = () => {
    const n = checkedColors(form).length;
    for (const b of boxes) b.disabled = !b.checked && n >= MAX_COLORS;
    count.textContent = !n
      ? 'Nenhuma cor escolhida.'
      : n >= MAX_COLORS
        ? `${n} de ${MAX_COLORS} cores escolhidas. Para trocar, desmarque uma.`
        : `${n} de ${MAX_COLORS} cores escolhidas.`;
  };
  form.addEventListener('change', (e) => {
    if ((e.target as HTMLInputElement).name === 'colors') syncLimit();
  });

  const setError = (name: string, msg: string) => {
    const out = form.querySelector<HTMLElement>(`[data-sp-error-for="${name}"]`);
    if (out) out.textContent = msg;
    const el = form.elements.namedItem(name);
    if (el instanceof HTMLElement && name !== 'colors') {
      if (msg) el.setAttribute('aria-invalid', 'true');
      else el.removeAttribute('aria-invalid');
    }
  };
  const validate = (names: string[]): boolean => {
    let first: string | null = null;
    for (const n of names) {
      const msg = rules[n]!(form);
      setError(n, msg);
      if (msg) {
        track('sample_error', { field: n });
        first ??= n;
      }
    }
    if (!first) return true;
    const el =
      first === 'colors'
        ? form.querySelector<HTMLElement>('input[name="colors"]')
        : (form.elements.namedItem(first) as HTMLElement);
    el?.focus();
    return false;
  };
  // revalida enquanto a pessoa corrige
  const revalidate = (e: Event) => {
    const n = (e.target as HTMLInputElement).name;
    if (rules[n] && form.querySelector(`[data-sp-error-for="${n}"]`)?.textContent)
      setError(n, rules[n]!(form));
  };
  form.addEventListener('input', revalidate);
  form.addEventListener('change', revalidate);

  const phone = form.elements.namedItem('phone') as HTMLInputElement;
  phone.addEventListener('input', () => (phone.value = maskPhoneBR(phone.value)));
  const cep = form.elements.namedItem('cep') as HTMLInputElement;
  cep.addEventListener('input', () => (cep.value = maskCEP(cep.value)));

  const goTo = (n: number) => {
    step = n;
    steps.forEach((s) => (s.hidden = Number(s.dataset.spStep) !== n));
    progress2.classList.toggle('on', n === 2);
    label.textContent = n === 1 ? 'Etapa 1 de 2 · Cores' : 'Etapa 2 de 2 · Entrega pelo correio';
  };

  // Abrir: qualquer [data-sample-open] da página
  document.addEventListener('click', (e) => {
    const el = (e.target as Element).closest<HTMLElement>('[data-sample-open]');
    if (!el) return;
    e.preventDefault();
    opener = el;
    origin = el.dataset.loc ?? 'direct';
    // pré-marca a cor do botão ou as cores já escolhidas na página
    const pre = el.dataset.sampleColor
      ? el.dataset.sampleColor.split(' ').filter(Boolean)
      : getSelection().chosen
        ? [...getSelection().colors]
        : [];
    if (success.hidden) {
      // pré-marca no máximo MAX_COLORS (uma composição pode ter mais cores)
      for (const id of pre) {
        if (checkedColors(form).length >= MAX_COLORS) break;
        const box = form.querySelector<HTMLInputElement>(`input[name="colors"][value="${id}"]`);
        if (box) box.checked = true;
      }
      syncLimit();
    }
    openedAt = Date.now();
    dlg.showModal();
    track('sample_open', { origin });
  });
  const close = () => dlg.close();
  form.querySelector('[data-sample-close]')!.addEventListener('click', close);
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg) close();
  });
  dlg.addEventListener('close', () => opener?.focus());

  form.addEventListener('focusin', () => {
    if (started) return;
    started = true;
    track('sample_start', { origin });
  });

  form.querySelector('[data-sp-next]')!.addEventListener('click', () => {
    if (!validate(STEP[1]!)) return;
    goTo(2);
    track('sample_step', { step: 2, colors: checkedColors(form).join(',') });
    (form.elements.namedItem('name') as HTMLInputElement).focus();
  });
  form.querySelector('[data-sp-back]')!.addEventListener('click', () => {
    goTo(1);
    form.querySelector<HTMLElement>('input[name="colors"]')?.focus();
  });
  // Enter na etapa 1 avança em vez de enviar
  form.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && step === 1 && (e.target as HTMLElement).tagName === 'INPUT') {
      e.preventDefault();
      form.querySelector<HTMLButtonElement>('[data-sp-next]')!.click();
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (step === 1) return;
    errorBox.hidden = true;
    if (!validate(STEP[2]!)) return;
    const colors = checkedColors(form);
    const done = () => {
      steps.forEach((s) => (s.hidden = true));
      progress.hidden = true;
      label.textContent = 'Pedido enviado';
      summary.textContent = colors.map(colorLabel).join(', ');
      success.hidden = false;
      success.focus();
    };
    // Proteção: honeypot e tempo mínimo de preenchimento (falha silenciosa para robôs)
    if (val(form, 'website') || Date.now() - openedAt < MIN_FILL_MS) return done();
    const payload: SampleLeadPayload = {
      lead_type: 'amostra',
      name: val(form, 'name'),
      phone: val(form, 'phone'),
      email: val(form, 'email'),
      profile: val(form, 'profile'),
      colors,
      company: val(form, 'company'),
      cep: val(form, 'cep'),
      street: val(form, 'street'),
      number: val(form, 'number'),
      complement: val(form, 'complement'),
      district: val(form, 'district'),
      city: val(form, 'city'),
      uf: val(form, 'uf'),
      consent: true,
      consent_text: form.dataset.consentText ?? '',
      campaign_code: form.dataset.campaign ?? '',
      click_origin: origin,
      page_url: location.href.split('#')[0]!,
      ...getUtms(),
      submitted_at: new Date().toISOString(),
    };
    // Sem integração (LEAD_ENDPOINT) e com SAMPLE_EMAIL: abre o e-mail da pessoa com o pedido preenchido
    const to = form.dataset.email;
    if (!form.dataset.endpoint && to) {
      const profileLabel =
        (form.elements.namedItem('profile') as HTMLSelectElement).selectedOptions[0]?.text ?? payload.profile;
      const href = sampleMailto(to, { ...payload, profile: profileLabel }, colors.map(colorLabel));
      track('sample_submit', { perfil: payload.profile, colors: colors.join(','), uf: payload.uf, channel: 'email' });
      done();
      success.querySelector<HTMLElement>('[data-sp-success-title]')!.textContent = 'Falta só enviar o e-mail';
      success.querySelector<HTMLElement>('[data-sp-success-text]')!.hidden = true;
      const mail = success.querySelector<HTMLElement>('[data-sp-mail]')!;
      mail.hidden = false;
      mail.querySelector<HTMLAnchorElement>('[data-sp-mail-link]')!.href = href;
      window.location.href = href;
      return;
    }
    submitBtn.setAttribute('aria-busy', 'true');
    submitBtn.disabled = true;
    try {
      await submitLead(payload, provider);
      track('sample_submit', { perfil: payload.profile, colors: colors.join(','), uf: payload.uf });
      done();
    } catch {
      track('sample_error', { field: 'submit' });
      errorBox.hidden = false;
    } finally {
      submitBtn.removeAttribute('aria-busy');
      submitBtn.disabled = false;
    }
  });
}

/** Pedido de amostra como e-mail (mailto) para quem atende as amostras, com todos os dados do formulário. */
function sampleMailto(to: string, p: SampleLeadPayload, names: string[]): string {
  const lines = [
    'Olá! Gostaria de receber amostras do carpete modular Explore.',
    '',
    `Cores: ${names.join(', ')}`,
    '',
    `Nome: ${p.name}`,
    `Perfil: ${p.profile}`,
    ...(p.company ? [`Empresa: ${p.company}`] : []),
    `E-mail: ${p.email}`,
    `Telefone: ${p.phone}`,
    '',
    'Endereço de entrega:',
    `${p.street}, ${p.number}${p.complement ? ` – ${p.complement}` : ''}`,
    `${p.district} – ${p.city}/${p.uf}`,
    `CEP ${p.cep}`,
    '',
    `Código: ${p.campaign_code} · origem: ${p.click_origin}`,
  ];
  const subject = `Pedido de amostra Explore – ${p.name}`;
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\n'))}`;
}
