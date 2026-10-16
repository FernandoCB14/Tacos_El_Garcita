import sqlite3
from contextlib import contextmanager


def obtener_conexion():
    conexion = sqlite3.connect("taqueria.db")
    conexion.execute("PRAGMA foreign_keys = ON;")
    conexion.row_factory = sqlite3.Row   # las filas se leen por nombre: fila["precio"]
    return conexion


@contextmanager
def conexion_bd():
    """Abre una conexión y garantiza que siempre se limpie.

    Uso:
        with conexion_bd() as con:
            con.execute(...)
    - Si todo sale bien: commit (guarda).
    - Si algo falla: rollback (deshace) y el error sigue su camino.
    - Pase lo que pase: la conexión se cierra.
    """
    con = obtener_conexion()
    try:
        yield con
        con.commit()
    except Exception:
        con.rollback()
        raise
    finally:
        con.close()


def inicializar_bd():
    with conexion_bd() as con:
        con.execute("""
            CREATE TABLE IF NOT EXISTS ordenes(
                num_mesa INTEGER PRIMARY KEY
            );
        """)
        con.execute("""
            CREATE TABLE IF NOT EXISTS productos(
                producto_id INTEGER PRIMARY KEY,
                categoria TEXT,
                nombre TEXT,
                precio REAL,
                lleva_carne INTEGER
            );
        """)
        con.execute("""
            CREATE TABLE IF NOT EXISTS detalles_ordenes(
                orden_id INTEGER PRIMARY KEY,
                num_mesa INTEGER,
                producto_id INTEGER,
                cantidad INTEGER,
                tipo_carne TEXT,
                nombre TEXT,
                precio REAL,
                FOREIGN KEY (num_mesa) REFERENCES ordenes(num_mesa),
                FOREIGN KEY (producto_id) REFERENCES productos(producto_id)
            );
        """)


def cargar_menu():
    """Llena el catálogo la primera vez. Si ya hay productos, no hace nada."""
    with conexion_bd() as con:
        total = con.execute("SELECT COUNT(*) FROM productos;").fetchone()[0]
        if total > 0:
            return

        menu = [
            # (categoria, nombre, precio, lleva_carne)
            ("tacos", "Bistec", 18, 0),
            ("tacos", "Pastor", 18, 0),
            ("tacos", "Chorizo", 18, 0),
            ("tacos", "Campechanos", 18, 0),
            ("tacos", "Suadero", 20, 0),
            ("con_queso", "Tacos con queso", 22, 1),
            ("con_queso", "Chonitas", 40, 1),
            ("con_queso", "Gringas", 40, 1),
            ("con_queso", "Volcanes", 40, 1),
            ("con_queso", "Gringas dobles", 60, 1),
            ("con_queso", "Tortas", 70, 1),
            ("con_queso", "Quesadillas", 20, 0),
            ("frios", "Refresco 455ml", 35, 0),
            ("frios", "Refresco 600ml", 37, 0),
            ("frios", "Boing", 35, 0),
            ("frios", "Aguas", 35, 0),
            ("frios", "Jericallas", 35, 0),
        ]

        con.executemany(
            "INSERT INTO productos (categoria, nombre, precio, lleva_carne) VALUES (?, ?, ?, ?);",
            menu,
        )