import sqlite3
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.database import inicializar_bd, cargar_menu, conexion_bd

# -------------------------------------------------------------------
# CONSTANTES DE NEGOCIO
# Todo el dinero del backend son CENTAVOS ENTEROS: $18.00 = 1800.
# -------------------------------------------------------------------
RECARGO_SUADERO_CENTAVOS = 300
CARNES_VALIDAS = {"suadero", "pastor", "bistec", "chorizo", "campechanos"}


# -------------------------------------------------------------------
# ARRANQUE
# -------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Todo lo que va ANTES del yield se ejecuta al arrancar el servidor.
    inicializar_bd()
    cargar_menu()
    yield
    # Lo que fuera DESPUÉS del yield se ejecutaría al apagarlo.


app = FastAPI(title="API Tacos el Garcita", lifespan=lifespan)

origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -------------------------------------------------------------------
# MODELOS: la forma de los datos que el frontend nos manda
# -------------------------------------------------------------------
class ProductoNuevo(BaseModel):
    num_mesa: int
    producto_id: int
    cantidad: int = Field(gt=0)
    carne: Optional[str] = None


class ActualizarOrden(BaseModel):
    orden_id: int
    cantidad: Optional[int] = Field(default=None, gt=0)
    carne: Optional[str] = None


# -------------------------------------------------------------------
# FUNCIÓN AUXILIAR: la regla de precios vive en UN solo lugar
# -------------------------------------------------------------------
def calcular_precio(precio_base_centavos: int, lleva_carne: int, carne: Optional[str]):
    """Devuelve (carne_normalizada, precio_final_en_centavos).

    Lanza 400 si el producto necesita carne y la que llegó no es válida.
    """
    if not lleva_carne:
        return None, precio_base_centavos

    carne = (carne or "").lower()
    if carne not in CARNES_VALIDAS:
        raise HTTPException(status_code=400, detail="Elige una carne válida para este producto")

    if carne == "suadero":
        precio_base_centavos += RECARGO_SUADERO_CENTAVOS
    return carne, precio_base_centavos

def leer_venta(con, venta_id: int):
    """Lee una venta ya guardada, con sus renglones. Devuelve None si no existe."""
    venta = con.execute(
        "SELECT venta_id, num_mesa, abierta_en, cerrada_en, total_centavos "
        "FROM ventas WHERE venta_id = ?;",
        (venta_id,),
    ).fetchone()
    if venta is None:
        return None

    renglones = con.execute(
        "SELECT detalle_id, nombre, tipo_carne, cantidad, precio_centavos "
        "FROM detalles_ventas WHERE venta_id = ? ORDER BY detalle_id;",
        (venta_id,),
    ).fetchall()

    datos = dict(venta)
    datos["productos"] = [dict(r) for r in renglones]
    return datos


# -------------------------------------------------------------------
# RUTAS
# -------------------------------------------------------------------
@app.get("/")
def inicio():
    return {"message": "Bienvenido a la API de Tacos el Garcita"}


@app.get("/mesa/estado")
def estado_mesas():
    with conexion_bd() as con:
        abiertas = {fila[0] for fila in con.execute("SELECT num_mesa FROM ordenes;")}
    return {num: (num in abiertas) for num in range(1, 6)}


@app.get("/menu")
def obtener_menu():
    with conexion_bd() as con:
        filas = con.execute(
            "SELECT producto_id, categoria, nombre, precio_centavos, lleva_carne "
            "FROM productos ORDER BY producto_id;"
        ).fetchall()
        return [dict(fila) for fila in filas]


@app.get("/ordenes/{num_mesa}/ticket")
def ver_ticket(num_mesa: int):
    try:
        with conexion_bd() as con:
            existe = con.execute(
                "SELECT 1 FROM ordenes WHERE num_mesa = ?;", (num_mesa,)
            ).fetchone()
            if existe is None:
                return {"num_mesa": num_mesa, "abierta": False, "productos": [], "total_centavos": 0}

            filas = con.execute(
                "SELECT orden_id, num_mesa, producto_id, nombre, tipo_carne, cantidad, precio_centavos "
                "FROM detalles_ordenes WHERE num_mesa = ? ORDER BY orden_id;",
                (num_mesa,),
            ).fetchall()

            productos = [dict(fila) for fila in filas]
            total_centavos = sum(p["precio_centavos"] * p["cantidad"] for p in productos)

            return {
                "num_mesa": num_mesa,
                "abierta": True,
                "productos": productos,
                "total_centavos": total_centavos,
            }
    except sqlite3.Error as e:
        raise HTTPException(status_code=500, detail=f"Error interno en la base de datos: {e}")


