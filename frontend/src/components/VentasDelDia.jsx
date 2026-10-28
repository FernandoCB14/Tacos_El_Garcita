import { useEffect, useState } from "react";
import { obtenerVentas, obtenerVenta } from "../api";
import { formatearDinero } from "../formato";
import TicketModal from "./TicketModal";

// Fecha de hoy como "AAAA-MM-DD", con la hora LOCAL.
// (new Date().toISOString() usaría la hora UTC: en Querétaro, desde las 6 pm
//  ya sería "mañana", y la pantalla mostraría el día equivocado.)
const hoyLocal = () => {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
};

// "2026-10-21 23:36:48"  →  "23:36"
const soloHora = (texto) => (texto ? texto.slice(11, 16) : "");

// Solo DIBUJA: recibe los datos ya listos y no sabe nada de la red.
export function ListaVentas({ datos, onVerTicket }) {
  if (datos.cantidad === 0) {
    return <p>No hay ventas en esta fecha.</p>;
  }

  return (
    <>
      <p style={{ fontSize: "18px" }}>
        <strong>{datos.cantidad}</strong> {datos.cantidad === 1 ? "venta" : "ventas"} ·{" "}
        Total: <strong>{formatearDinero(datos.total_centavos)}</strong>
      </p>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "2px solid #ddd" }}>
            <th style={{ padding: "6px" }}>Folio</th>
            <th style={{ padding: "6px" }}>Hora</th>
            <th style={{ padding: "6px" }}>Mesa</th>
            <th style={{ padding: "6px", textAlign: "right" }}>Total</th>
            <th style={{ padding: "6px" }}></th>
          </tr>
        </thead>
        <tbody>
          {datos.ventas.map((v) => (
            <tr key={v.venta_id} style={{ borderBottom: "1px solid #eee" }}>
              <td style={{ padding: "6px" }}>{String(v.venta_id).padStart(5, "0")}</td>
              <td style={{ padding: "6px" }}>{soloHora(v.cerrada_en)}</td>
              <td style={{ padding: "6px" }}>{v.num_mesa}</td>
              <td style={{ padding: "6px", textAlign: "right" }}>
                {formatearDinero(v.total_centavos)}
              </td>
              <td style={{ padding: "6px", textAlign: "right" }}>
                <button
                  onClick={() => onVerTicket(v.venta_id)}
                  style={{ padding: "4px 10px", cursor: "pointer" }}
                >
                  🧾 Ver ticket
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

// Pide los datos y decide qué mostrar.
export default function VentasDelDia() {
  const [fecha, setFecha] = useState(hoyLocal());
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [ventaSeleccionada, setVentaSeleccionada] = useState(null); // la que se muestra como ticket

  // Se vuelve a ejecutar cada vez que cambia "fecha".
  useEffect(() => {
    let vigente = true; // ¿sigue siendo esta la petición que importa?

    const cargar = async () => {
      setCargando(true);
      try {
        const respuesta = await obtenerVentas(fecha);
        if (vigente) {
          setDatos(respuesta);
          setError(null);
        }
      } catch (err) {
        if (vigente) setError(err.message);
      } finally {
        if (vigente) setCargando(false);
      }
    };
    cargar();

    // Función de limpieza: React la ejecuta ANTES de repetir el efecto con otra fecha.
    // Así, si cambias de día rápido, una respuesta lenta del día anterior no pisa la nueva.
    return () => {
      vigente = false;
    };
  }, [fecha]);

  // Pide la venta completa y la marca como reimpresión para que no se confunda con el original.
  const handleVerTicket = async (venta_id) => {
    try {
      const venta = await obtenerVenta(venta_id);
      setVentaSeleccionada({ ...venta, reimpresion: true });
    } catch (err) {
      console.error("Error al cargar la venta:", err);
      alert(`No se pudo cargar el ticket: ${err.message}`);
    }
  };

  return (
    <div>
      <h2>📊 Ventas del día</h2>

      <label>
        Fecha:{" "}
        <input
          type="date"
          value={fecha}
          max={hoyLocal()}
          onChange={(e) => e.target.value && setFecha(e.target.value)}
        />
      </label>

      <div style={{ marginTop: "16px" }}>
        {cargando && <p>Cargando ventas...</p>}
        {!cargando && error && <p style={{ color: "#d9534f" }}>⚠️ {error}</p>}
        {!cargando && !error && datos && (
          <ListaVentas datos={datos} onVerTicket={handleVerTicket} />
        )}
      </div>

      {ventaSeleccionada && (
        <TicketModal venta={ventaSeleccionada} onCerrar={() => setVentaSeleccionada(null)} />
      )}
    </div>
  );
}