import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const CODE = 'LP-EXPLORE';

async function open(page: Page, errors: string[] = []) {
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  // Recusa os cookies para tirar o banner do caminho
  await page.getByRole('button', { name: 'Recusar' }).click();
  return errors;
}

const events = (page: Page) =>
  page.evaluate(() => (window.dataLayer as Record<string, unknown>[]).map((e) => e.event).filter(Boolean));

test('carrega sem erros no console, com um único h1 e sem rolagem lateral', async ({ page }) => {
  const errors = await open(page);
  await expect(page.locator('h1')).toHaveCount(1);
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 30));
    }
  });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});

for (const width of [360, 1024, 1440]) {
  test(`sem rolagem lateral em ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await open(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test('acessibilidade: axe sem violações WCAG 2.2 AA', async ({ page }) => {
  await open(page);
  // Rola a página inteira antes: as entradas suaves ([data-reveal]) só aparecem quando chegam à tela
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 500) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 40));
    }
    // Para na cortina do rodapé (tudo já revelado). No fim da página, um link da folha institucional ficaria
    // embaixo do cabeçalho fixo e o axe acusaria sobreposição de alvos só por causa da posição de rolagem.
    document.documentElement.style.scrollBehavior = 'auto';
    const curtain = document.querySelector('[data-f-curtain]');
    if (curtain) window.scrollTo(0, curtain.getBoundingClientRect().top + window.scrollY);
  });
  await page.waitForTimeout(1200);
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const summary = results.violations.map(
    (v) => `${v.id}: ${v.nodes.length} nó(s) — ${v.nodes[0]?.target.join(' ')}`,
  );
  expect(summary).toEqual([]);
});

test('teclado: link de pular conteúdo e CTA alcançáveis', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Pular para o conteúdo' })).toBeFocused();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  const focused = await page.evaluate(() => document.activeElement?.tagName);
  expect(['A', 'BUTTON']).toContain(focused);
});

test('matriz: escolher uma cor atualiza o painel e mostra as do mesmo tom', async ({ page }) => {
  await open(page);
  await page.locator('#designs').scrollIntoViewIfNeeded();
  await page.locator('#designs .sw[data-color="odyssey-402"]').click();
  await expect(page.locator('[data-d-name]')).toHaveText('Odyssey 402');
  await expect(page.locator('[data-d-tone]')).toContainText('02 · Marrom');
  await expect(page.locator('[data-d-match] button')).toHaveCount(5);
  await expect(page.locator('[data-d-match]')).toContainText('Frontier 202');
  await expect(page.locator('[data-d-skp]')).toHaveAttribute('href', /\.skp$/);
  // Exclusiva do Horizon: combina com as outras exclusivas
  await page.locator('#designs .sw[data-color="horizon-609"]').click();
  await expect(page.locator('[data-d-match] button')).toHaveCount(2);
  expect(await events(page)).toContain('color_select');
});

test('compositor: cores, tom, distribuição, caixas e WhatsApp com as cores', async ({ page, context }) => {
  await open(page);
  await context.route('https://wa.me/**', (r) => r.abort());
  const cmp = page.locator('[data-composer]');
  await cmp.scrollIntoViewIfNeeded();
  // Começa com a combinação "Recepção" do catálogo (3 cores do tom 02)
  await expect(cmp.locator('[data-slots] [data-remove]')).toHaveCount(3);
  await cmp.locator('[data-remove="odyssey-402"]').click();
  await expect(cmp.locator('[data-slots] [data-remove]')).toHaveCount(2);
  // Mesmo tom ligado: cor de outro tom fica bloqueada
  await cmp.locator('[data-add="journey-105"]').click({ force: true }); // aria-disabled: o Playwright não clica sozinho
  await expect(cmp.locator('[data-msg]')).toContainText('outro tom');
  await expect(cmp.locator('[data-slots] [data-remove]')).toHaveCount(2);
  await cmp.locator('[data-add="navigator-502"]').click();
  await expect(cmp.locator('[data-legend] li')).toHaveCount(3);
  await cmp.getByRole('radio', { name: 'Faixas' }).click();
  await expect(cmp.getByRole('radio', { name: 'Faixas' })).toHaveAttribute('aria-checked', 'true');
  await cmp.locator('[data-area]').fill('250');
  await expect(cmp.locator('[data-est-total]')).toContainText('caixas de 5 m²');
  await expect(cmp.locator('[data-est-list] li')).toHaveCount(3);
  const wa = cmp.locator('a.js-wa');
  await wa.evaluate((a) => a.addEventListener('click', (e) => e.preventDefault(), { once: true }));
  await wa.click();
  const href = decodeURIComponent((await wa.getAttribute('href'))!);
  expect(href).toContain('https://wa.me/5542991391436');
  expect(href).toContain('Cores: Frontier 202, Adventure 302, Navigator 502.');
  expect(href).toContain(`Código: ${CODE} · origem: composer`);
  expect(await events(page)).toEqual(expect.arrayContaining(['composer_change', 'whatsapp_click']));
});

test('compositor → amostra já vem com as cores; cotação vai ao site', async ({ page }) => {
  await open(page);
  const cmp = page.locator('[data-composer]');
  await cmp.scrollIntoViewIfNeeded();
  await cmp.getByRole('button', { name: 'Lobby' }).click();
  await cmp.getByRole('link', { name: 'Pedir amostras destas cores' }).click();
  const dlg = page.locator('dialog[data-sample-dialog]');
  await expect(dlg).toBeVisible();
  await expect(dlg.locator('input[name="colors"]:checked')).toHaveCount(2);
  await expect(dlg.locator('input[value="odyssey-403"]')).toBeChecked();
  await dlg.getByRole('button', { name: 'Fechar' }).click();
  const quote = cmp.getByRole('link', { name: /Cotar esta composição/ });
  await expect(quote).toHaveAttribute('href', /explore\?.*utm_content=composer.*#cotacao$/);
  await expect(quote).toHaveAttribute('target', '_blank');
});

test('cotação leva ao site da Belgotex com UTM, sem formulário na página', async ({ page }) => {
  await open(page);
  await expect(page.locator('#cotacao')).toHaveCount(0);
  await expect(page.locator('#lead-form')).toHaveCount(0);
  const links = page.locator('a[data-cta="quote"]');
  expect(await links.count()).toBeGreaterThanOrEqual(8);
  for (const href of await links.evaluateAll((els) => els.map((e) => (e as HTMLAnchorElement).href))) {
    expect(href).toMatch(/^https:\/\/www\.belgotex\.com\.br\/produtos\/comercial-em-placas\/explore\?/);
    expect(href).toContain('utm_source=lp-explore');
    expect(href).toMatch(/#cotacao$/);
  }
  await expect(page.locator('#inicio a[data-cta="quote"]')).toHaveAttribute('target', '_blank');
});

test('amostra: CTA abre o painel, valida padrões e endereço e envia', async ({ page }) => {
  await open(page);
  await page.locator('#amostra').scrollIntoViewIfNeeded();
  await page.getByRole('link', { name: 'Solicitar amostras' }).first().click();
  const dlg = page.locator('dialog[data-sample-dialog]');
  await expect(dlg).toBeVisible();

  await dlg.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.locator('#sp-e-colors')).toHaveText('Escolha pelo menos uma cor.');
  await dlg.locator('label:has(input[name="colors"][value="frontier-203"])').click();
  await dlg.locator('label:has(input[name="colors"][value="horizon-609"])').click();
  await page.selectOption('#sp-profile', 'arquiteto-designer');
  await dlg.getByRole('button', { name: 'Continuar' }).click();

  await dlg.getByRole('button', { name: 'Solicitar amostra' }).click();
  await expect(page.locator('#sp-e-cep')).not.toBeEmpty();
  await page.fill('#sp-name', 'Ana Souza');
  await page.fill('#sp-email', 'ana@estudio.com.br');
  await page.fill('#sp-phone', '42991234567');
  await page.fill('#sp-cep', '84043737');
  await expect(page.locator('#sp-cep')).toHaveValue('84043-737');
  await page.fill('#sp-street', 'Av. José Carlos Gomes');
  await page.fill('#sp-number', '100');
  await page.fill('#sp-district', 'Centro');
  await page.fill('#sp-city', 'Ponta Grossa');
  await page.selectOption('#sp-uf', 'PR');
  await dlg.locator('input[name="consent"]').check();
  await page.waitForTimeout(3100); // tempo mínimo anti-robô
  await dlg.getByRole('button', { name: 'Solicitar amostra' }).click();
  // com o e-mail do XP configurado, o envio abre o e-mail da pessoa já preenchido
  await expect(dlg.getByRole('heading', { name: 'Falta só enviar o e-mail' })).toBeVisible();
  const mail = decodeURIComponent((await dlg.locator('[data-sp-mail-link]').getAttribute('href'))!);
  expect(mail).toMatch(/^mailto:lucas\.boita@belgotex\.com\.br\?/);
  expect(mail).toContain('Cores: Frontier 203, Horizon 609');
  expect(await events(page)).toEqual(expect.arrayContaining(['sample_open', 'sample_step', 'sample_submit']));
});

test('amostra: no máximo 3 cores por pedido', async ({ page }) => {
  await open(page);
  await page.locator('#amostra').scrollIntoViewIfNeeded();
  await page.getByRole('link', { name: 'Solicitar amostras' }).first().click();
  const dlg = page.locator('dialog[data-sample-dialog]');
  await expect(dlg).toBeVisible();
  for (const v of ['journey-101', 'frontier-203', 'horizon-609'])
    await dlg.locator(`label:has(input[name="colors"][value="${v}"])`).click();
  await expect(dlg.locator('input[name="colors"]:checked')).toHaveCount(3);
  await expect(dlg.locator('[data-sp-count]')).toContainText('3 de 3 cores');
  await expect(dlg.locator('input[name="colors"][value="odyssey-403"]')).toBeDisabled();
  await dlg.locator('label:has(input[name="colors"][value="frontier-203"])').click();
  await expect(dlg.locator('input[name="colors"][value="odyssey-403"]')).toBeEnabled();
  await expect(dlg.locator('[data-sp-count]')).toContainText('2 de 3 cores');
});

test('amostra por e-mail: com SAMPLE_EMAIL, o envio abre o e-mail da pessoa já preenchido', async ({ page }) => {
  await open(page);
  // equivale a um build com SAMPLE_EMAIL definido (domínio reservado para exemplos)
  await page.evaluate(() => {
    document.querySelector<HTMLFormElement>('[data-sample-form]')!.dataset.email = 'amostras@example.com';
  });
  await page.locator('#amostra').scrollIntoViewIfNeeded();
  await page.getByRole('link', { name: 'Solicitar amostras' }).first().click();
  const dlg = page.locator('dialog[data-sample-dialog]');
  await dlg.locator('label:has(input[name="colors"][value="journey-102"])').click();
  await page.selectOption('#sp-profile', 'facility');
  await dlg.getByRole('button', { name: 'Continuar' }).click();
  await page.fill('#sp-name', 'Ana Souza');
  await page.fill('#sp-email', 'ana@estudio.com.br');
  await page.fill('#sp-phone', '42991234567');
  await page.fill('#sp-company', 'Estúdio Souza');
  await page.fill('#sp-cep', '84043737');
  await page.fill('#sp-street', 'Av. José Carlos Gomes');
  await page.fill('#sp-number', '100');
  await page.fill('#sp-district', 'Centro');
  await page.fill('#sp-city', 'Ponta Grossa');
  await page.selectOption('#sp-uf', 'PR');
  await dlg.locator('input[name="consent"]').check();
  await page.waitForTimeout(3100);
  await dlg.getByRole('button', { name: 'Solicitar amostra' }).click();
  await expect(dlg.getByRole('heading', { name: 'Falta só enviar o e-mail' })).toBeVisible();
  const href = decodeURIComponent((await dlg.locator('[data-sp-mail-link]').getAttribute('href'))!);
  expect(href).toMatch(/^mailto:amostras@example\.com\?subject=Pedido de amostra Explore/);
  expect(href).toContain('Cores: Journey 102');
  expect(href).toContain('Empresa: Estúdio Souza');
  expect(href).toContain('Perfil: Facility management ou manutenção predial');
});

test('galeria: carrossel squeeze, filtro, ampliação e amostra com as cores da cena', async ({ page }) => {
  await open(page);
  const count = page.locator('[data-sq-count]');
  await expect(count).toHaveText('01 / 12');
  // Clicar numa coluna ao lado abre aquela foto; o texto embaixo troca junto
  await page.locator('[data-sq-strip] .sq-card').nth(2).click();
  await expect(count).toHaveText('03 / 12');
  await expect(page.locator('.sq-copy.on .sq-t')).toHaveText(/Open office/);
  await page.getByRole('button', { name: 'Recepção e convivência', exact: true }).click();
  await expect(count).toHaveText('01 / 05');
  // Clicar na foto aberta amplia
  await page.locator('[data-sq-strip] .sq-card[aria-selected="true"]').click();
  const dlg = page.locator('dialog[data-lightbox]');
  await expect(dlg).toBeVisible();
  const first = await page.locator('[data-lb-caption]').textContent();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('[data-lb-caption]')).not.toHaveText(first!);
  await page.keyboard.press('Escape');
  await expect(dlg).toBeHidden();
  // Ao fechar, o carrossel vai para a última foto vista
  await expect(count).toHaveText('02 / 05');
  expect(await events(page)).toContain('gallery_open');
  // "Pedir amostra destas cores" já marca as cores da cena
  await page.locator('.sq-copy.on .sq-act').click();
  await expect(page.locator('[data-sample-dialog]')).toBeVisible();
  await expect(page.locator('input[name="colors"]:checked')).toHaveCount(2);
});

test('consentimento: nada de GTM antes do aceite e Consent Mode negado por padrão', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-consent-bar]')).toBeVisible();
  const consentDefault = await page.evaluate(() =>
    (window.dataLayer as unknown[]).some(
      (e) =>
        Array.isArray(Array.from(e as ArrayLike<unknown>)) &&
        (e as ArrayLike<unknown>)[0] === 'consent' &&
        (e as ArrayLike<unknown>)[1] === 'default',
    ),
  );
  expect(consentDefault).toBe(true);
  await expect(page.locator('script[src*="googletagmanager"]')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('lp_explore_utm'))).toBeNull();
});

test('SEO: title, description, canonical, OG e JSON-LD sem preço', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Explore/);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /.{80,}/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /^https:\/\//);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /^https:\/\/.+\.jpg$/);
  const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!);
  expect(ld['@type']).toBe('Product');
  expect(ld.offers).toBeUndefined();
  const robots = await page.request.get('/robots.txt');
  expect(await robots.text()).toContain('sitemap-index.xml');
});
