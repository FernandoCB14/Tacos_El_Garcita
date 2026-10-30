
from decimal import Decimal, ROUND_HALF_UP

from .database import conexion_bd


def calcular_comision(total_centavos, metodo_pago, con=None):
    """
    Calcula la comisión y el ingreso neto estimado.

    Devuelve:
        (comision_porcentaje,
         iva_comision_porcentaje,
         comision_centavos,
         neto_centavos)
    """

    if (
        type(total_centavos) is not int
        or total_centavos < 0
    ):
        raise ValueError("El total debe ser un entero no negativo.")

    if metodo_pago == "efectivo":
        return Decimal("0"), Decimal("0"), 0, total_centavos

    if metodo_pago != "tarjeta":
        raise ValueError("Método de pago no válido.")


    if con is None:
        with conexion_bd() as conexion:
            filas = conexion.execute(
                "SELECT clave, valor FROM configuracion_pagos"
            ).fetchall()
    else:
        filas = con.execute(
            "SELECT clave, valor FROM configuracion_pagos"
        ).fetchall()


    configuracion = {
        fila["clave"]: Decimal(fila["valor"])
        for fila in filas
    }

    porcentaje = configuracion["comision_mercado_pago"]
    iva_porcentaje = configuracion["iva_comision"]

    if not (Decimal("0") <= porcentaje <= Decimal("100")):
        raise ValueError("Comisión fuera del rango permitido.")

    if not (Decimal("0") <= iva_porcentaje <= Decimal("100")):
        raise ValueError("IVA fuera del rango permitido.")

    tasa_comision = porcentaje / Decimal("100")
    tasa_iva = iva_porcentaje / Decimal("100")

    comision = (
        Decimal(total_centavos)
        * tasa_comision
        * (Decimal("1") + tasa_iva)
    )

    comision_centavos = int(
        comision.quantize(
            Decimal("1"),
            rounding=ROUND_HALF_UP
        )
    )

    neto_centavos = total_centavos - comision_centavos

    return (
        porcentaje,
        iva_porcentaje,
        comision_centavos,
        neto_centavos,
    )
