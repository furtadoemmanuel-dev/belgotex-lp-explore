export interface WhatsAppContext {
  number: string;
  campaign: string;
  location: string;
  /** Cores escolhidas na página (matriz ou compositor), por exemplo "Frontier 202, Adventure 302". */
  colors?: string;
}

/** Mensagem em linguagem natural com código da campanha e origem do clique, para a Belgotex filtrar o lead. */
export function whatsappMessage({ campaign, location, colors }: WhatsAppContext): string {
  let text = 'Olá! Vim pela página do carpete modular Explore e gostaria de falar com um consultor.';
  if (colors) text += ` Cores: ${colors}.`;
  return `${text} Código: ${campaign} · origem: ${location}`;
}

export function whatsappHref(ctx: WhatsAppContext): string {
  return `https://wa.me/${ctx.number}?text=${encodeURIComponent(whatsappMessage(ctx))}`;
}
