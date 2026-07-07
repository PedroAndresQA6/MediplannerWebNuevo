"""Agrega los reportes de reports/monitor/*.json (uno por test por corrida,
generados por `crash_monitor` en conftest.py) en un resumen de estabilidad
por test: cuántas corridas tiene, qué tasa de éxito, y qué categoría de
fallo es la más frecuente cuando falla.

Responde justo la pregunta que hoy exige revisar logs a mano: "¿qué test es
inestable y por qué falla más seguido?" (huecos #2 y #4 del análisis de
detección de errores — ver CLAUDE.md).

Uso:
    python reports/generar_resumen_estabilidad.py
"""
import json
import os
import sys
from collections import defaultdict

MON_DIR = os.path.join(os.path.dirname(__file__), "monitor")


def main():
    # La consola de Windows (cp1252) no soporta ⚠️/acentos al imprimir directo
    # con `python script.py` (distinto del capture de pytest, que sí maneja
    # UTF-8) — forzar UTF-8 en stdout para que el resumen no reviente.
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    por_test = defaultdict(lambda: {"total": 0, "ok": 0, "categorias": defaultdict(int)})

    if not os.path.isdir(MON_DIR):
        print(f"No existe {MON_DIR} todavía — correr la suite al menos una vez primero.")
        return

    for nombre in sorted(os.listdir(MON_DIR)):
        if not nombre.endswith(".json"):
            continue
        try:
            with open(os.path.join(MON_DIR, nombre), encoding="utf-8") as f:
                datos = json.load(f)
        except Exception:
            continue

        test = datos.get("test", "?")
        categoria = datos.get("categoria_fallo", "Sin_dato")
        stats = por_test[test]
        stats["total"] += 1
        if categoria == "OK":
            stats["ok"] += 1
        else:
            stats["categorias"][categoria] += 1

    if not por_test:
        print("No hay reportes en reports/monitor/ todavía.")
        return

    ancho_test = max(len(t) for t in por_test) + 2
    print(f"{'Test':<{ancho_test}} {'Corridas':>8} {'OK':>5} {'Tasa éxito':>11}  Categorías de fallo (más frecuente primero)")
    print("-" * (ancho_test + 60))
    for test, stats in sorted(por_test.items()):
        total = stats["total"]
        ok = stats["ok"]
        tasa = f"{(ok / total * 100):.0f}%" if total else "-"
        fallos_ordenados = sorted(stats["categorias"].items(), key=lambda kv: -kv[1])
        fallos_str = ", ".join(f"{k}:{v}" for k, v in fallos_ordenados) or "(ninguna)"
        marca = " ⚠️" if total >= 3 and ok / total < 0.7 else ""
        print(f"{test:<{ancho_test}} {total:>8} {ok:>5} {tasa:>11}  {fallos_str}{marca}")

    print("\n⚠️  = tasa de éxito bajo 70% con 3+ corridas — candidato a test inestable, revisar antes de confiar en él.")


if __name__ == "__main__":
    main()
