# belgotex-lp-explore

Landing page do carpete modular **Explore** (Belgotex), feita pela Ample Sample.
Site estático em Astro, criado a partir da base aprovada da LP Timberland SPC (tag `v01-aprovada`), com a mesma
hierarquia de fontes, marca e componentes. Endereço sugerido: `explore.belgotex.com.br`.

**Público:** arquitetos e especificadores, facility management e mercado corporativo.

## Status

- 13/10/2026: versão de trabalho (sem briefing do cliente). Conteúdo tirado do catálogo `cat_Explore v5.pdf` e da
  página do produto no site. Pendências em `docs/pendencias-explore.md`.

## Rodar localmente

```bash
npm install
cp .env.example .env      # ajuste os valores
npm run dev               # http://localhost:4321
```

## Build e verificação

```bash
npm run build             # astro check + build + guarda de conteúdo (pendências só avisam)
npm run build:prod        # igual, mas falha se houver [[PENDENTE]] na página
npm test                  # Playwright + axe (390, 768, 1280 px)
node qa/sections.mjs http://localhost:4321/ 390   # capturas por seção em qa/screens
```

## Assets

`python3 scripts/prepare-assets.py` regera tudo a partir de `../arquivos do fornecedor/Explore`:

- `src/assets/cores/`: as 39 texturas, uma por cor.
- `src/assets/ambientes/`: renders 3D, sem as duas duplicadas (`explore10 (1)` e `explore13`).
- `src/assets/catalogo/`: fotos tiradas de dentro do PDF: a capa (montada a partir dos blocos, sem os textos), as
  fotos de obra das p. 22 a 27 e a tecelagem (p. 38).
- `src/assets/badges/`: selos da p. 37, renderizados do vetor do PDF.

## Link de aprovação (Cloudflare Pages)

```bash
CLOUDFLARE_ACCOUNT_ID=b4aa71c58d0fc31f1644eb86ff4d4a50 npm run deploy:approval
```

Build com `NOINDEX=true` e envio ao projeto **`belgotex-explore`** (`https://belgotex-explore.pages.dev`), separado
do projeto da Timberland. A LP não tem formulário de cotação: todos os botões "Solicitar cotação" levam à página do
Explore no site com o formulário de cotação aberto (`#cotacao`, ver `docs/cotacao-site.md`). O pedido de amostra
abre o e-mail da pessoa para `SAMPLE_EMAIL` (sem e-mail definido, fica em modo simulado).

## Configuração (`.env`)

| Variável | Para quê |
|---|---|
| `WHATSAPP_NUMBER` | Número do consultor (padrão: o mesmo do site, `554291391436`) |
| `CAMPAIGN_CODE` | Código na mensagem do WhatsApp e no lead (`LP-EXPLORE`) |
| `LEAD_ENDPOINT` | Destino do pedido de amostra (integração). Vazio = e-mail (`SAMPLE_EMAIL`) ou modo simulado |
| `QUOTE_URL` | "Solicitar cotação": página do Explore no site com `#cotacao` (UTM por botão) |
| `SAMPLE_EMAIL` | E-mail que recebe os pedidos de amostra (XP): abre o programa de e-mail da pessoa já preenchido |
| `SIMULATOR_URL` | "Ver no meu ambiente" (hoje, a página do produto) |
| `PRIVACY_URL`, `COOKIES_URL` | Políticas da Belgotex |
| `GTM_ID` | Google Tag Manager; carregado só depois do aceite de cookies |
| `NOINDEX` | `true` só na versão de aprovação |
| `SITE_URL` | Endereço final da LP |

## Seções

Hero (carrossel com transição "morph" em WebGL, `src/scripts/morph.ts`, com a abertura em círculo como reserva + faixa de placas em Tecelagem) · A coleção (números) · **Designs e cores** (matriz
6 × 6 + 3 exclusivas, painel com SketchUp por cor) · **Combine & Multiplique** (compositor de paginação) · Mesmo
espaço, outro tom · Ambientes · Para quem decide (abas: especificação, facility, empresas) · Amostras · Fabricado
no Brasil · Garantia, certificações e documentos · FAQ · Rodapé (cortina "Pronto para explorar?" + folha
institucional). Cotação: no site da Belgotex (`src/components/QuoteLink.astro`).

## Rastreamento (`dataLayer`)

`cta_click`, `whatsapp_click {colors}`, `color_select`, `composer_change {reason, colors, mode}`, `composer_view`,
`composer_arrows`, `composer_area`, `tone_swap`, `audience_tab`, `gallery_open`, `document_download`,
`badge_group_expand`, `sample_open`, `sample_start`, `sample_step`, `sample_error`, `sample_submit {colors, channel}`,
`section_view`, `scroll_depth`, `consent_update`. **KPI = `cta_click` de cotação (`data-cta="quote"`, ida ao site) +
`sample_submit` + `whatsapp_click`.**
