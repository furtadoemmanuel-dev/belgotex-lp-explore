/**
 * Configuração da LP. Lida no build a partir das variáveis de ambiente (ver .env.example).
 * Os valores entram no HTML estático; nenhum segredo deve ser colocado aqui.
 */
const env = import.meta.env;

const read = (key: string, fallback: string): string => {
  // String(): o Vite entrega "true"/"false" do ambiente já como booleano
  const value = String(env[key] ?? '').trim();
  return value ? value : fallback;
};

export const config = {
  whatsappNumber: read('WHATSAPP_NUMBER', '5542991391436').replace(/\D/g, ''),
  campaignCode: read('CAMPAIGN_CODE', 'LP-EXPLORE'),
  leadEndpoint: read('LEAD_ENDPOINT', ''),
  /** "Solicitar cotação" leva à página do Explore no site com o formulário de cotação já aberto (#cotacao). */
  quoteUrl: read('QUOTE_URL', 'https://www.belgotex.com.br/produtos/comercial-em-placas/explore#cotacao'),
  /** Pedido de amostra: e-mail que recebe o pedido (abre o programa de e-mail da pessoa, já preenchido). */
  sampleEmail: read('SAMPLE_EMAIL', 'lucas.boita@belgotex.com.br'),
  simulatorUrl: read('SIMULATOR_URL', 'https://www.belgotex.com.br/produtos/comercial-em-placas/explore'),
  privacyUrl: read('PRIVACY_URL', 'https://www.belgotex.com.br/politica-de-privacidade'),
  cookiesUrl: read('COOKIES_URL', 'https://www.belgotex.com.br/politica-de-cookies'),
  gtmId: read('GTM_ID', 'GTM-PB78XKMK'),
  siteUrl: read('SITE_URL', 'https://explore.belgotex.com.br'),
  /** Versão de aprovação (npm run build:approval): pede aos buscadores para não indexar. */
  noindex: read('NOINDEX', '') === 'true',
  productUrl: 'https://www.belgotex.com.br/produtos/comercial-em-placas/explore',
  mainSiteUrl: 'https://www.belgotex.com.br',
} as const;

export type Config = typeof config;
