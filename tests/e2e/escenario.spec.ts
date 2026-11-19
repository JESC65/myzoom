// Acceptance scenario in mock mode (section 13, steps 2–10). Step 1 lives in demo.spec.ts.
import { test, expect } from '@playwright/test';
import { CODE, HOST_SECRET, resetEnv, setEnv, enterAsGuest, loginHost } from './helpers.ts';

test.beforeEach(async ({ request }) => { await resetEnv(request); });

test('2 · invitado sin código: pide el enlace en el grupo', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('Pide el enlace en el grupo de la promoción');
  await expect(page.getByLabel('Tu nombre y apellido')).toHaveCount(0);
  await expect(page.getByText('Si no ves o no oyes, abre este enlace en Chrome o Safari.')).toBeVisible();
});

test('3 · invitado con código errado: enlace no válido', async ({ page }) => {
  await page.goto('/?c=codigo-errado');
  await page.getByLabel('Tu nombre y apellido').fill('Carlos Prueba');
  await page.getByLabel('¿Desde qué ciudad nos acompañas?').fill('Toronto');
  await page.getByRole('button', { name: 'Entrar a la reunión' }).click();
  await expect(page.getByRole('alert')).toHaveText('El enlace no es válido. Pide el enlace actualizado en el grupo de la promoción.');
});

test('4 · invitado correcto entra a la Sala de ensayo y al volver su nombre ya está escrito', async ({ page }) => {
  await page.goto(`/?c=${CODE}`);
  await expect(page.getByText('Del ')).toContainText('(hora de Lima)');
  await enterAsGuest(page);
  await expect(page.getByTestId('sala-ensayo')).toBeVisible();
  await expect(page.getByTestId('nombre-visible')).toHaveText('Carlos Prueba · Toronto');
  await expect(page.getByTestId('rol')).toHaveText('invitado');
  await page.goto(`/?c=${CODE}`);
  await expect(page.getByLabel('Tu nombre y apellido')).toHaveValue('Carlos Prueba');
  await expect(page.getByLabel('¿Desde qué ciudad nos acompañas?')).toHaveValue('Toronto');
});

test('4b · salir muestra «Saliste de la reunión» y «Volver a entrar» pide una credencial nueva', async ({ page }) => {
  await enterAsGuest(page);
  await page.getByRole('button', { name: 'Salir' }).click();
  await expect(page.getByRole('heading', { name: 'Saliste de la reunión' })).toBeVisible();
  const joinReq = page.waitForRequest((r) => r.url().endsWith('/api/entrar') && r.method() === 'POST');
  await page.getByRole('button', { name: 'Volver a entrar' }).click();
  await joinReq;
  await expect(page.getByTestId('sala-ensayo')).toBeVisible();
});

test('4c · validación en pantalla: nombre vacío', async ({ page }) => {
  await page.goto(`/?c=${CODE}`);
  await page.getByLabel('Tu nombre y apellido').fill('');
  await page.getByLabel('¿Desde qué ciudad nos acompañas?').fill('Lima');
  await page.getByRole('button', { name: 'Entrar a la reunión' }).click();
  await expect(page.getByRole('alert')).toContainText('Escribe tu nombre y apellido');
  await expect(page.getByLabel('Tu nombre y apellido')).toBeFocused();
});

test('5 · intento de escalar con preset_name de anfitrión recibe credencial de invitado', async ({ request, baseURL }) => {
  const res = await request.post('/api/entrar', {
    headers: { Origin: baseURL! },
    data: { nombre: 'Intruso Prueba', ciudad: 'Lima', codigo: CODE, preset_name: 'group_call_host', role: 'host', isHost: true },
  });
  expect(res.status()).toBe(200);
  expect(res.headers()['x-myzoom-mock-preset']).toBe('group_call_participant');
  expect((await res.json()).authToken).toMatch(/^mock-/);
});

test('6 · fuera de horario: antes y después, con los dos mensajes correctos', async ({ page, request }) => {
  await setEnv(request, { EVENT_OPENS_AT: '2098-11-21T08:00:00-05:00', EVENT_CLOSES_AT: '2098-11-22T06:00:00-05:00' });
  await enterAsGuest(page);
  await expect(page.getByRole('alert')).toHaveText('La reunión todavía no empieza. Se abre el viernes 21 de noviembre a las 8:00 a. m. (hora de Lima).');
  await setEnv(request, { EVENT_OPENS_AT: '2020-11-21T08:00:00-05:00', EVENT_CLOSES_AT: '2020-11-22T06:00:00-05:00' });
  await page.getByRole('button', { name: 'Entrar a la reunión' }).click();
  await expect(page.getByRole('alert')).toHaveText('La reunión ya terminó. ¡Gracias por acompañarnos!');
});

