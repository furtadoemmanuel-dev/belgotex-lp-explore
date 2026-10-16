// Versão de aprovação (npm run build:approval): além da meta robots, o Cloudflare Pages envia o cabeçalho
// X-Robots-Tag em todos os arquivos, para nenhum buscador indexar o link enviado ao cliente.
// Não use no build de produção.
import { writeFileSync } from 'node:fs';

writeFileSync(new URL('../dist/_headers', import.meta.url), '/*\n  X-Robots-Tag: noindex, nofollow\n');
console.log('dist/_headers: X-Robots-Tag noindex (versão de aprovação)');
