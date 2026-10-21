# LP Explore: pendências e decisões (13/10/2026)

Sem briefing do cliente. A LP segue a proposta de `../ANALISE_LP_EXPLORE.md`.

## Marcadas na página (`[[PENDENTE]]`)

1. Removido da página (17/10/2026), a pedido do Emmanuel: o marcador das condições da garantia de performance de 10 anos. O selo e o texto "conforme o selo do catálogo" continuam.
2. **Dados técnicos:** reação ao fogo, desempenho acústico, peso total e uso sobre piso elevado (ficha do Explore).

## Para confirmar com a Belgotex

- **Antiviral:** a ficha (p. 37) diz "antimicrobiano e antiviral, 99%". O selo Microshield e o site dizem
  "antibacteriano". A LP usa o texto da ficha, com as normas.
- **Fotos de obra (p. 22 a 27):** usadas a partir do PDF, com a legenda do catálogo (Frontier 203). Pedir os originais
  em alta e o nome do projeto, para um case.
- **Lounge Horizon:** o nome do arquivo diz 608 + 609; a legenda do catálogo (p. 34) diz 607 e 609. A LP usa o arquivo.
- **Vista de cima (explore8 a 15):** os arquivos não trazem o código da cor. A LP mostra só o tom (cinza, bege, azul,
  grafite) e manda confirmar o código com o consultor.
- **Sala de reunião (explore6):** sem legenda de cor.
- **Nomes dos tons** (bege, marrom, azul claro, azul-marinho, cinza, grafite, areia, cinza claro, verde-oliva): são
  descrições nossas para explicar o sistema; o catálogo só usa os códigos.
- **Frontier 201:** a única cor sem arquivo SketchUp no site.
- **Navigator 502:** textura em baixa resolução (591 px).
- **Amostras:** quantas cores por pedido? A Belgotex envia para escritórios e empresas?
- **Kit de especificação:** os documentos estão abertos (como no site). Se a Belgotex quiser gerar lead de arquiteto,
  dá para pedir e-mail antes do download.
- **Piso elevado:** a LP usa o texto do FAQ do site para carpete modular em geral.

## Erros do catálogo que a LP não repete

- "Cada **rolo** de carpete" (p. 39): na LP, "cada placa".
- "**Explorer**" (p. 34 e 36): na LP, "Explore".

## Configuração (igual à Timberland)

RD (`LEAD_ENDPOINT`), GTM, subdomínio (`explore.belgotex.com.br`?), Roomvo, equipe do WhatsApp.

## Cotação e amostra (como no Timberland v02)

- **Cotação:** sem formulário na LP; os botões levam à página do Explore no site com `#cotacao`. Pedir ao
  desenvolvedor do site o ajuste de `docs/cotacao-site.md` para o modal abrir já com o Explore selecionado.
- **E-mail do XP para as amostras (`SAMPLE_EMAIL`):** pendente. Até lá o pedido de amostra fica em modo simulado.
- **WhatsApp do XP (`WHATSAPP_NUMBER`):** pendente; hoje é o número do site.

## Correções do PDF do cliente (21/10/2026)

- Hero: "Seis designs, 9 cores e infinitas possibilidades pensados para funcionar juntos."; saiu "39 cores em 6 designs".
- "A coleção": "Explore existe para…" (sem "O"); números 6 designs · 9 cores · 99% (saiu o "33 comercial pesado").
- "9 cores" também no rodapé e na descrição da página; a matriz diz "39 combinações".
- Designs numerados 1 a 6 (sem o zero).
- Linha do tempo dos selos removida: os selos ficam só nos cards de grupo, logo abaixo.

## Resolvido pelo site da Belgotex (21/10/2026)

- Ficha técnica completa ("Especificações Completas" da página do Explore, atualizada em 01/10/2026): reação ao
  fogo, ΔLw = 21 dB, αw = 0,30, peso total 3.815 g/m², reciclado 47,40%, LEED v4 / WELL etc. Marcador removido;
  `npm run build:prod` passa.
- Antiviral: a ficha do site confirma "tratamento antimicrobiano e antiviral" (99%). O selo Microshield segue com o
  texto do selo.
- Piso elevado: o guia de instalação do site autoriza, desde que nivelado, sem defeitos e limpo (FAQ atualizado).
- Roomvo: desconsiderado (o Emmanuel confirmou que não haverá subdomínio). "Ver no meu ambiente" leva à página do
  produto, onde o site já carrega o plug-in da Roomvo.
- Hospedagem, DNS e publicação: com o desenvolvedor do site.

## Decisões do Emmanuel (21/10/2026)

- Amostras: até 3 cores por pedido (limite no formulário; não mencionar quem pode pedir).
- Contatos: os mesmos do Timberland. SAMPLE_EMAIL = lucas.boita@belgotex.com.br; WhatsApp (42) 99139-1436.
- Legendas (identificadas comparando os renders com as texturas oficiais; o site não legenda as fotos):
  vistas de cima = Frontier 205 (cinza), 201 (bege), 203 (azul), 206 (grafite); sala de reunião = Frontier 206;
  lounge verde = Horizon 608 + 609 (o atalho "Lounge" do compositor passou de 607 para 608); o outro lounge = 607.
- Nomes dos tons: mantidos.
- Documentos para especificadores: continuam livres para baixar.
