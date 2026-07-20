import { Page, expect } from '@playwright/test';

export const EMAIL = process.env.ESTACIONAMIENTOS_EMAIL || 'fernando@rym-solutions.com';
export const PASSWORD = process.env.ESTACIONAMIENTOS_PASSWORD || 'RYM_solutions';

export async function login(page: Page, email: string = EMAIL, password: string = PASSWORD) {
  await page.goto('/index.php/login');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]:has-text("Iniciar sesión")').click();
  await page.waitForLoadState('domcontentloaded', { timeout: 30000 });
}

export async function logout(page: Page) {
  await page.locator('a, button', { hasText: 'Salir' }).first().click();
  await page.waitForLoadState('domcontentloaded', { timeout: 15000 });
}

export async function assertLoggedIn(page: Page) {
  await expect(page).toHaveURL(/dashboard/i, { timeout: 15000 });
}
