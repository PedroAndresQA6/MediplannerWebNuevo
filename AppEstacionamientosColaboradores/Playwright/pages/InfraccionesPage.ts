import { Page, expect } from '@playwright/test';

// Page object para /index.php/infracciones y /index.php/infracciones/nueva.
// Recon (2026-07-17, ver HTML volcado): el formulario "Registrar infracción"
// es el equivalente web más directo del módulo 10 (Reporte/Infracción) de la
// app móvil -- mismo catálogo de 7 motivos confirmado en ambos lados.
// Campos reales: select[name=cajon_id], input[name=placa],
// select[name=motivo] (con un campo condicional input[name=placa_correcta]
// que aparece solo si motivo=placa_no_coincide, vía data-placa en el
// <select>), input[name=observaciones] (texto simple, NO textarea),
// input[name=evidencia] (type=file, SIN atributo `required` -- a diferencia
// de la app móvil, que sí exige mínimo 1 foto para habilitar el envío).
export const MOTIVOS = [
  'Fuera de tiempo',
  'Placa no coincide',
  'Mal estacionado',
  'Zona prohibida',
  'Sin registro (no escaneó QR)',
  'Obstrucción',
  'Otro',
];

export class InfraccionesPage {
  constructor(private page: Page) {}

  async ir() {
    await this.page.goto('/index.php/infracciones');
    await this.page.waitForLoadState('domcontentloaded');
  }

  async irANuevaInfraccion() {
    await this.page.locator('a', { hasText: 'Registrar infracción' }).first().click();
    await this.page.waitForLoadState('domcontentloaded');
  }

  get selectCajon() { return this.page.locator('select[name="cajon_id"]'); }
  get campoPlaca() { return this.page.locator('input[name="placa"]'); }
  get selectMotivo() { return this.page.locator('select[name="motivo"]'); }
  get campoPlacaCorrecta() { return this.page.locator('input[name="placa_correcta"]'); }
  get boxPlacaCorrecta() { return this.page.locator('#placa-correcta-box'); }
  get campoObservaciones() { return this.page.locator('input[name="observaciones"]'); }
  get campoEvidencia() { return this.page.locator('input[name="evidencia"]'); }
  get botonCancelar() { return this.page.locator('a', { hasText: 'Cancelar' }); }
  get botonRegistrar() { return this.page.locator('button[type="submit"]', { hasText: 'Registrar infracción' }); }

  get filasFueraDeTiempo() { return this.page.locator('a, button', { hasText: 'Levantar falta' }); }

  async assertFormularioCargado() {
    await expect(this.selectCajon).toBeVisible({ timeout: 10000 });
    await expect(this.campoPlaca).toBeVisible();
    await expect(this.selectMotivo).toBeVisible();
  }

  async llenar({ cajonLabel, placa, motivoValue }: { cajonLabel?: string; placa: string; motivoValue: string }) {
    if (cajonLabel) {
      await this.selectCajon.selectOption({ label: cajonLabel });
    }
    await this.campoPlaca.fill(placa);
    await this.selectMotivo.selectOption(motivoValue);
  }
}
