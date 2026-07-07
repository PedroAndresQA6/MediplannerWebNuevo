import time

import pytest


@pytest.mark.smoke
def test_4_1_credencial_vacia_muestra_validacion(sesion_limpia, login_page):
    """4.1: recon 2026-07-07 confirmó que el mensaje de validación reaparece
    como un View hijo del campo con `live-region="1"` (mismo texto que el
    hint de diseño, pero solo se vuelve un nodo propio cuando el campo queda
    inválido — por eso sirve como señal confiable de "sí validó")."""
    login_page.ingresar_texto_con_fallback(
        [login_page.CAMPO_PASSWORD, login_page.CAMPO_PASSWORD_FALLBACK], "algo"
    )
    login_page.hacer_click(login_page.BOTON_INICIAR_TURNO)
    login_page.assert_visible(
        login_page.ERROR_CREDENCIAL_REQUERIDA,
        "No apareció la validación de 'Número de credencial requerido' al enviar el form vacío",
        timeout=20,
    )


@pytest.mark.smoke
def test_4_2_password_vacia_muestra_validacion(sesion_limpia, login_page):
    """4.2: mismo patrón que 4.1, pero sobre el campo de contraseña."""
    login_page.ingresar_texto_con_fallback(
        [login_page.CAMPO_CREDENCIAL, login_page.CAMPO_CREDENCIAL_FALLBACK], "algo"
    )
    login_page.hacer_click(login_page.BOTON_INICIAR_TURNO)
    login_page.assert_visible(
        login_page.ERROR_PASSWORD_REQUERIDA,
        "No apareció la validación de 'Contraseña requerida' al enviar el form vacío",
        timeout=20,
    )


@pytest.mark.smoke
def test_4_3_credenciales_incorrectas_permanece_en_login(sesion_limpia, login_page):
    """4.3: chequeo blando sobre el toast (recon 2026-07-07: el toast de
    error no quedó capturado en el árbol de accesibilidad ni con dump
    inmediato ni con espera — probablemente un Toast nativo de vida muy
    corta). El resultado ESTABLE y verificable es que la app se queda en
    Login en vez de entrar a Home."""
    login_page.login("usuario_invalido@test.com", "password_incorrecto")
    time.sleep(2)
    assert login_page.esta_visible(login_page.CAMPO_CREDENCIAL_FALLBACK, timeout=5), (
        "Con credenciales incorrectas, la app no permaneció en Login"
    )


@pytest.mark.smoke
def test_4_4_login_exitoso_entra_a_home(sesion_limpia, login_page, home_page, credenciales):
    """4.4: el checklist original describe una card intermedia 'Asignación de
    hoy' entre el login y Home. Recon 2026-07-07 (ver HALLAZGOS.md) confirmó
    que esa card ('Sin asignación disponible por el momento.') en realidad ya
    está en la propia pantalla de Login (como preview), no aparece como paso
    aparte tras autenticar — el login exitoso entra directo a Home."""
    login_page.login(credenciales["email"], credenciales["password"])
    try:
        assert home_page.esta_cargado(timeout=30), "Home no cargó tras un login válido"
    finally:
        try:
            home_page.cerrar_turno()
        except Exception as e:
            home_page.logger.warning(f"No se pudo cerrar el turno de limpieza: {e}")


@pytest.mark.smoke
def test_4_5_recuperar_password_email_invalido(sesion_limpia, login_page):
    """4.5: mismo patrón de validación por live-region que 4.1/4.2, dentro
    del diálogo 'Recuperar contraseña'."""
    login_page.hacer_click(login_page.BOTON_OLVIDE_CONTRASENA)
    login_page.esperar_elemento_visible(login_page.DIALOGO_RECUPERAR_TITULO)
    try:
        login_page.ingresar_texto_con_fallback([login_page.CAMPO_EMAIL_RECUPERAR], "no-es-un-email")
        login_page.hacer_click(login_page.BOTON_ENVIAR_ENLACE)
        login_page.assert_visible(
            login_page.ERROR_EMAIL_INVALIDO,
            "No apareció la validación de email inválido en el diálogo de recuperar contraseña",
            timeout=20,
        )
    finally:
        try:
            login_page.hacer_click(login_page.BOTON_CANCELAR_RECUPERAR)
        except Exception as e:
            login_page.logger.warning(f"No se pudo cerrar el diálogo de recuperar contraseña: {e}")


@pytest.mark.smoke
def test_4_6_recuperar_password_email_valido_cierra_dialogo(sesion_limpia, login_page, credenciales):
    """4.6: chequeo blando (mismo criterio que 4.3) — el toast de éxito es
    genérico y transitorio, así que la señal estable es que el diálogo se
    cierra tras enviar un email con formato válido."""
    login_page.hacer_click(login_page.BOTON_OLVIDE_CONTRASENA)
    login_page.esperar_elemento_visible(login_page.DIALOGO_RECUPERAR_TITULO)
    login_page.ingresar_texto_con_fallback([login_page.CAMPO_EMAIL_RECUPERAR], credenciales["email"])
    login_page.hacer_click(login_page.BOTON_ENVIAR_ENLACE)
    time.sleep(2)
    assert not login_page.esta_visible(login_page.DIALOGO_RECUPERAR_TITULO, timeout=3), (
        "El diálogo de recuperar contraseña no se cerró tras enviar un email válido"
    )


@pytest.mark.smoke
def test_4_7_login_sin_red_permanece_en_login(sesion_limpia, device_name, login_page, credenciales):
    """4.7: mismo mecanismo de 3.3 (svc wifi/data disable) y mismo criterio
    de chequeo blando que 4.3 sobre el toast."""
    import subprocess
    subprocess.run(["adb", "-s", device_name, "shell", "svc", "wifi", "disable"], capture_output=True, timeout=10)
    subprocess.run(["adb", "-s", device_name, "shell", "svc", "data", "disable"], capture_output=True, timeout=10)
    try:
        login_page.login(credenciales["email"], credenciales["password"])
        time.sleep(3)
        assert login_page.esta_visible(login_page.CAMPO_CREDENCIAL_FALLBACK, timeout=5), (
            "El intento de login sin red no permaneció en Login (¿se coló una "
            "respuesta cacheada u offline como si fuera éxito?)"
        )
    finally:
        subprocess.run(["adb", "-s", device_name, "shell", "svc", "wifi", "enable"], capture_output=True, timeout=10)
        subprocess.run(["adb", "-s", device_name, "shell", "svc", "data", "enable"], capture_output=True, timeout=10)
