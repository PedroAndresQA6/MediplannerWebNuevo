import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const BASE_URL = process.env.BASE_URL || 'https://admin-dev.mediplanner.mx/';

export default defineConfig({
  testDir: './tests',
  timeout: 60000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ['html', { open: 'never' }],
    ['list']
  ],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'on',
    video: 'on',
    headless: false,
    viewport: { width: 1920, height: 1080 },
    actionTimeout: 15000,
    navigationTimeout: 30000,
    launchOptions: {
      slowMo: 50,
    },
  },
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
      timeout: 30000,
    },
    {
      name: 'appointments-create',
      testMatch: /appointments\.create\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'storageState.json',
        viewport: { width: 1920, height: 1080 },
      },
      dependencies: ['setup'],
      timeout: 90000,
    },
    {
      name: 'appointments-verify',
      testMatch: /appointments\.verify\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'storageState.json',
        viewport: { width: 1920, height: 1080 },
      },
      dependencies: ['setup'],
      timeout: 60000,
    },
    {
      name: 'doctor-consultation',
      testMatch: /consultation\.start\.spec\.(js|ts)/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'storageState.json',
        viewport: { width: 1920, height: 1080 },
      },
      dependencies: ['setup'],
      timeout: 300000,
    },
    {
      name: 'system-health',
      testMatch: /system-health\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'storageState.json',
        viewport: { width: 1920, height: 1080 },
      },
      dependencies: ['setup'],
      timeout: 30000,
    },
    {
      name: 'ingresos',
      testMatch: /ingresos\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'storageState.json',
        viewport: { width: 1920, height: 1080 },
      },
      dependencies: ['doctor-consultation'],
      timeout: 300000,
    },
    {
      name: 'subir-estudios',
      testMatch: /subir-estudios\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'storageState.json',
        viewport: { width: 1920, height: 1080 },
      },
      timeout: 120000,
    },
  ],
  globalSetup: undefined,
  globalTeardown: undefined,
});
