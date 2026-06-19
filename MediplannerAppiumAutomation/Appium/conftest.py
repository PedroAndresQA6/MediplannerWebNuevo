import pytest
import os
import sys
import time
from appium import webdriver
from appium.options.android import UiAutomator2Options

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


@pytest.fixture(scope="session")
def credenciales():
    return {
        "email": os.environ.get("MEDIPLANNER_EMAIL", "luis.morenoramos@icloud.com"),
        "password": os.environ.get("MEDIPLANNER_PASSWORD", "@RyM2025")
    }


@pytest.fixture(scope="session")
def credenciales_alternativas():
    return {
        "email": os.environ.get("MEDIPLANNER_EMAIL", "paciente@rym-solutions.com"),
        "password": os.environ.get("MEDIPLANNER_PASSWORD", "@RyM2025")
    }


@pytest.fixture(scope="session")
def appium_server_url():
    host = os.environ.get("APPIUM_HOST", "localhost")
    port = os.environ.get("APPIUM_PORT", "4723")
    return f"http://{host}:{port}"


def get_android_device():
    try:
        import subprocess
        result = subprocess.run(["adb", "devices"], capture_output=True, text=True, timeout=10)
        lines = result.stdout.strip().split('\n')
        devices = [line.split()[0] for line in lines[1:] if line.strip() and 'device' in line]
        for device in devices:
            if '5554' in device:
                return device
        return devices[0] if devices else "emulator-5554"
    except:
        return "emulator-5554"


@pytest.fixture(scope="session")
def device_name():
    return get_android_device()


def get_driver_options(device_name):
    options = UiAutomator2Options()
    options.platform_name = "Android"
    options.automation_name = "UiAutomator2"
    options.device_name = device_name
    options.app_package = "mx.mediplanner.app"
    options.app_activity = ".MainActivity"
    options.no_reset = True
    options.full_reset = False
    options.set_capability("autoGrantPermissions", True)
    options.set_capability("enforceXPath1", True)
    options.set_capability("skipUnlock", True)
    options.set_capability("newCommandTimeout", 300)
    return options


@pytest.fixture(scope="function")
def driver(appium_server_url, device_name):
    options = get_driver_options(device_name)
    driver = webdriver.Remote(command_executor=appium_server_url, options=options)
    driver.implicitly_wait(10)
    yield driver
    try:
        driver.quit()
    except:
        pass


@pytest.fixture(scope="function")
def login_page(driver):
    from pages.login_page import LoginPage
    return LoginPage(driver)


@pytest.fixture(scope="function")
def home_page(driver):
    from pages.home_page import HomePage
    return HomePage(driver)


@pytest.fixture(scope="function")
def doctors_page(driver):
    from pages.doctors_page import DoctorsPage
    return DoctorsPage(driver)


@pytest.fixture(scope="function")
def volver_inicio(driver, home_page):
    """Asegura que we're on Home tab before each test"""
    from appium.webdriver.common.appiumby import AppiumBy
    
    # Check if we're on Home tab
    tab_inicio = (AppiumBy.ACCESSIBILITY_ID, "Inicio\nPestaña 1 de 5")
    
    # Try to find Home tab, if not found, use back button
    max_attempts = 5
    for attempt in range(max_attempts):
        if home_page.esta_visible(tab_inicio, timeout=2):
            break
        # Try different tabs
        tabs = [
            (AppiumBy.ACCESSIBILITY_ID, "Inicio\nPestaña 1 de 5"),
            (AppiumBy.ACCESSIBILITY_ID, "Médicos\nPestaña 2 de 5"),
            (AppiumBy.ACCESSIBILITY_ID, "Consultas\nPestaña 3 de 5"),
            (AppiumBy.ACCESSIBILITY_ID, "Medicinas\nPestaña 4 de 5"),
            (AppiumBy.ACCESSIBILITY_ID, "Estudios\nPestaña 5 de 5"),
        ]
        tab_found = False
        for tab in tabs:
            if home_page.esta_visible(tab, timeout=1):
                home_page.hacer_click(tab)
                time.sleep(1)
                tab_found = True
                break
        
        if not tab_found:
            # Use in-app back button instead of driver.back()
            try:
                btn_back = driver.find_element(AppiumBy.XPATH, "//android.widget.Button[@bounds='[12,168][156,312]']")
                if btn_back:
                    btn_back.click()
                    time.sleep(1)
            except:
                pass
    
    # Final check - click on Home tab to ensure we're there
    if home_page.esta_visible(tab_inicio, timeout=2):
        home_page.hacer_click(tab_inicio)
        time.sleep(1)
    
    return home_page