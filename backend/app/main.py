import sqlite3
from contextlib import asynccontextmanager
from typing import Optional
from datetime import date

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Literal

from app.database import inicializar_bd, cargar_menu, conexion_bd
from .config_pagos import calcular_comision

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


class ProductoParaLlevar(BaseModel):
    producto_id: int
    cantidad: int = Field(gt=0)
    carne: Optional[str] = None


class ActualizarProductoParaLlevar(BaseModel):
    cantidad: int = Field(gt=0)


class ActualizarOrden(BaseModel):
    orden_id: int
    cantidad: Optional[int] = Field(default=None, gt=0)
    carne: Optional[str] = None


class DatosCobro(BaseModel):
    metodo_pago: Literal["efectivo", "tarjeta"]


# -------------------------------------------------------------------
# FUNCIÓN AUXILIAR: la regla de precios vive en UN solo lugar
# -------------------------------------------------------------------

def calcular_precio(
    precio_base_centavos: int,
    lleva_carne: int,
    carne: Optional[str]
):
    """Devuelve la carne normalizada y el precio final."""

    if not lleva_carne:
        return None, precio_base_centavos

    carne = (carne or "").strip().lower()

    # precio normal, sin suplemento.
    if carne == "normal":
        return "normal", precio_base_centavos

    # Conservamos la validación de las carnes existentes.
    if carne not in CARNES_VALIDAS:
        raise HTTPException(
            status_code=400,
            detail="Elige una opción válida para este producto"
        )

    # Solo Suadero tiene recargo.
    if carne == "suadero":
        precio_base_centavos += RECARGO_SUADERO_CENTAVOS

    return carne, precio_base_centavos


