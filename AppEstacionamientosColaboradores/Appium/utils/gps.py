"""Helpers para mover la posición GPS del emulador vía `adb emu geo fix`.

OJO con el orden de argumentos: `geo fix` recibe LONGITUD primero, LATITUD
segundo (al revés del orden lat/lon habitual en el resto de este proyecto)."""
import subprocess

from config import GPS_LAT_BASE, GPS_LON_BASE


def fijar_posicion(serial, lat, lon):
    subprocess.run(
        ["adb", "-s", serial, "emu", "geo", "fix", str(lon), str(lat)],
        capture_output=True, timeout=10,
    )


def restaurar_posicion_base(serial):
    """Vuelve a la posición que Pedro dejó fija manualmente para que el
    check-in/liberar (proximidad ≤50m) funcione. Cualquier test que se aleje
    a propósito (casos "fuera de proximidad") debe llamar esto en su
    `finally` — nunca dejar el emulador en otra posición al terminar."""
    fijar_posicion(serial, GPS_LAT_BASE, GPS_LON_BASE)


def alejar_posicion(serial, metros=200):
    """Mueve la posición ~`metros` al norte de la base — suficiente para
    quedar fuera del radio de proximidad de 50m que exige check-in/liberar.
    1 grado de latitud ≈ 111km, así que ~200m ≈ 0.0018° de latitud."""
    delta = metros / 111_000
    fijar_posicion(serial, GPS_LAT_BASE + delta, GPS_LON_BASE)
