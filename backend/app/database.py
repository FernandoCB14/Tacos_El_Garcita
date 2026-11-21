import sqlite3
from contextlib import contextmanager
from pathlib import Path

# backend/taqueria.db, sin importar desde qué carpeta se arranque el servidor
RUTA_BD = Path(__file__).resolve().parent.parent / "taqueria.db"


def obtener_conexion():
    conexion = sqlite3.connect(RUTA_BD)
    conexion.execute("PRAGMA foreign_keys = ON;")
    conexion.row_factory = sqlite3.Row   # las filas se leen por nombre: fila["precio_centavos"]
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
                num_mesa INTEGER PRIMARY KEY,
                abierta_en TEXT DEFAULT (datetime('now','localtime'))
            );
        """)
        con.execute("""
            CREATE TABLE IF NOT EXISTS productos(
                producto_id INTEGER PRIMARY KEY,
                categoria TEXT,
                nombre TEXT,
                precio_centavos INTEGER,
                lleva_carne INTEGER,
                precio_variable INTEGER NOT NULL DEFAULT 0
            );
        """)


        # Verificar si la columna precio_variable ya existe
        columnas = con.execute(
            "PRAGMA table_info(productos)"
        ).fetchall()

        nombres_columnas = [columna[1] for columna in columnas]

        if "precio_variable" not in nombres_columnas:
            con.execute("""
                ALTER TABLE productos
                ADD COLUMN precio_variable INTEGER NOT NULL DEFAULT 0
            """)

            print("Columna precio_variable agregada a productos")



        con.execute("""
            CREATE TABLE IF NOT EXISTS detalles_ordenes(
                orden_id INTEGER PRIMARY KEY,
                num_mesa INTEGER,
                producto_id INTEGER,
                cantidad INTEGER,
                tipo_carne TEXT,
                nombre TEXT,
                precio_centavos INTEGER,
                FOREIGN KEY (num_mesa) REFERENCES ordenes(num_mesa),
                FOREIGN KEY (producto_id) REFERENCES productos(producto_id)
            );
        """)

        con.execute("""
            CREATE TABLE IF NOT EXISTS ventas(
                venta_id INTEGER PRIMARY KEY,
                num_mesa INTEGER,
                abierta_en TEXT,
                cerrada_en TEXT DEFAULT (datetime('now','localtime')),
                total_centavos INTEGER NOT NULL,

                metodo_pago TEXT NOT NULL DEFAULT 'efectivo'
                    CHECK (metodo_pago IN ('efectivo', 'tarjeta')),

                comision_porcentaje REAL,
                iva_comision_porcentaje REAL,

                comision_centavos INTEGER
                    CHECK (
                        comision_centavos IS NULL
                        OR comision_centavos >= 0
                    ),

                neto_centavos INTEGER
                    CHECK (
                        neto_centavos IS NULL
                        OR neto_centavos >= 0
                    )
            );
        """)


        columnas_ventas = {
            fila["name"]
            for fila in con.execute("PRAGMA table_info(ventas);")
        }

        if "tipo_venta" not in columnas_ventas:
            con.execute("""
                ALTER TABLE ventas
                ADD COLUMN tipo_venta TEXT NOT NULL DEFAULT 'mesa'
                CHECK (tipo_venta IN ('mesa', 'para_llevar'));
            """)

        if "pedido_para_llevar_id" not in columnas_ventas:
            con.execute("""
                ALTER TABLE ventas
                ADD COLUMN pedido_para_llevar_id INTEGER;
            """)


        con.execute("""
            CREATE TABLE IF NOT EXISTS detalles_ventas(
                detalle_id       INTEGER PRIMARY KEY,
                venta_id         INTEGER,
                producto_id      INTEGER,
                nombre           TEXT,
                tipo_carne       TEXT,
                cantidad         INTEGER,
                precio_centavos  INTEGER,
                FOREIGN KEY (venta_id) REFERENCES ventas(venta_id)
            );
        """)
        con.execute("""
            CREATE TABLE IF NOT EXISTS configuracion_pagos (
                clave TEXT PRIMARY KEY,
                valor TEXT NOT NULL
            );
        """)

        con.executemany(
            """
            INSERT OR IGNORE INTO configuracion_pagos (clave, valor)
            VALUES (?, ?);
            """,
            [
                ("comision_mercado_pago", "3.50"),
                ("iva_comision", "16.00"),
            ],
        )

        # Tabla de pedidos para llevar
        con.execute("""
            CREATE TABLE IF NOT EXISTS pedidos_para_llevar (
                pedido_id INTEGER PRIMARY KEY AUTOINCREMENT,

                creado_en TEXT NOT NULL
                    DEFAULT (datetime('now','localtime')),

                estado TEXT NOT NULL DEFAULT 'pendiente'
                    CHECK (
                        estado IN (
                            'pendiente',
                            'cobrado',
                            'cancelado'
                        )
                    )
            );
        """)


        # Productos de pedidos para llevar
        con.execute("""
            CREATE TABLE IF NOT EXISTS detalles_para_llevar (
                detalle_id INTEGER PRIMARY KEY,

                pedido_id INTEGER NOT NULL,
                producto_id INTEGER NOT NULL,

                cantidad INTEGER NOT NULL
                    CHECK (cantidad > 0),

                tipo_carne TEXT,
                nombre TEXT NOT NULL,

                precio_centavos INTEGER NOT NULL
                    CHECK (precio_centavos >= 0),

                FOREIGN KEY (pedido_id)
                    REFERENCES pedidos_para_llevar(pedido_id),

                FOREIGN KEY (producto_id)
                    REFERENCES productos(producto_id)
            );
        """)


def cargar_menu():
    """Llena el catálogo la primera vez. Si ya hay productos, no hace nada."""
    with conexion_bd() as con:
        total = con.execute("SELECT COUNT(*) FROM productos;").fetchone()[0]
        if total > 0:
            return

        menu = [
            # (categoria, nombre, precio_centavos, lleva_carne)
            ("tacos", "Bistec", 1800, 0),
            ("tacos", "Pastor", 1800, 0),
            ("tacos", "Chorizo", 1800, 0),
            ("tacos", "Campechanos", 1800, 0),
            ("tacos", "Suadero", 2000, 0),
            ("con_queso", "Tacos con queso", 2200, 1),
            ("con_queso", "Chonitas", 4000, 1),
            ("con_queso", "Gringas", 4000, 1),
            ("con_queso", "Volcanes", 4000, 1),
            ("con_queso", "Gringas dobles", 6000, 1),
            ("con_queso", "Tortas", 7000, 1),
            ("con_queso", "Quesadillas", 2000, 0),
            ("frios", "Refresco 455ml", 3500, 0),
            ("frios", "Refresco 600ml", 3500, 0),
            ("frios", "Boing", 3500, 0),
            ("frios", "Aguas", 3500, 0),
            ("frios", "Jericallas", 3500, 0),
        ]

        con.executemany(
            "INSERT INTO productos (categoria, nombre, precio_centavos, lleva_carne) VALUES (?, ?, ?, ?);",
            menu,
        )