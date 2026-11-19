// Accessibility of our own screens (section 5.4): axe-core without WCAG A/AA violations,
// buttons at least 48 px high, base text at least 18 px, and no horizontal scroll at 360 px.
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { CODE, resetEnv, setEnv, enterAsGuest, loginHost } from './helpers.ts';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function audit(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const summary = results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
  expect(summary, `${label}: violaciones axe`).toEqual([]);
  const small = await page.$$eval('button, a.btn, input[type="text"], input[type="password"]', (els) =>
    els.filter((e) => (e as HTMLElement).offsetParent !== null && e.getBoundingClientRect().height < 48).map((e) => (e.textContent || (e as HTMLInputElement).id || e.tagName).trim()));
  expect(small, `${label}: controles de menos de 48 px`).toEqual([]);
  const fontPx = await page.$eval('body', (b) => parseFloat(getComputedStyle(b).fontSize));
  expect(fontPx, `${label}: texto base`).toBeGreaterThanOrEqual(18);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${label}: desplazamiento horizontal`).toBeLessThanOrEqual(0);
}

test.beforeEach(async ({ request }) => { await resetEnv(request); });

for (const width of [360, 1280]) {
  test.describe(`${width} px`, () => {
    test.use({ viewport: { width, height: 800 } });

    test(`entrada de invitado @a11y`, async ({ page }) => {
      await page.goto(`/?c=${CODE}`);
      await page.getByLabel('Tu nombre y apellido').waitFor();
      await audit(page, 'entrada de invitado');
      await page.getByRole('button', { name: 'Entrar a la reunión' }).click();
      await page.getByRole('alert').waitFor();
      await audit(page, 'entrada de invitado con error');
    });

    test(`invitado sin código @a11y`, async ({ page }) => {
      await page.goto('/');
      await page.getByRole('alert').waitFor();
      await audit(page, 'invitado sin código');
    });

    test(`«Saliste de la reunión» @a11y`, async ({ page }) => {
      await enterAsGuest(page);
      await page.getByTestId('sala-ensayo').waitFor();
      await audit(page, 'sala de ensayo');
      await page.getByRole('button', { name: 'Salir' }).click();
      await page.getByRole('heading', { name: 'Saliste de la reunión' }).waitFor();
      await audit(page, 'saliste de la reunión');
    });

    test(`aviso de respaldo (409 y dentro de la sala) @a11y`, async ({ page, request }) => {
      await page.clock.install();
      await enterAsGuest(page);
      await page.getByTestId('sala-ensayo').waitFor();
      await setEnv(request, { FALLBACK_URL: 'https://respaldo.example/sala-81' });
      await page.clock.fastForward('01:01');
      await page.getByRole('link', { name: /Nos cambiamos de sala/ }).waitFor();
      await audit(page, 'aviso dentro de la sala');
      await page.goto('/anfitrion'); // leave room
      await setEnv(request, { FALLBACK_URL: null });
      await page.goto(`/?c=${CODE}`);
      await setEnv(request, { FALLBACK_URL: 'https://respaldo.example/sala-81' });
      await page.getByLabel('Tu nombre y apellido').fill('Carlos Prueba');
      await page.getByLabel('¿Desde qué ciudad nos acompañas?').fill('Toronto');
      await page.getByRole('button', { name: 'Entrar a la reunión' }).click();
      await page.getByRole('heading', { name: 'Nos cambiamos de sala' }).waitFor();
      await audit(page, 'pantalla de respaldo');
    });

    test(`entrada de anfitrión, sala y diagnóstico @a11y`, async ({ page, request }) => {
      await page.goto('/anfitrion');
      await page.getByLabel('Clave del anfitrión').waitFor();
      await audit(page, 'entrada de anfitrión');
      await loginHost(page);
      await audit(page, 'pestaña Sala');
      await setEnv(request, { RTK_MEETING_ID: null, FALLBACK_URL: 'http://invalida.example' });
      await page.getByRole('tab', { name: 'Diagnóstico' }).click();
      await page.getByRole('button', { name: 'Crear la reunión' }).waitFor();
      await audit(page, 'diagnóstico con fallas');
      await page.getByRole('button', { name: 'Crear la reunión' }).click();
      await page.getByTestId('meeting-id').waitFor();
      await audit(page, 'diagnóstico con reunión creada');
    });
  });
}
