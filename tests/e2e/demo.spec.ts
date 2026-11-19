// Section 13 step 1: `npm run demo` starts the mock system and prints the addresses.
// Runs the real Wrangler dev server (workerd) through scripts/demo.mjs.
import { test, expect } from '@playwright/test';
import { spawn } from 'node:child_process';

test('1 · npm run demo arranca e imprime las direcciones, el código y la clave de ensayo', async ({ browser }) => {
  test.setTimeout(180_000);
  const port = 8788 + Math.floor(Math.random() * 100);
  const child = spawn(process.execPath, ['scripts/demo.mjs', '--puerto', String(port), '--sin-build'], { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, CI: '1' } });
  let out = '';
  child.stdout.on('data', (d) => { out += d; });
  child.stderr.on('data', (d) => { out += d; });
  try {
    await expect.poll(() => out, { timeout: 120_000, intervals: [1000] }).toContain('MyZoom en modo ensayo está listo');
    expect(out).toContain(`http://localhost:${port}/?c=`);
    expect(out).toContain(`http://localhost:${port}/anfitrion`);
    expect(out).toMatch(/Clave del anfitrión \(ensayo\): \S+/);
    const code = /\/\?c=(\S+)/.exec(out)![1]!;
    const page = await browser.newPage();
    await page.goto(`http://localhost:${port}/?c=${code}`);
    await page.getByLabel('Tu nombre y apellido').fill('Carlos Prueba');
    await page.getByLabel('¿Desde qué ciudad nos acompañas?').fill('Toronto');
    await page.getByRole('button', { name: 'Entrar a la reunión' }).click();
    await expect(page.getByTestId('nombre-visible')).toHaveText('Carlos Prueba · Toronto');
    await page.close();
  } finally {
    child.kill('SIGTERM');
  }
});
