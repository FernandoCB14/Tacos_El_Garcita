
import { useEffect, useState } from "react";
import { obtenerTicket } from "../api";
import { formatearDinero } from "../formato";

export default function CuentaRapida({ numMesa, onCerrar }) {
  const [orden, setOrden] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

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
                          producto.cantidad *
                            producto.precio_centavos
                        )}
                      </span>
                    </div>
                  ))
                )}
              </div>

              <div className="cuenta-rapida-total">
                <span>Total a pagar</span>

                <strong>
                  {formatearDinero(orden.total_centavos)}
                </strong>
              </div>

              <p className="cuenta-rapida-nota">
                Vista de consulta. El cobro se habilitará
                después de probar este panel.
              </p>
            </>
          )}
        </>
      )}
    </section>
  );
}
