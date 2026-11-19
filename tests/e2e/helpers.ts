import type { APIRequestContext, Page } from '@playwright/test';
import { E2E_SECRETS } from './test-env.mjs';

export const CODE = E2E_SECRETS.INVITE_CODE;
export const HOST_SECRET = E2E_SECRETS.HOST_SECRET;

export async function resetEnv(request: APIRequestContext) {
  await request.post('/__test/reset');
}

export async function setEnv(request: APIRequestContext, patch: Record<string, string | null>) {
  await request.post('/__test/env', { data: patch });
}

export async function enterAsGuest(page: Page, nombre = 'Carlos Prueba', ciudad = 'Toronto') {
  await page.goto(`/?c=${CODE}`);
  await page.getByLabel('Tu nombre y apellido').fill(nombre);
  await page.getByLabel('¿Desde qué ciudad nos acompañas?').fill(ciudad);
  await page.getByRole('button', { name: 'Entrar a la reunión' }).click();
}

export async function loginHost(page: Page) {
  await page.goto('/anfitrion');
  await page.getByLabel('Clave del anfitrión').fill(HOST_SECRET);
  await page.getByRole('button', { name: 'Entrar como anfitrión' }).click();
  await page.getByRole('tab', { name: 'Sala' }).waitFor();
}
