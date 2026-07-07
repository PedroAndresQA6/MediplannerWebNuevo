import pytest
from config import APP_PACKAGE


@pytest.mark.smoke
def test_app_abre_en_foreground(driver, home_page):
    """Smoke inicial: la app abre y queda en foreground, sin crash/ANR (lo
    valida crash_monitor, autouse). No depende de selectores de la app real
    todavía — es el punto de partida antes de mapear pantallas, análogo al
    primer test exploratorio que se hizo en Mediplanner (00_inicio)."""
    assert driver.query_app_state(APP_PACKAGE) >= 4, "La app no quedó en foreground tras abrir"
    home_page.tomar_screenshot("00_home_inicial")
