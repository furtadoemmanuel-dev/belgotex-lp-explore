#!/usr/bin/env node
/**
 * Guarda de conteúdo (prompt §5): falha o build se o HTML final tiver termos proibidos pela Belgotex
 * (preço, indicação a revendas, limitações do clic) ou pendências em modo produção.
 *
 *   node scripts/content-guard.mjs                          → modo desenvolvimento: termos proibidos falham, pendências só avisam
 *   CONTENT_GUARD_MODE=production node scripts/content-guard.mjs → pendências também falham
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DIST = new URL('../dist/', import.meta.url).pathname;
const MODE = process.env.CONTENT_GUARD_MODE === 'production' ? 'production' : 'development';

const FORBIDDEN = [
  { id: 'preco-rs', re: /R\$/g },
  { id: 'preco', re: /pre[çc]os?\b/gi },
  { id: 'valor-de', re: /valor(es)? de\b/gi },
  { id: 'revenda', re: /revend(a|as|edor|edores)\b/gi },
  { id: 'onde-comprar', re: /onde comprar/gi },
  { id: 'loja', re: /\blojas?\b/gi },
  { id: 'distribuidor', re: /distribuidor(es|a|as)?\b/gi },
  { id: 'limitacao', re: /limita[çc](ão|ões)/gi },
  { id: 'nao-recomendado', re: /não recomendad[oa]s?/gi },
  { id: 'nao-indicado', re: /não indicad[oa]s?/gi },
];
const PENDING = [/__TODO__/g, /\[\[PENDENTE[^\]]*\]\]/g];

/** Trechos permitidos (removidos antes da verificação). */
const ALLOWLIST = [
  // Opção de perfil exigida pelo briefing no formulário
  /<option value="revenda"[^>]*>Revenda<\/option>/g,
];

const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.html')) files.push(p);
  }
})(DIST);

let errors = 0;
let warnings = 0;
for (const file of files) {
  let html = readFileSync(file, 'utf8');
  for (const allowed of ALLOWLIST) html = html.replace(allowed, '');
  // Ignora URLs de assets (nomes de arquivo gerados) para evitar falsos positivos
  const text = html.replace(/\/_astro\/[^"'\s)]+/g, '');
  const rel = file.replace(DIST, 'dist/');
  for (const { id, re } of FORBIDDEN) {
    for (const m of text.matchAll(re)) {
      errors++;
      console.error(
        `✗ ${rel}: termo proibido [${id}] "${text.slice(Math.max(0, m.index - 40), m.index + 40).replace(/\s+/g, ' ')}"`,
      );
    }
  }
  for (const re of PENDING) {
    for (const m of text.matchAll(re)) {
      if (MODE === 'production') errors++;
      else warnings++;
      console[MODE === 'production' ? 'error' : 'warn'](
        `${MODE === 'production' ? '✗' : '!'} ${rel}: pendência ${m[0]}`,
      );
    }
  }
}

console.log(
  `\nGuarda de conteúdo (${MODE}): ${files.length} arquivo(s), ${errors} erro(s), ${warnings} aviso(s).`,
);
process.exit(errors ? 1 : 0);
