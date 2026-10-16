"""Herramienta de diagnóstico: muestra QUÉ base usa el servidor y cómo son sus tablas.

Se corre desde la carpeta backend, con el venv activo:
    python revisar_bd.py
"""
import sqlite3
from app.database import RUTA_BD

print("Base de datos:", RUTA_BD)
print("¿Existe?     :", RUTA_BD.exists())
print()

con = sqlite3.connect(RUTA_BD)
tablas = [f[0] for f in con.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;")]

for tabla in tablas:
    columnas = [f[1] for f in con.execute(f"PRAGMA table_info({tabla});")]
    print(f"{tabla}: {columnas}")

print()
if "productos" in tablas:
    print(con.execute("SELECT nombre, precio_centavos FROM productos LIMIT 3;").fetchall())
con.close()