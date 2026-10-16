/**
 * Adaptador de leads com provedor substituível. Destino final: RD (ver docs/integration-rd.md).
 * Sem LEAD_ENDPOINT configurado, usa o provedor simulado: nenhum dado sai do navegador.
 */
export interface LeadPayload {
  name: string;
  phone: string;
  email: string;
  city: string;
  uf: string;
  company: string;
  profile: string;
  needs: string[];
  /** cores de interesse por nome (por exemplo "Frontier 202"), vindas do compositor ou da matriz */
  colors: string[];
  area: string;
  project_phase: string;
  message: string;
  consent: boolean;
  consent_text: string;
  campaign_code: string;
  click_origin: string;
  page_url: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  submitted_at: string;
}

/** Pedido de amostra com envio pelo correio (Sample.astro). */
export interface SampleLeadPayload {
  lead_type: 'amostra';
  name: string;
  phone: string;
  email: string;
  profile: string;
  company: string;
  colors: string[];
  cep: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  uf: string;
  consent: boolean;
  consent_text: string;
  campaign_code: string;
  click_origin: string;
  page_url: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  submitted_at: string;
}

export type AnyLeadPayload = LeadPayload | SampleLeadPayload;

export interface LeadProvider {
  name: string;
  send(payload: AnyLeadPayload): Promise<void>;
}

export const simulatedProvider: LeadProvider = {
  name: 'simulated',
  async send(payload) {
    await new Promise((r) => setTimeout(r, 500));
    if (JSON.stringify(payload).includes('[[simular-erro]]')) throw new Error('Falha simulada');
    console.info('[lead simulado — nenhum dado enviado]', payload);
  },
};

/** POST JSON para um webhook ou função serverless (proxy que guarda o token do RD no servidor). */
export function jsonEndpointProvider(endpoint: string): LeadProvider {
  return {
    name: 'json-endpoint',
    async send(payload) {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    },
  };
}

export const createLeadProvider = (endpoint: string): LeadProvider =>
  endpoint ? jsonEndpointProvider(endpoint) : simulatedProvider;

export async function submitLead(payload: AnyLeadPayload, provider: LeadProvider): Promise<void> {
  await provider.send(payload);
}
