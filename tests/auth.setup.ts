import { test as setup, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'https://admin-dev.mediplanner.mx/';
const EMAIL = process.env.MEDIPLANNER_EMAIL || 'dr.walterwhite.mediplanner@gmail.com';
const PASSWORD = process.env.MEDIPLANNER_PASSWORD || 'Pil8drof.';

setup('authenticate', async ({ page }) => {
  console.log('🔐 Iniciando proceso de autenticación...');
  console.log(`🌐 URL base: ${BASE_URL}`);
  console.log(`📧 Email: ${EMAIL.replace(/(.{3}).*(@.*)/, '$1***$2')}`);
  
  try {
    await page.goto(BASE_URL);
    console.log('✅ Navegación exitosa a la página principal');
    
    // Esperar a que el formulario esté visible
    console.log('⏳ Esperando formulario de login...');
    await page.waitForSelector('input[type="email"], input[name*="email"], input[placeholder*="mail"]', { 
      timeout: 15000,
      state: 'visible' 
    });
    console.log('✅ Formulario de login detectado');
    
    // Email
    const emailInput = page.locator('input[type="email"], input[name*="email"], input[placeholder*="mail"]').first();
    await emailInput.fill(EMAIL);
    console.log('✅ Campo email llenado');
    
    // Password
    const passwordInput = page.locator('input[type="password"]').first();
    await passwordInput.fill(PASSWORD);
    console.log('✅ Campo contraseña llenado');
    
    // Click login
    const loginButton = page.locator('button:has-text("Entrar"), button:has-text("Login")').first();
    await expect(loginButton).toBeVisible({ timeout: 5000 });
    await loginButton.click();
    console.log('✅ Botón de login clickeado');
    
    // Esperar respuesta del servidor
    await page.waitForLoadState('domcontentloaded', { timeout: 30000 });
    console.log('✅ Página principal cargada');
    
    // Esperar un poco más para que se complete la autenticación
    await page.waitForTimeout(3000);
    
    // Validar que no seguimos en login
    await expect(page).not.toHaveURL(/login/i, { timeout: 10000 });
    console.log('✅ Autenticación exitosa - Redirigido fuera de login');
    
    // Guardar sesión
    await page.context().storageState({ path: 'storageState.json' });
    console.log('✅ Sesión guardada en storageState.json');
    
  } catch (error) {
    console.error('❌ Error durante la autenticación:', error.message);
    
    // Tomar screenshot para debugging
    await page.screenshot({ path: 'test-results/auth-error.png', fullPage: true });
    console.log('📸 Screenshot de error guardado: test-results/auth-error.png');
    
    throw error;
  }
});