@app.post("/abrir-mesa/{num_mesa}")
def abrir_mesa(num_mesa: int):
    try:
        with conexion_bd() as con:
            con.execute("INSERT INTO ordenes (num_mesa) VALUES (?);", (num_mesa,))
        return {"status": "success", "message": f"Mesa {num_mesa} abierta con éxito."}
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail=f"La mesa {num_mesa} ya está abierta.")


@app.post("/ordenes/productos")
def agregar_producto(datos: ProductoNuevo):
    try:
        with conexion_bd() as con:
            # 1. La mesa debe estar abierta
            mesa = con.execute(
                "SELECT 1 FROM ordenes WHERE num_mesa = ?;", (datos.num_mesa,)
            ).fetchone()
            if mesa is None:
                raise HTTPException(
                    status_code=404, detail=f"La mesa {datos.num_mesa} no está abierta."
                )

            # 2. El producto debe existir en el menú
            producto = con.execute(
                "SELECT nombre, precio_centavos, lleva_carne FROM productos WHERE producto_id = ?;",
                (datos.producto_id,),
            ).fetchone()
            if producto is None:
                raise HTTPException(status_code=404, detail="Ese producto no existe en el menú.")

            # 3. El backend decide la carne y el precio, nunca el frontend
            carne, precio_centavos = calcular_precio(
                producto["precio_centavos"], producto["lleva_carne"], datos.carne
            )

            # 4. Guardamos con "foto" del nombre y del precio al momento de la venta
            con.execute(
                "INSERT INTO detalles_ordenes "
                "(num_mesa, producto_id, cantidad, tipo_carne, nombre, precio_centavos) "
                "VALUES (?, ?, ?, ?, ?, ?);",
                (datos.num_mesa, datos.producto_id, datos.cantidad, carne,
                 producto["nombre"], precio_centavos),
            )

        return {"status": "success", "message": f"{datos.cantidad} x {producto['nombre']} agregado."}
    except sqlite3.Error as e:
        raise HTTPException(status_code=500, detail=f"Error interno en la base de datos: {e}")


@app.put("/ordenes/actualizar")
def actualizar_producto(datos: ActualizarOrden):
    try:
        with conexion_bd() as con:
            # JOIN: unimos el renglón de la orden con su producto del catálogo
            fila = con.execute(
                """
                SELECT d.cantidad, d.tipo_carne,
                       p.precio_centavos AS precio_base_centavos, p.lleva_carne
                FROM detalles_ordenes d
                JOIN productos p ON p.producto_id = d.producto_id
                WHERE d.orden_id = ?;
                """,
                (datos.orden_id,),
            ).fetchone()

            if fila is None:
                raise HTTPException(
                    status_code=404, detail=f"El registro con ID {datos.orden_id} no existe."
                )

            # Si el frontend no manda un dato, conservamos el que ya tenía
            nueva_cantidad = datos.cantidad if datos.cantidad is not None else fila["cantidad"]
            carne_pedida = datos.carne if datos.carne is not None else fila["tipo_carne"]

            carne, precio_centavos = calcular_precio(
                fila["precio_base_centavos"], fila["lleva_carne"], carne_pedida
            )

            con.execute(
                "UPDATE detalles_ordenes SET cantidad = ?, tipo_carne = ?, precio_centavos = ? "
                "WHERE orden_id = ?;",
                (nueva_cantidad, carne, precio_centavos, datos.orden_id),
            )

        return {
            "status": "success",
            "message": f"El registro {datos.orden_id} fue actualizado con éxito.",
        }
    except sqlite3.Error as e:
        raise HTTPException(status_code=500, detail=f"Error interno en la base de datos: {e}")


