import colorsJson from '../content/colors.json';
import designsJson from '../content/designs.json';
import tonesJson from '../content/tones.json';
import combosJson from '../content/combos.json';
import environmentsJson from '../content/environments.json';
import documentsJson from '../content/documents.json';
import faqJson from '../content/faq.json';
import specsJson from '../content/specs.json';
import badgesJson from '../content/badges.json';

export type DesignId = 'journey' | 'frontier' | 'adventure' | 'odyssey' | 'navigator' | 'horizon';

export interface Color {
  id: string;
  design: DesignId;
  code: string;
  /** "01" a "06" (tom compartilhado) ou "607" a "609" (exclusivas do Horizon) */
  tone: string;
  /** cor média da textura, para pontos e fundos enquanto a imagem carrega */
  hex: string;
  skp: string;
}

export interface Design {
  id: DesignId;
  name: string;
  n: number;
  title: string;
  text: string;
}

export interface Environment {
  id: string;
  type: 'instalado' | 'trabalho' | 'recepcao';
  colors: string[];
  alt: string;
  caption: string;
}

export const colors = colorsJson as Color[];
export const designs = designsJson as Design[];
export const tones = tonesJson as { id: string; label: string; exclusive?: boolean }[];
export const combos = combosJson as { id: string; label: string; colors: string[]; source: string }[];
export const environments = environmentsJson as Environment[];
export const documents = documentsJson;
export const faq = faqJson as { q: string; a: string; cta?: 'consultant' | 'sample' }[];
export const specs = specsJson as typeof specsJson & { rows: string[][] };
export const badges = badgesJson;

export const designName = (id: string): string => designs.find((d) => d.id === id)?.name ?? id;
export const colorName = (c: Color): string => `${designName(c.design)} ${c.code}`;
export const toneLabel = (tone: string): string => tones.find((t) => t.id === tone)?.label ?? tone;
