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
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');
  const content = await page.content();
  expect(consoleErrors).toEqual([]);
  expect(failedRequests).toEqual([]);
  expect(content).not.toContain('undefined');
  expect(content).not.toContain('NaN');
  expect(content).not.toContain('null');
});