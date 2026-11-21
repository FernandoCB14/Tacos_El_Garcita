import { useEffect, useRef, useState } from "react";
import { obtenerTicket, cobrarMesa } from "../api";
import { formatearDinero } from "../formato";
import { Banknote, CreditCard, Receipt, X } from "lucide-react";
import { confirmarCobro } from "../utils/alertas";

export default function CuentaRapida({ numMesa, onCerrar, onCobroExitoso }) {
  const [orden, setOrden] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [metodoPago, setMetodoPago] = useState("efectivo");
  const cobroEnProceso = useRef(false);
  const [cobrando, setCobrando] = useState(false);

  useEffect(() => {
    let activo = true;

    async function cargarCuenta() {
      setCargando(true);
      setError(null);
      setOrden(null);

      try {
        const datos = await obtenerTicket(numMesa);

        if (activo) {
          setOrden(datos);
        }
      } catch (err) {
        if (activo) {
          setError(err.message || "No se pudo consultar la cuenta");
        }
      } finally {
        if (activo) {
          setCargando(false);
        }
      }
    }

    cargarCuenta();

    return () => {
      activo = false;
    };
  }, [numMesa]);

  const handleCobrar = async () => {
    if (
      cobroEnProceso.current ||
      cargando ||
      !orden?.abierta ||
      !orden.productos.length
    ) {
      return;
    }

    cobroEnProceso.current = true;

    const nombreMetodo =
      metodoPago === "efectivo" ? "Efectivo" : "Mercado Pago";

    const confirmado = await confirmarCobro({
      mesa: numMesa,
      total: formatearDinero(orden.total_centavos),
      metodo: nombreMetodo,
    });

    if (!confirmado) {
      cobroEnProceso.current = false;
      return;
    }

    setCobrando(true);

    try {
      console.log("COBRO RAPIDO:", {
        mesa: numMesa,
        metodoPago: metodoPago,
      });
      const venta = await cobrarMesa(numMesa, metodoPago);

      // Croquis conservará la venta para mostrar el ticket.
      onCobroExitoso(venta);
    } catch (err) {
      console.error("Error en cobro rápido:", err);

      setError(
        `No se pudo confirmar el cobro: ${err.message}. ` +
          "Revisa el historial de ventas antes de intentarlo de nuevo.",
      );
    } finally {
      cobroEnProceso.current = false;
      setCobrando(false);
    }
  };

  return (
    <section className="cuenta-rapida">
      <div className="cuenta-rapida-header">
        <h3>Cuenta · Mesa {numMesa}</h3>

        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar panel de cuenta"
        >
          ✕
        </button>
      </div>

      {cargando && <p>Consultando cuenta...</p>}

      {error && (
        <p role="alert" className="cuenta-rapida-error">
          {error}
        </p>
      )}

      {!cargando && !error && orden && (
        <>
          {!orden.abierta ? (
            <p>Esta mesa ya no tiene una comanda abierta.</p>
          ) : (
            <>
              <div className="cuenta-rapida-productos">
                {orden.productos.length === 0 ? (
                  <p>No hay productos registrados.</p>
                ) : (
                  orden.productos.map((producto) => (
                    <div
                      className="cuenta-rapida-producto"
                      key={producto.orden_id}
                    >
                      <div>
                        <strong>
                          {producto.cantidad} × {producto.nombre}
                        </strong>

                        {producto.tipo_carne && (
                          <small>{producto.tipo_carne}</small>
                        )}
                      </div>

                      <span>
                        {formatearDinero(
                          producto.cantidad * producto.precio_centavos,
                        )}
                      </span>
                    </div>
                  ))
                )}
              </div>

              <div className="cuenta-rapida-total">
                <span>Total a pagar</span>

                <strong>{formatearDinero(orden.total_centavos)}</strong>
              </div>

              <div className="cuenta-metodo-pago">
                <h4>Método de pago</h4>

                <div className="cuenta-metodos">
                  <button
                    type="button"
                    className={metodoPago === "efectivo" ? "metodo-activo" : ""}
                    onClick={() => setMetodoPago("efectivo")}
                  >
                    <Banknote size={20} strokeWidth={2} />
                    <span>Efectivo</span>
                  </button>

                  <button
                    type="button"
                    className={metodoPago === "tarjeta" ? "metodo-activo" : ""}
                    onClick={() => setMetodoPago("tarjeta")}
                  >
                    <CreditCard size={20} strokeWidth={2} />
                    <span>Mercado Pago</span>
                  </button>
                </div>

                {metodoPago === "tarjeta" && (
                  <p className="cuenta-aviso-tarjeta">
                    Verifica que el pago haya sido aprobado en la terminal
                    Mercado Pago.
                  </p>
                )}

                <p className="cuenta-metodo-seleccionado">
                  Seleccionado:{" "}
                  {metodoPago === "efectivo" ? "Efectivo" : "Mercado Pago"}
                </p>
              </div>

              <button
                type="button"
                className="cuenta-boton-confirmar"
                onClick={handleCobrar}
                disabled={cobrando || orden.productos.length === 0}
              >
                {cobrando
                  ? "Procesando cobro..."
                  : `Confirmar cobro de ${formatearDinero(
                      orden.total_centavos,
                    )}`}
              </button>
            </>
          )}
        </>
      )}
    </section>
  );
}
