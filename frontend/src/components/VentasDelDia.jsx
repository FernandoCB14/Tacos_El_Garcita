import { useEffect, useState } from "react";
import { obtenerVentas, obtenerVenta } from "../api";
import { formatearDinero } from "../formato";
import TicketModal from "./TicketModal";
import { Banknote, CreditCard, ReceiptText, Calendar1 } from "lucide-react";

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
  const [busqueda, setBusqueda] = useState("");
  const [filtroPago, setFiltroPago] = useState("todas");

  const ventasFiltradas = datos.ventas.filter((venta) => {
    const folio = String(venta.venta_id).padStart(5, "0");

    const coincideFolio = folio.includes(busqueda.trim());

    const coincidePago =
      filtroPago === "todas" || venta.metodo_pago === filtroPago;

    return coincideFolio && coincidePago;
  });

  if (datos.cantidad === 0) {
    return <p>No hay ventas en esta fecha.</p>;
  }

  return (
    <>
      <p style={{ fontSize: "18px" }}>
        <strong>{datos.cantidad}</strong>{" "}
        {datos.cantidad === 1 ? "venta" : "ventas"} · Total:{" "}
        <strong>{formatearDinero(datos.total_centavos)}</strong>
      </p>

      <div className="ventas-resumen-financiero">
        <div className="ventas-indicador">
          <span>Ventas brutas</span>
          <strong>{formatearDinero(datos.total_centavos)}</strong>
        </div>

        <div className="ventas-indicador">
          <span>Efectivo</span>
          <strong>{formatearDinero(datos.total_efectivo_centavos)}</strong>
        </div>

        <div className="ventas-indicador">
          <span>Mercado Pago</span>
          <strong>{formatearDinero(datos.total_tarjeta_centavos)}</strong>
        </div>

        <div className="ventas-indicador">
          <span>Comisiones estimadas</span>
          <strong>{formatearDinero(datos.total_comisiones_centavos)}</strong>
        </div>

        <div className="ventas-indicador ventas-indicador-neto">
          <span>Ingreso neto estimado</span>
          <strong>{formatearDinero(datos.total_neto_centavos)}</strong>
        </div>
      </div>

      <div className="ventas-historial-controles">
        <h3>Historial de operaciones</h3>

        <input
          type="search"
          className="ventas-buscador"
          placeholder="🔎 Buscar por folio..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          aria-label="Buscar venta por folio"
        />

        <div className="ventas-filtros">
          <button
            type="button"
            className={filtroPago === "todas" ? "activo" : ""}
            onClick={() => setFiltroPago("todas")}
          >
            Todas
          </button>

          <button
            type="button"
            className={filtroPago === "efectivo" ? "activo" : ""}
            onClick={() => setFiltroPago("efectivo")}
          >
            Efectivo
          </button>

          <button
            type="button"
            className={filtroPago === "tarjeta" ? "activo" : ""}
            onClick={() => setFiltroPago("tarjeta")}
          >
            Mercado Pago
          </button>
        </div>

        <p className="ventas-resultados">
          {ventasFiltradas.length} ventas encontradas
        </p>
      </div>

      <div className="ventas-lista">
        {ventasFiltradas.length === 0 ? (
          <p className="ventas-sin-resultados">
            No se encontraron ventas con estos filtros.
          </p>
        ) : (
          ventasFiltradas.map((v) => (
            <div className="venta-fila" key={v.venta_id}>
              <div
                className={`venta-icono ${
                  v.metodo_pago === "tarjeta"
                    ? "venta-icono-tarjeta"
                    : "venta-icono-efectivo"
                }`}
                aria-hidden="true"
              >
                {v.metodo_pago === "tarjeta" ? (
                  <CreditCard size={24} strokeWidth={2} />
                ) : (
                  <Banknote size={24} strokeWidth={2} />
                )}
              </div>

              <div className="venta-informacion">
                <strong>
                  Venta #{String(v.venta_id).padStart(5, "0")}
                  {" · "}
                  {v.tipo_venta === "para_llevar"
                    ? `Para llevar #${v.pedido_para_llevar_id}`
                    : `Mesa ${v.num_mesa}`}
                </strong>

                <span>
                  {soloHora(v.cerrada_en)}
                  {" · "}
                  {v.metodo_pago === "tarjeta"
                    ? "Mercado Pago"
                    : v.metodo_pago === "efectivo"
                      ? "Efectivo"
                      : "Sin clasificar"}
                </span>
              </div>

              <div className="venta-importes">
                <strong>{formatearDinero(v.total_centavos)}</strong>

                <small>
                  Comisión:{" "}
                  {v.comision_centavos == null
                    ? "Pendiente"
                    : formatearDinero(v.comision_centavos)}
                </small>
              </div>

              <button
                type="button"
                className="venta-boton-ticket"
                onClick={() => onVerTicket(v.venta_id)}
                aria-label={`Ver ticket de venta ${v.venta_id}`}
                title="Ver o reimprimir ticket"
              >
                <ReceiptText size={24} strokeWidth={2} />
              </button>
            </div>
          ))
        )}
      </div>
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
      <div className="ventas-encabezado">
        <div className="ventas-titulos">
          <span className="ventas-subtitulo">
            TACOS EL GARCITA · ADMINISTRACIÓN
          </span>
          <h2>Ventas del día</h2>

          <p>Consulta de ventas y movimientos</p>
        </div>

        <label className="ventas-fecha">
          <span>
            {" "}
            <Calendar1 size={30} strokeWidth={2} />
          </span>

          <input
            className="fecha-pos"
            type="date"
            value={fecha}
            max={hoyLocal()}
            onChange={(e) => e.target.value && setFecha(e.target.value)}
            aria-label="Fecha de las ventas"
          />
        </label>
      </div>

      <div style={{ marginTop: "16px" }}>
        {cargando && <p>Cargando ventas...</p>}
        {!cargando && error && <p style={{ color: "#d9534f" }}>⚠️ {error}</p>}
        {!cargando && !error && datos && (
          <ListaVentas datos={datos} onVerTicket={handleVerTicket} />
        )}
      </div>

      {ventaSeleccionada && (
        <TicketModal
          venta={ventaSeleccionada}
          onCerrar={() => setVentaSeleccionada(null)}
        />
      )}
    </div>
  );
}