test('7 · anfitrión: clave errada, clave correcta, recarga sin clave y cierre de sesión', async ({ page }) => {
  await page.goto('/anfitrion');
  await page.getByLabel('Clave del anfitrión').fill('clave-equivocada');
  await page.getByRole('button', { name: 'Entrar como anfitrión' }).click();
  await expect(page.getByRole('alert')).toHaveText('La clave del anfitrión no es correcta.');
  await page.getByLabel('Clave del anfitrión').fill(HOST_SECRET);
  await page.getByRole('button', { name: 'Entrar como anfitrión' }).click();
  await expect(page.getByRole('tab', { name: 'Sala' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Diagnóstico' })).toBeVisible();
  // the secret is not stored in the browser nor in the URL
  const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }) + location.href);
  expect(stored).not.toContain(HOST_SECRET);
  await page.reload();
  await expect(page.getByRole('tab', { name: 'Sala' })).toBeVisible();
  await page.getByRole('button', { name: 'Entrar a la sala' }).click();
  await expect(page.getByTestId('rol')).toHaveText('anfitrión');
  await expect(page.getByTestId('nombre-visible')).toHaveText('Salón · Promoción 81');
  await page.getByRole('button', { name: 'Salir' }).click();
  await page.getByRole('button', { name: 'Cerrar sesión de anfitrión' }).click();
  await expect(page.getByLabel('Clave del anfitrión')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Clave del anfitrión')).toBeVisible();
});

test('8 · diagnóstico: modo ensayo, ventana, presets simulados y enlace con Copiar', async ({ page }) => {
  await loginHost(page);
  await page.getByRole('tab', { name: 'Diagnóstico' }).click();
  await expect(page.getByTestId('modo')).toContainText('ENSAYO');
  await expect(page.getByText('Ventana horaria')).toBeVisible();
  await expect(page.getByText('«group_call_participant» existe en la aplicación.')).toBeVisible();
  await expect(page.getByText('«group_call_host» existe en la aplicación.')).toBeVisible();
  const link = page.getByLabel('Enlace de invitación');
  await expect(link).toHaveValue(new RegExp(`/\\?c=${CODE}$`));
  await page.getByRole('button', { name: 'Copiar enlace para WhatsApp' }).click();
  await expect(page.getByText('Copiado ✓')).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(`?c=${CODE}`);
  await page.getByRole('button', { name: 'Volver a comprobar' }).click();
  await expect(page.getByTestId('modo')).toContainText('ENSAYO');
});

test('9 · reunión por crear: botón «Crear la reunión» muestra el identificador simulado', async ({ page, request }) => {
  await setEnv(request, { RTK_MEETING_ID: null });
  await loginHost(page);
  await page.getByRole('tab', { name: 'Diagnóstico' }).click();
  await page.getByRole('button', { name: 'Crear la reunión' }).click();
  await expect(page.getByTestId('meeting-id')).toHaveValue(/^mock-meeting-/);
  await expect(page.getByText('pégalo en Cloudflare como la variable RTK_MEETING_ID')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Crear la reunión' })).toHaveCount(0);
});

test('10a · respaldo: /?c=… redirige sin reenviar el código', async ({ request }) => {
  await setEnv(request, { FALLBACK_URL: 'https://respaldo.example/sala-81' });
  const res = await request.get(`/?c=${CODE}`, { maxRedirects: 0 });
  expect(res.status()).toBe(302);
  expect(res.headers()['location']).toBe('https://respaldo.example/sala-81');
  expect(res.headers()['location']).not.toContain(CODE);
  expect(res.headers()['cache-control']).toBe('no-store');
});

test('10b · respaldo: quien ya estaba dentro ve el aviso en menos de 70 s', async ({ page, request }) => {
  await page.clock.install();
  await enterAsGuest(page);
  await expect(page.getByTestId('sala-ensayo')).toBeVisible();
  await setEnv(request, { FALLBACK_URL: 'https://respaldo.example/sala-81' });
  await page.clock.fastForward('01:01');
  const banner = page.getByRole('link', { name: 'Nos cambiamos de sala. Toca aquí para ir a la sala de respaldo.' });
  await expect(banner).toBeVisible({ timeout: 5_000 });
  await expect(banner).toHaveAttribute('href', '/');
});

test('10c · respaldo: quien tenía el formulario abierto recibe 409 y un botón grande', async ({ page, request }) => {
  await page.goto(`/?c=${CODE}`);
  await setEnv(request, { FALLBACK_URL: 'https://respaldo.example/sala-81' });
  await page.getByLabel('Tu nombre y apellido').fill('Carlos Prueba');
  await page.getByLabel('¿Desde qué ciudad nos acompañas?').fill('Toronto');
  await page.getByRole('button', { name: 'Entrar a la reunión' }).click();
  await expect(page.getByRole('heading', { name: 'Nos cambiamos de sala' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Ir a la sala de respaldo' })).toHaveAttribute('href', 'https://respaldo.example/sala-81');
});

test('10d · respaldo: /anfitrion sigue funcionando', async ({ page, request }) => {
  await setEnv(request, { FALLBACK_URL: 'https://respaldo.example/sala-81' });
  await loginHost(page);
  await page.getByRole('tab', { name: 'Diagnóstico' }).click();
  await expect(page.getByText('Respaldo ACTIVO')).toBeVisible();
});

test('navegador interno de WhatsApp: aviso destacado con «Copiar enlace»', async ({ browser }) => {
  const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36 WhatsApp/2.24', permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await ctx.newPage();
  await page.goto(`/?c=${CODE}`);
  await page.getByRole('button', { name: 'Copiar enlace' }).click();
  await expect(page.getByText('Enlace copiado')).toBeVisible();
  await ctx.close();
});