def leer_venta(con, venta_id: int):
    # """Lee una venta ya guardada, con sus renglones. Devuelve None si no existe."""
    venta = con.execute(
        """
        SELECT
        venta_id,
        num_mesa,
        tipo_venta,
        pedido_para_llevar_id,
        abierta_en,
        cerrada_en,
        total_centavos,
        metodo_pago,
        comision_porcentaje,
        iva_comision_porcentaje,
        comision_centavos,
        neto_centavos
        FROM ventas
        WHERE venta_id = ?;
        """,
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

            # 3. El backend decide la carne y el precio
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
def cobrar_mesa(num_mesa: int, datos: DatosCobro):
    try:
        with conexion_bd() as con:
            con.execute("BEGIN IMMEDIATE;")
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

            cursor = con.execute
            (
                comision_porcentaje,
                iva_comision_porcentaje,
                comision_centavos,
                neto_centavos,
            ) = calcular_comision(
                total_centavos,
                datos.metodo_pago,
                con=con,
            )

            cursor = con.execute(
                """
                INSERT INTO ventas (
                    num_mesa,
                    abierta_en,
                    total_centavos,
                    metodo_pago,
                    comision_porcentaje,
                    iva_comision_porcentaje,
                    comision_centavos,
                    neto_centavos
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?);
                """,
                (
                    num_mesa,
                    orden["abierta_en"],
                    total_centavos,
                    datos.metodo_pago,
                    str(comision_porcentaje),
                    str(iva_comision_porcentaje),
                    comision_centavos,
                    neto_centavos,
                ),
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

@app.get("/ventas")
def listar_ventas(fecha: Optional[date] = None):
    if fecha is None:
        fecha = date.today()

    try:
        with conexion_bd() as con:
            filas = con.execute(
                """
                SELECT
                venta_id,
                num_mesa,
                tipo_venta,
                pedido_para_llevar_id,
                cerrada_en,
                total_centavos,
                metodo_pago,
                comision_centavos,
                neto_centavos
                FROM ventas
                WHERE date(cerrada_en) = ?
                ORDER BY venta_id DESC;
                """,
                (fecha.isoformat(),),
            ).fetchall()

        ventas = [dict(fila) for fila in filas]
        total_efectivo = sum(
            v["total_centavos"]
            for v in ventas
            if v["metodo_pago"] == "efectivo"
        )

        total_tarjeta = sum(
            v["total_centavos"]
            for v in ventas
            if v["metodo_pago"] == "tarjeta"
        )

        total_comisiones = sum(
            v["comision_centavos"] or 0
            for v in ventas
        )

        total_neto = sum(
            v["neto_centavos"]
            if v["neto_centavos"] is not None
            else v["total_centavos"]
            for v in ventas
        )
        return {
            "fecha": fecha.isoformat(),
            "cantidad": len(ventas),
            "total_centavos": sum(v["total_centavos"] for v in ventas),
            "total_efectivo_centavos": total_efectivo,
            "total_tarjeta_centavos": total_tarjeta,
            "total_comisiones_centavos": total_comisiones,
            "total_neto_centavos": total_neto,
            "ventas": ventas,
        }
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


# -------------------------------------------------------------------
# PEDIDOS PARA LLEVAR
# -------------------------------------------------------------------

@app.post("/para-llevar", status_code=201)
def crear_pedido_para_llevar():

    try:
        with conexion_bd() as con:

            cursor = con.execute("""
                INSERT INTO pedidos_para_llevar (estado)
                VALUES ('pendiente');
            """)

            pedido_id = cursor.lastrowid

            pedido = con.execute("""
                SELECT pedido_id, creado_en, estado
                FROM pedidos_para_llevar
                WHERE pedido_id = ?;
            """, (pedido_id,)).fetchone()

            return dict(pedido)

    except sqlite3.Error as e:
        raise HTTPException(
            status_code=500,
            detail=f"No se pudo crear el pedido: {e}"
        )


@app.get("/para-llevar")
def listar_pedidos_para_llevar():

    try:
        with conexion_bd() as con:

            filas = con.execute("""
                SELECT
                    p.pedido_id,
                    p.creado_en,
                    p.estado,
                    COALESCE(SUM(d.cantidad), 0) AS cantidad_productos,
                    COALESCE(
                        SUM(d.cantidad * d.precio_centavos), 0
                    ) AS total_centavos

                FROM pedidos_para_llevar p

                LEFT JOIN detalles_para_llevar d
                    ON p.pedido_id = d.pedido_id

                WHERE p.estado = 'pendiente'

                GROUP BY p.pedido_id, p.creado_en, p.estado

                ORDER BY p.pedido_id DESC;
            """).fetchall()

            return [dict(fila) for fila in filas]

    except sqlite3.Error as e:
        raise HTTPException(
            status_code=500,
            detail=f"No se pudieron consultar los pedidos: {e}"
        )


@app.get("/para-llevar/{pedido_id}")
def ver_pedido_para_llevar(pedido_id: int):

    try:
        with conexion_bd() as con:

            # 1. Buscar el pedido
            pedido = con.execute("""
                SELECT pedido_id, creado_en, estado
                FROM pedidos_para_llevar
                WHERE pedido_id = ?;
            """, (pedido_id,)).fetchone()

            if pedido is None:
                raise HTTPException(
                    status_code=404,
                    detail=f"El pedido #{pedido_id} no existe."
                )

            # 2. Consultar los productos del pedido
            filas = con.execute("""
                SELECT
                    detalle_id,
                    pedido_id,
                    producto_id,
                    nombre,
                    tipo_carne,
                    cantidad,
                    precio_centavos
                FROM detalles_para_llevar
                WHERE pedido_id = ?
                ORDER BY detalle_id;
            """, (pedido_id,)).fetchall()

            productos = [dict(fila) for fila in filas]

            # 3. Calcular el total
            total_centavos = sum(
                producto["cantidad"] * producto["precio_centavos"]
                for producto in productos
            )

            # 4. Devolver el detalle completo
            return {
                "pedido_id": pedido["pedido_id"],
                "creado_en": pedido["creado_en"],
                "estado": pedido["estado"],
                "productos": productos,
                "total_centavos": total_centavos
            }

    except sqlite3.Error as e:
        raise HTTPException(
            status_code=500,
            detail=f"No se pudo consultar el pedido: {e}"
        )



@app.post("/para-llevar/{pedido_id}/productos", status_code=201)
def agregar_producto_para_llevar(
    pedido_id: int,
    datos: ProductoParaLlevar
):
    try:
        with conexion_bd() as con:

            # 1. Verificar que el pedido exista y esté pendiente
            pedido = con.execute("""
                SELECT estado
                FROM pedidos_para_llevar
                WHERE pedido_id = ?;
            """, (pedido_id,)).fetchone()

            if pedido is None:
                raise HTTPException(
                    status_code=404,
                    detail=f"El pedido #{pedido_id} no existe."
                )

            if pedido["estado"] != "pendiente":
                raise HTTPException(
                    status_code=400,
                    detail="Solo se pueden modificar pedidos pendientes."
                )

            # 2. Buscar el producto en nuestro menú
            producto = con.execute("""
                SELECT nombre, precio_centavos, lleva_carne
                FROM productos
                WHERE producto_id = ?;
            """, (datos.producto_id,)).fetchone()

            if producto is None:
                raise HTTPException(
                    status_code=404,
                    detail="El producto no existe en el menú."
                )

            # 3. Calcular el precio con las reglas existentes
            carne, precio_centavos = calcular_precio(
                producto["precio_centavos"],
                producto["lleva_carne"],
                datos.carne
            )

            # 4. Guardar el producto en el pedido
            cursor = con.execute("""
                INSERT INTO detalles_para_llevar (
                    pedido_id,
                    producto_id,
                    cantidad,
                    tipo_carne,
                    nombre,
                    precio_centavos
                )
                VALUES (?, ?, ?, ?, ?, ?);
            """, (
                pedido_id,
                datos.producto_id,
                datos.cantidad,
                carne,
                producto["nombre"],
                precio_centavos
            ))

            return {
                "detalle_id": cursor.lastrowid,
                "pedido_id": pedido_id,
                "nombre": producto["nombre"],
                "cantidad": datos.cantidad,
                "tipo_carne": carne,
                "precio_centavos": precio_centavos
            }

    except sqlite3.Error as e:
        raise HTTPException(
            status_code=500,
            detail=f"No se pudo agregar el producto: {e}"
        )


@app.put("/para-llevar/{pedido_id}/productos/{detalle_id}")
def actualizar_producto_para_llevar(
    pedido_id: int,
    detalle_id: int,
    datos: ActualizarProductoParaLlevar
):
    try:
        with conexion_bd() as con:

            # Verificar que el pedido exista y esté pendiente
            pedido = con.execute("""
                SELECT estado
                FROM pedidos_para_llevar
                WHERE pedido_id = ?;
            """, (pedido_id,)).fetchone()

            if pedido is None:
                raise HTTPException(
                    status_code=404,
                    detail=f"El pedido #{pedido_id} no existe."
                )

            if pedido["estado"] != "pendiente":
                raise HTTPException(
                    status_code=400,
                    detail="Solo se pueden modificar pedidos pendientes."
                )

            # Verificar que el producto pertenezca al pedido
            detalle = con.execute("""
                SELECT detalle_id
                FROM detalles_para_llevar
                WHERE detalle_id = ? AND pedido_id = ?;
            """, (detalle_id, pedido_id)).fetchone()

            if detalle is None:
                raise HTTPException(
                    status_code=404,
                    detail="El producto no existe en este pedido."
                )

            # Actualizar la cantidad
            con.execute("""
                UPDATE detalles_para_llevar
                SET cantidad = ?
                WHERE detalle_id = ? AND pedido_id = ?;
            """, (datos.cantidad, detalle_id, pedido_id))

            return {
                "status": "success",
                "pedido_id": pedido_id,
                "detalle_id": detalle_id,
                "cantidad": datos.cantidad
            }

    except sqlite3.Error as e:
        raise HTTPException(
            status_code=500,
            detail=f"No se pudo actualizar el producto: {e}"
        )


@app.delete("/para-llevar/{pedido_id}/productos/{detalle_id}")
def eliminar_producto_para_llevar(
    pedido_id: int,
    detalle_id: int
):
    try:
        with conexion_bd() as con:

            # 1. Comprobar que el pedido exista
            pedido = con.execute("""
                SELECT estado
                FROM pedidos_para_llevar
                WHERE pedido_id = ?;
            """, (pedido_id,)).fetchone()

            if pedido is None:
                raise HTTPException(
                    status_code=404,
                    detail=f"El pedido #{pedido_id} no existe."
                )

            # 2. Solo modificamos pedidos pendientes
            if pedido["estado"] != "pendiente":
                raise HTTPException(
                    status_code=400,
                    detail="Solo se pueden modificar pedidos pendientes."
                )

            # 3. Comprobar que el producto pertenezca al pedido
            detalle = con.execute("""
                SELECT detalle_id
                FROM detalles_para_llevar
                WHERE detalle_id = ? AND pedido_id = ?;
            """, (detalle_id, pedido_id)).fetchone()

            if detalle is None:
                raise HTTPException(
                    status_code=404,
                    detail="El producto no existe en este pedido."
                )

            # 4. Eliminar únicamente ese producto
            con.execute("""
                DELETE FROM detalles_para_llevar
                WHERE detalle_id = ? AND pedido_id = ?;
            """, (detalle_id, pedido_id))

            return {
                "status": "success",
                "pedido_id": pedido_id,
                "detalle_id": detalle_id,
                "message": "Producto eliminado correctamente."
            }

    except sqlite3.Error as e:
        raise HTTPException(
            status_code=500,
            detail=f"No se pudo eliminar el producto: {e}"
        )


@app.post("/para-llevar/{pedido_id}/cancelar")
def cancelar_pedido_para_llevar(pedido_id: int):
    try:
        with conexion_bd() as con:

            # 1. Buscar el pedido
            pedido = con.execute("""
                SELECT estado
                FROM pedidos_para_llevar
                WHERE pedido_id = ?;
            """, (pedido_id,)).fetchone()

            if pedido is None:
                raise HTTPException(
                    status_code=404,
                    detail=f"El pedido #{pedido_id} no existe."
                )

            # 2. Solo podemos cancelar pedidos pendientes
            if pedido["estado"] != "pendiente":
                raise HTTPException(
                    status_code=400,
                    detail="Solo se pueden cancelar pedidos pendientes."
                )

            # 3. Cambiar el estado sin borrar los productos
            con.execute("""
                UPDATE pedidos_para_llevar
                SET estado = 'cancelado'
                WHERE pedido_id = ?
                  AND estado = 'pendiente';
            """, (pedido_id,))

            return {
                "status": "success",
                "pedido_id": pedido_id,
                "estado": "cancelado",
                "message": "Pedido cancelado correctamente."
            }

    except sqlite3.Error as e:
        raise HTTPException(
            status_code=500,
            detail=f"No se pudo cancelar el pedido: {e}"
        )


# --------------------------------------------------
# COBRAR PEDIDO PARA LLEVAR
# --------------------------------------------------

@app.post("/para-llevar/{pedido_id}/cobrar")
def cobrar_pedido_para_llevar(
    pedido_id: int,
    datos: DatosCobro
):
    try:
        with conexion_bd() as con:

            # Evita que dos cobros escriban al mismo tiempo.
            con.execute("BEGIN IMMEDIATE;")

            # 1. Comprobar que el pedido esté pendiente
            pedido = con.execute("""
                SELECT pedido_id, creado_en, estado
                FROM pedidos_para_llevar
                WHERE pedido_id = ?;
            """, (pedido_id,)).fetchone()

            if pedido is None:
                raise HTTPException(
                    status_code=404,
                    detail=f"El pedido #{pedido_id} no existe."
                )

            if pedido["estado"] != "pendiente":
                raise HTTPException(
                    status_code=400,
                    detail="Este pedido ya fue cobrado o cancelado."
                )

            # 2. Calcular el total
            total_centavos = con.execute("""
                SELECT SUM(cantidad * precio_centavos) AS total
                FROM detalles_para_llevar
                WHERE pedido_id = ?;
            """, (pedido_id,)).fetchone()["total"]

            if total_centavos is None or total_centavos <= 0:
                raise HTTPException(
                    status_code=400,
                    detail="El pedido no tiene productos para cobrar."
                )

            # 3. Calcular comisiones
            (
                comision_porcentaje,
                iva_comision_porcentaje,
                comision_centavos,
                neto_centavos
            ) = calcular_comision(
                total_centavos,
                datos.metodo_pago,
                con=con
            )

            # 4. Registrar la venta
            cursor = con.execute("""
                INSERT INTO ventas (
                    num_mesa,
                    abierta_en,
                    total_centavos,
                    metodo_pago,
                    comision_porcentaje,
                    iva_comision_porcentaje,
                    comision_centavos,
                    neto_centavos,
                    tipo_venta,
                    pedido_para_llevar_id
                )
                VALUES (
                    NULL, ?, ?, ?, ?, ?, ?, ?,
                    'para_llevar', ?
                );
            """, (
                pedido["creado_en"],
                total_centavos,
                datos.metodo_pago,
                str(comision_porcentaje),
                str(iva_comision_porcentaje),
                comision_centavos,
                neto_centavos,
                pedido_id
            ))

            venta_id = cursor.lastrowid

            # 5. Guardar el detalle de la venta
            con.execute("""
                INSERT INTO detalles_ventas (
                    venta_id,
                    producto_id,
                    nombre,
                    tipo_carne,
                    cantidad,
                    precio_centavos
                )
                SELECT
                    ?, producto_id, nombre,
                    tipo_carne, cantidad, precio_centavos
                FROM detalles_para_llevar
                WHERE pedido_id = ?;
            """, (venta_id, pedido_id))

            # 6. Marcar pedido como cobrado
            con.execute("""
                UPDATE pedidos_para_llevar
                SET estado = 'cobrado'
                WHERE pedido_id = ?
                  AND estado = 'pendiente';
            """, (pedido_id,))

            # 7. Recuperar la venta registrada
            venta = leer_venta(con, venta_id)

            return {
                **venta,
                "tipo_venta": "para_llevar",
                "pedido_para_llevar_id": pedido_id
            }

    except sqlite3.Error as e:
        raise HTTPException(
            status_code=500,
            detail=f"No se pudo cobrar el pedido: {e}"
        )
