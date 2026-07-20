const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 60000,
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
  ],
  use: {
    baseURL: process.env.ESTACIONAMIENTOS_PORTAL_URL || 'https://nestacionamientos-dev-62084190654.us-central1.run.app/',
    trace: 'on-first-retry',
    screenshot: 'on',
    video: 'off',
    headless: false,
    viewport: { width: 1366, height: 768 },
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
      use: { video: 'off', screenshot: 'off' },
      timeout: 60000,
    },
    {
      name: 'recon',
      testMatch: /recon\..*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
      timeout: 60000,
    },
    {
      name: 'explorar',
      testMatch: /(?<!recon\.)explorar\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], storageState: 'storageState.json' },
      dependencies: ['setup'],
      timeout: 120000,
    },
    {
      name: 'login-sesion',
      testMatch: /login-sesion\.spec\.ts/,
      // SIN storageState a propósito: estos casos prueban el formulario de
      // login/recuperar/expiración desde cero, cada uno con su propio
      // contexto limpio (no depende de `setup`).
      use: { ...devices['Desktop Chrome'] },
      timeout: 60000,
    },
    {
      name: 'disponibilidad',
      testMatch: /disponibilidad\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], storageState: 'storageState.json' },
      dependencies: ['setup'],
      timeout: 120000,
    },
    {
      name: 'infracciones',
      testMatch: /infracciones\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], storageState: 'storageState.json' },
      dependencies: ['setup'],
      timeout: 120000,
    },
    {
      name: 'estacionamientos',
      testMatch: /estacionamientos\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], storageState: 'storageState.json' },
      dependencies: ['setup'],
      timeout: 120000,
    },
    {
      name: 'combinado',
      testMatch: /combinado\..*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], storageState: 'storageState.json' },
      dependencies: ['setup'],
      timeout: 300000,
    },
  ],
});
