import { createPortal } from "react-dom";
import { formatearDinero } from "../formato";
import "./ticket.css";

// Datos del negocio: se imprimen en el encabezado del ticket. Ajústalos a tu sucursal.
const NEGOCIO = {
  nombre: "TACOS EL GARCITA",
  direccion: "Calzada de las Artes 36, Hidalgo, Santiago de Querétaro, Qro.",
  despedida: "¡Gracias por su visita!",
};

// "2026-10-18 14:30:05"  →  "18/10/2026 14:30"
// (se corta el texto a mano en lugar de usar Date, para no meternos con zonas horarias)
const formatearFecha = (texto) => {
  if (!texto) return "";
  const [fecha, hora = ""] = texto.split(" ");
  const [anio, mes, dia] = fecha.split("-");
  return `${dia}/${mes}/${anio} ${hora.slice(0, 5)}`;
};

// El ticket en sí. Recibe una VENTA ya guardada (no la orden abierta).
export function Ticket({ venta }) {
  const folio = String(venta.venta_id).padStart(5, "0");

  return (
    <div className="ticket">
      <h1>{NEGOCIO.nombre}</h1>
      <p className="centrado">{NEGOCIO.direccion}</p>
      <hr />
      <p>Folio: {folio}</p>
      <p>Mesa: {venta.num_mesa}</p>
      <p>Fecha: {formatearFecha(venta.cerrada_en)}</p>
      <hr />
      {venta.productos.map((p) => (
        <div className="linea" key={p.detalle_id}>
          <span>
            {p.cantidad} x {p.nombre}
            {p.tipo_carne ? ` (${p.tipo_carne})` : ""}
          </span>
          <span>{formatearDinero(p.cantidad * p.precio_centavos)}</span>
        </div>
      ))}
      <hr />
      <div className="linea total">
        <span>TOTAL</span>
        <span>{formatearDinero(venta.total_centavos)}</span>
      </div>
      <hr />
      <p className="centrado">{NEGOCIO.despedida}</p>
    </div>
  );
}

// La ventana que aparece después de cobrar, con los botones.
export default function TicketModal({ venta, onCerrar }) {
  return (
    <>
      {/* Lo que ves en pantalla */}
      <div className="ticket-modal-fondo">
        <div className="ticket-modal">
          <Ticket venta={venta} />
          <div className="ticket-botones">
            <button onClick={() => window.print()}>🖨️ Imprimir ticket</button>
            <button onClick={onCerrar}>Cerrar</button>
          </div>
        </div>
      </div>

      {/* Lo que se imprime: una copia colgada directamente de <body>, FUERA de #root.
          Así el CSS de impresión puede ocultar toda la app (#root) sin esconder el ticket. */}
      {createPortal(
        <div className="ticket-impresion">
          <Ticket venta={venta} />
        </div>,
        document.body
      )}
    </>
  );
}
