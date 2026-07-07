"""Configuración central de la suite (capabilities Appium + parámetros del AVD
tablet). Todo override posible por variable de entorno para no tener que tocar
código al cambiar de máquina/AVD — mismo criterio que `PW_CHROMIUM_PATH` en la
suite Playwright de este repo."""

import os
from appium.options.android import UiAutomator2Options

# Confirmado por recon con `adb shell dumpsys activity activities` sobre el AVD
# tablet ya abierto (2026-07-07): mFocusedApp=com.example.estacionamientos_mobile/.MainActivity
APP_PACKAGE = os.environ.get("ESTACIONAMIENTOS_APP_PACKAGE", "com.example.estacionamientos_mobile")
APP_ACTIVITY = os.environ.get("ESTACIONAMIENTOS_APP_ACTIVITY", ".MainActivity")

# Nombre del AVD tablet creado en Android Studio (Device Manager). Ver CLAUDE.md
# sección "Setup" para cómo crearlo. Solo se usa para el chequeo de advertencia
# en conftest.py, no como capability directa.
AVD_NAME = os.environ.get("ESTACIONAMIENTOS_AVD_NAME", "Pixel_Tablet_API_34")

# Zona horaria real de la operación (Querétaro). El AVD no tiene SIM/ubicación
# para inferirla solo, así que conftest.py la fija explícito en vez de confiar
# en auto_time_zone (que, sin esa señal, cae a GMT — confirmado en recon
# 2026-07-07: el turno del operador debe reflejar la hora local real).
TIMEZONE = os.environ.get("ESTACIONAMIENTOS_TIMEZONE", "America/Mexico_City")

# Posición GPS base del AVD, fijada manualmente por Pedro en el punto donde el
# operador debe estar para que el check-in/liberar (proximidad ≤50m) funcione
# contra los espacios de prueba de la zona "Primer Cuadro". Capturada de
# `adb shell dumpsys location` (2026-07-07) — NO inventar otra: cualquier test
# que necesite alejarse (casos "fuera de proximidad") debe volver a este punto
# exacto en su `finally`, nunca dejar el emulador en otra posición.
GPS_LAT_BASE = float(os.environ.get("ESTACIONAMIENTOS_GPS_LAT", "20.593103"))
GPS_LON_BASE = float(os.environ.get("ESTACIONAMIENTOS_GPS_LON", "-100.393097"))


def get_driver_options(device_name):
    options = UiAutomator2Options()
    options.platform_name = "Android"
    options.automation_name = "UiAutomator2"
    options.device_name = device_name
    options.app_package = APP_PACKAGE
    options.app_activity = APP_ACTIVITY
    options.no_reset = True
    options.full_reset = False
    options.set_capability("autoGrantPermissions", True)
    options.set_capability("enforceXPath1", True)
    options.set_capability("skipUnlock", True)
    options.set_capability("newCommandTimeout", 300)
    # OJO: NO usar la capability `orientation` de UiAutomator2 acá. Probado en
    # recon (2026-07-07): con `orientation: LANDSCAPE` la sesión backgroundeaba
    # la app a mitad de un flujo de login sin error visible (app_state pasaba
    # a background sin excepción). El lock de landscape se hace a nivel de
    # sistema en conftest.py (`_forzar_landscape`, vía `adb shell settings`)
    # ANTES de crear la sesión — es más estable y no depende de esta capability.
    return options
