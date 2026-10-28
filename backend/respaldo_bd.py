import sqlite3
from contextlib import closing
from datetime import datetime

from app.database import RUTA_BD

CARPETA = RUTA_BD.parent / "respaldos"
MANTENER = 30  # cuántos respaldos conservar; los más viejos se borran


def respaldar():
    # Si la base no existe, sqlite3.connect() crearía una VACÍA sin avisar.
    if not RUTA_BD.exists():
        raise SystemExit(f"No existe la base de datos: {RUTA_BD}")

    CARPETA.mkdir(exist_ok=True)
    destino = CARPETA / f"taqueria_{datetime.now():%Y-%m-%d_%H%M%S}.db"

    # closing() convierte cualquier objeto con .close() en un context manager:
    # las dos conexiones se cierran al salir del bloque, pase lo que pase.
    with closing(sqlite3.connect(RUTA_BD)) as origen, closing(sqlite3.connect(destino)) as copia:
        origen.backup(copia)  # copia consistente, aunque el servidor esté escribiendo

    # Rotación: los nombres llevan la fecha, así que ordenados por nombre = ordenados por antigüedad.
    respaldos = sorted(CARPETA.glob("taqueria_*.db"))
    for viejo in respaldos[:-MANTENER]:
        viejo.unlink()

    print(f"Respaldo creado: {destino.name} ({destino.stat().st_size // 1024} KB)")
    print(f"Respaldos guardados: {min(len(respaldos), MANTENER)} (máximo {MANTENER})")
    return destino


if __name__ == "__main__":
    respaldar()