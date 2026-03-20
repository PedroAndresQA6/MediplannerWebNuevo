const { defineConfig, devices } = require('@playwright/test');
require('dotenv').config({ path: './.env' });

module.exports = defineConfig({
  testDir: './e2e',
  testIgnore: ['tests/**'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: process.env.BASE_URL || 'https://admin-dev.mediplanner.mx/',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  // Define environment variables for tests
  env: {
    MEDIPLANNER_EMAIL: 'dr.walterwhite.mediplanner@gmail.com',
    MEDIPLANNER_PASSWORD: 'Pil8drof.',
    BASE_URL: 'https://admin-dev.mediplanner.mx/',
  },
});