@app.delete("/ordenes/eliminar-producto/{orden_id}")
def eliminar_producto_por_id(orden_id: int):
    try:
        with conexion_bd() as con:
            existe = con.execute(
                "SELECT 1 FROM detalles_ordenes WHERE orden_id = ?;", (orden_id,)
            ).fetchone()
            if existe is None:
                raise HTTPException(
                    status_code=404,
                    detail=f"No se encontró ningún producto con el ID de orden {orden_id}.",
                )
            con.execute("DELETE FROM detalles_ordenes WHERE orden_id = ?;", (orden_id,))

        return {"status": "success", "message": f"El producto {orden_id} fue eliminado."}
    except sqlite3.Error as e:
        raise HTTPException(status_code=500, detail=f"Error interno en la base de datos: {e}")


@app.delete("/ordenes/{num_mesa}/cerrar")
def cerrar_mesa(num_mesa: int):
    try:
        with conexion_bd() as con:
            existe = con.execute(
                "SELECT 1 FROM ordenes WHERE num_mesa = ?;", (num_mesa,)
            ).fetchone()
            if existe is None:
                raise HTTPException(
                    status_code=404,
                    detail=f"La mesa {num_mesa} no está abierta. Primero debes abrirla.",
                )

            con_consumo = con.execute(
                "SELECT 1 FROM detalles_ordenes WHERE num_mesa = ? LIMIT 1;", (num_mesa,)
            ).fetchone()
            if con_consumo is not None:
                raise HTTPException(
                    status_code=400,
                    detail="La mesa tiene consumo: cóbrala en lugar de cerrarla.",
                )

            con.execute("DELETE FROM ordenes WHERE num_mesa = ?;", (num_mesa,))

        return {"status": "success", "message": f"Mesa {num_mesa} cerrada."}
    except sqlite3.Error as e:
        raise HTTPException(status_code=500, detail=f"Error interno en la base de datos: {e}")


@app.post("/ordenes/{num_mesa}/cobrar")
def cobrar_mesa(num_mesa: int):
    try:
        with conexion_bd() as con:
            orden = con.execute(
                "SELECT abierta_en FROM ordenes WHERE num_mesa = ?;", (num_mesa,)
            ).fetchone()
            if orden is None:
                raise HTTPException(status_code=404, detail=f"La mesa {num_mesa} no está abierta.")

            total_centavos = con.execute(
                "SELECT SUM(precio_centavos * cantidad) AS total "
                "FROM detalles_ordenes WHERE num_mesa = ?;",
                (num_mesa,),
            ).fetchone()["total"]

            if total_centavos is None:
                raise HTTPException(
                    status_code=400, detail="La mesa no tiene productos, no hay nada que cobrar."
                )

            cursor = con.execute(
                "INSERT INTO ventas (num_mesa, abierta_en, total_centavos) VALUES (?, ?, ?);",
                (num_mesa, orden["abierta_en"], total_centavos),
            )
            venta_id = cursor.lastrowid

            con.execute(
                "INSERT INTO detalles_ventas "
                "(venta_id, producto_id, nombre, tipo_carne, cantidad, precio_centavos) "
                "SELECT ?, producto_id, nombre, tipo_carne, cantidad, precio_centavos "
                "FROM detalles_ordenes WHERE num_mesa = ?;",
                (venta_id, num_mesa),
            )

            con.execute("DELETE FROM detalles_ordenes WHERE num_mesa = ?;", (num_mesa,))
            con.execute("DELETE FROM ordenes WHERE num_mesa = ?;", (num_mesa,))

            venta = leer_venta(con, venta_id)

        return venta
    except sqlite3.Error as e:
        raise HTTPException(status_code=500, detail=f"Error interno en la base de datos: {e}")

@app.get("/ventas/{venta_id}")
def ver_venta(venta_id: int):
    try:
        with conexion_bd() as con:
            venta = leer_venta(con, venta_id)
        if venta is None:
            raise HTTPException(status_code=404, detail=f"La venta {venta_id} no existe.")
        return venta
    except sqlite3.Error as e:
        raise HTTPException(status_code=500, detail=f"Error interno en la base de datos: {e}")