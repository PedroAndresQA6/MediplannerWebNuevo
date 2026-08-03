import { test, expect } from '@playwright/test';
test('system health check', async ({ page }) => {
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });
  page.on('response', response => {
    if (response.status() >= 400) {
      failedRequests.push(`${response.status()} - ${response.url()}`);
    }
  });
  // '/Dashboard' (mayúscula) y waitForLoadState('load') en vez de 'networkidle':
  // el entorno mantiene tráfico constante de GA/Zendesk/Clarity que nunca deja
  // una ventana de 500ms sin requests, así que 'networkidle' nunca se cumple
  // (confirmado en vivo 2026-08-03 — timeout consistente en 2 corridas).
  await page.goto('/Dashboard');
  await page.waitForLoadState('load');
  await page.waitForTimeout(2000);
  const content = await page.content();
  expect(consoleErrors).toEqual([]);
  expect(failedRequests).toEqual([]);
  expect(content).not.toContain('undefined');
  expect(content).not.toContain('NaN');
  expect(content).not.toContain('null');
});