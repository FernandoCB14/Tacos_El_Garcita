import { useState, useEffect, useRef } from "react";
import { formatearDinero } from "../formato";
import TicketModal from "./TicketModal";
import { Banknote, CreditCard, ReceiptText } from "lucide-react";
import "../styles/detalle-mesa.css";

import {
  confirmarAccion,
  mostrarError,
  confirmarCobro,
} from "../utils/alertas";

import {
  obtenerTicket,
  obtenerMenu,
  agregarProducto,
  eliminarProducto,
  actualizarProducto,
  cerrarMesa,
  cobrarMesa,
  abrirMesa,
} from "../api";

// Cómo se muestra cada categoría de la base de datos en pantalla.

const ETIQUETAS_CATEGORIA = {
  tacos: "Tacos",
  con_queso: "Con queso",
  frios: "Bebidas y postre",
};

export default function DetalleMesa({ mesaSeleccionada, onMesaCerrada }) {
  // ---- Estado "real": datos que no se pueden calcular a partir de otros ----
  const [orden, setOrden] = useState(null);
  const [menu, setMenu] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [categoria, setCategoria] = useState(null); // null = "la primera que haya"
  const [productoAgregando, setProductoAgregando] = useState(false);
  const [ventaCobrada, setVentaCobrada] = useState(null); // la venta que se muestra el ticket
  const cobroEnProceso = useRef(false);
  const [metodoPago, setMetodoPago] = useState("efectivo");

  // ---- Estado derivado: se CALCULA en cada render, no se guarda ----

  // [...new Set(...)] quita las categorías repetidas y las vuelve a convertir en lista.

  const categorias = [...new Set(menu.map((p) => p.categoria))];
  const categoriaActiva = categoria ?? categorias[0];
  const productosDeCategoria = menu.filter(
    (p) => p.categoria === categoriaActiva,
  );
  const [productoActualizando, setProductoActualizando] = useState(null);
  const [cantidadEditando, setCantidadEditando] = useState(null);
  const [cantidadTemporal, setCantidadTemporal] = useState("");

  // -------------------------------------------------------------------

  // CARGA DE DATOS

  // -------------------------------------------------------------------

  const cargarTicket = async () => {
    try {
      const data = await obtenerTicket(mesaSeleccionada);

      setOrden(data);

      setError(null);
    } catch (err) {
      console.error("Error al cargar ticket:", err);

      setError(err.message || "No se pudo conectar con el servidor");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarTicket();
  }, [mesaSeleccionada]);

  // El menú se pide UNA vez ([] = solo al montar el componente).

  // El callback de useEffect no puede ser async directamente, por eso la función interna.

  useEffect(() => {
    const cargarMenu = async () => {
      try {
        setMenu(await obtenerMenu());
      } catch (err) {
        console.error("Error al cargar el menú:", err);

        setError(err.message || "No se pudo cargar el menú");
      }
    };

    cargarMenu();
  }, []);

  // -------------------------------------------------------------------

  // ACCIONES

  // -------------------------------------------------------------------

  const handleAbrirMesa = async () => {
    if (orden?.abierta) {
      alert("⚠️ Esta mesa ya está abierta.");

      return;
    }

    setCargando(true);

    try {
      await abrirMesa(mesaSeleccionada);

      await cargarTicket();
    } catch (err) {
      console.error("Error al abrir mesa:", err);

      alert(`No se pudo abrir la mesa: ${err.message}`);
    } finally {
      setCargando(false);
    }
  };

  const bloqueoAgregarRef = useRef(false);

  const handleAgregarRapido = async (producto, tipoCarne = null) => {
    if (bloqueoAgregarRef.current) return;

    bloqueoAgregarRef.current = true;

    setProductoAgregando(true);

    try {
      await agregarProducto({
        num_mesa: mesaSeleccionada,

        producto_id: producto.producto_id,

        cantidad: 1,

        carne: producto.lleva_carne === 1 ? tipoCarne : null,
      });

      await cargarTicket();
    } catch (error) {
      console.error("Error al agregar producto:", error);

      alert(error.message || "No se pudo agregar el producto.");
    } finally {
      bloqueoAgregarRef.current = false;

      setProductoAgregando(false);
    }
  };

  const handleEliminarProducto = async (orden_id) => {
    try {
      await eliminarProducto(orden_id);

      await cargarTicket();
    } catch (err) {
      console.error(err);

      alert(`No se pudo eliminar: ${err.message}`);
    }
  };

  const handleCerrarMesa = async (num_mesa) => {
    if (!num_mesa || !orden?.abierta) return;

    // Solo permitimos cerrar sin cobrar si no hay productos.

    if (orden.productos.length > 0) {
      alert(
        "Esta mesa tiene productos registrados. " +
          "Debes cobrarla antes de cerrarla.",
      );

      return;
    }

    const confirmado = await confirmarAccion({
      titulo: `Cerrar Mesa ${num_mesa}`,
      mensaje: "La mesa está vacía y no se registrará ninguna venta.",
      textoConfirmar: "Sí, cerrar mesa",
    });
    if (!confirmado) return;
    try {
      setCargando(true);
      await cerrarMesa(num_mesa);
      onMesaCerrada?.();
    } catch (err) {
      await mostrarError(`No se pudo cerrar la mesa: ${err.message}`);
    } finally {
      setCargando(false);
    }
  };

  const handleCobrar = async () => {
    if (
      cobroEnProceso.current ||
      cargando ||
      !orden?.abierta ||
      !orden?.productos?.length ||
      orden.total_centavos <= 0
    ) {
      return;
    }

    // Bloqueamos inmediatamente los clics repetidos.

    cobroEnProceso.current = true;

    try {
      const nombreMetodo =
        metodoPago === "efectivo" ? "Efectivo" : "Mercado Pago";

      const confirmado = await confirmarCobro({
        mesa: orden.num_mesa,
        total: formatearDinero(orden.total_centavos),
        metodo: nombreMetodo,
      });

      if (!confirmado) return;
      setCargando(true);
      const venta = await cobrarMesa(orden.num_mesa, metodoPago);
      setVentaCobrada(venta);
      await cargarTicket();
    } catch (err) {
      console.error("Error al cobrar:", err);

      alert(
        `No se pudo confirmar el cobro: ${err.message}\n\n` +
          "Si el pago ya fue realizado, verifica el historial de " +
          "ventas antes de intentar cobrar nuevamente.",
      );
    } finally {
      cobroEnProceso.current = false;

      setCargando(false);
    }
  };

  const handleCambiarCantidad = async (producto, cambio) => {
    if (productoActualizando !== null || cargando) return;

    const nuevaCantidad = producto.cantidad + cambio;

    // Nunca permitimos cantidades menores que 1.

    if (nuevaCantidad < 1) return;

    try {
      setProductoActualizando(producto.orden_id);

      await actualizarProducto({
        orden_id: producto.orden_id,

        cantidad: nuevaCantidad,

        carne: producto.tipo_carne ?? null,
      });

      await cargarTicket();
    } catch (err) {
      console.error("Error al actualizar cantidad:", err);

      alert(`No se pudo actualizar la cantidad: ${err.message}`);
    } finally {
      setProductoActualizando(null);
    }
  };

  const handleGuardarCantidadExacta = async (producto) => {
    const nuevaCantidad = Number(cantidadTemporal);

    // Validamos que sea un número entero positivo.

    if (
      !Number.isSafeInteger(nuevaCantidad) ||
      nuevaCantidad < 1 ||
      cantidadTemporal.trim() === ""
    ) {
      alert("Introduce una cantidad válida mayor que cero.");

      return;
    }

    if (productoActualizando !== null || cargando) return;

    try {
      setProductoActualizando(producto.orden_id);

      await actualizarProducto({
        orden_id: producto.orden_id,

        cantidad: nuevaCantidad,

        carne: producto.tipo_carne ?? null,
      });

      await cargarTicket();

      setCantidadEditando(null);

      setCantidadTemporal("");
    } catch (err) {
      console.error("Error al guardar cantidad:", err);

      alert(`No se pudo actualizar la cantidad: ${err.message}`);
    } finally {
      setProductoActualizando(null);
    }
  };

  const formularioAgregar = (
    <div style={{ marginTop: "20px" }}>
      <h3>Agregar a la mesa</h3>

      {menu.length === 0 ? (
        <p>Cargando menú...</p>
      ) : (
        <>
          {/* Categorías de Comanda Express */}

          <div className="comanda-categorias">
            {categorias.map((cat) => {
              const activa = cat === categoriaActiva;

              return (
                <button
                  key={cat}
                  type="button"
                  disabled={cargando}
                  className={`comanda-categoria ${activa ? "activa" : ""}`}
                  onClick={() => {
                    setCategoria(cat);
                  }}
                >
                  {ETIQUETAS_CATEGORIA[cat] ?? cat}
                </button>
              );
            })}
          </div>

          {/* Productos del menú */}

          <div className="comanda-productos-grid">
            {productosDeCategoria.map((p) => {
              const esConQueso = p.categoria === "con_queso";

              const llevaCarne = p.lleva_carne === 1;

              return (
                <div
                  key={p.producto_id}
                  className="comanda-producto comanda-producto-rapido"
                >
                  <span className="comanda-producto-nombre">{p.nombre}</span>

                  <span className="comanda-producto-precio">
                    {formatearDinero(p.precio_centavos)}
                  </span>

                  <div className="comanda-producto-botones">
                    {esConQueso && llevaCarne ? (
                      <>
                        <button
                          type="button"
                          className="comanda-boton-normal"
                          disabled={cargando || productoAgregando}
                          onClick={() => handleAgregarRapido(p, "normal")}
                        >
                          + Normal
                        </button>

                        <button
                          type="button"
                          className="comanda-boton-suadero"
                          disabled={cargando || productoAgregando}
                          onClick={() => handleAgregarRapido(p, "suadero")}
                        >
                          + Suadero
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="comanda-boton-agregar"
                        disabled={cargando || productoAgregando}
                        onClick={() => handleAgregarRapido(p, null)}
                      >
                        + Agregar
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );

  const seccionCobrar = (
    <div
      style={{
        marginTop: "30px",

        paddingTop: "15px",

        borderTop: "1px solid #ddd",
      }}
    >
      <h3>Método de pago</h3>

      <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
        <button
          type="button"
          disabled={cargando}
          onClick={() => setMetodoPago("efectivo")}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            flex: 1,
            padding: "14px",
            borderRadius: "8px",
            border:
              metodoPago === "efectivo"
                ? "2px solid #009745"
                : "1px solid #ccc",
            backgroundColor: metodoPago === "efectivo" ? "#e2f4e9" : "white",
            cursor: "pointer",
          }}
        >
          <Banknote size={30} strokeWidth={2} />
          Efectivo
        </button>

        <button
          type="button"
          disabled={cargando}
          onClick={() => setMetodoPago("tarjeta")}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            flex: 1,
            padding: "14px",
            borderRadius: "8px",
            border:
              metodoPago === "tarjeta" ? "2px solid #009745" : "1px solid #ccc",
            backgroundColor: metodoPago === "tarjeta" ? "#e2f4e9" : "white",
            cursor: "pointer",
          }}
        >
          <CreditCard size={30} strokeWidth={2} />
          Mercado Pago
        </button>
      </div>

      {metodoPago === "tarjeta" && (
        <p style={{ fontSize: "13px", color: "#795548" }}>
          Verifica que el pago haya sido aprobado en la terminal Mercado Pago
          antes de cobrar.
        </p>
      )}

      <button
        type="button"
        onClick={handleCobrar}
        disabled={
          cargando || !orden?.productos?.length || orden.total_centavos <= 0
        }
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
          width: "100%",
          padding: "14px 20px",
          backgroundColor: "#009745",
          color: "white",
          border: "none",
          borderRadius: "8px",
          fontSize: "16px",
          fontWeight: "bold",
          cursor: cargando ? "not-allowed" : "pointer",
        }}
      >
        <ReceiptText size={30} strokeWidth={2} />
        Cobrar {formatearDinero(orden?.total_centavos ?? 0)} e imprimir ticket
      </button>
    </div>
  );

  // 1. Esperando respuesta de la API

  if (cargando) {
    return (
      <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
        <p>Cargando datos...</p>
      </div>
    );
  }

  // 2. Falla real (servidor apagado, error 500, etc.)

  if (error) {
    return (
      <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
        <p style={{ color: "#d9534f" }}>⚠️ {error}</p>
      </div>
    );
  }

  return (
    <div className="comanda-pagina">
      <header className="comanda-encabezado">
        <div>
          <span className="comanda-subtitulo">TACOS EL GARCITA · COMANDAS</span>

          <h2>Mesa {orden.num_mesa}</h2>

          <p>Selecciona productos y administra la comanda.</p>
        </div>

        <span className="comanda-estado">● Mesa abierta</span>
      </header>

      <div className="comanda-layout">
        <section className="comanda-menu-panel">{formularioAgregar}</section>

        <aside className="comanda-ticket-panel">
          <h3>Comanda actual</h3>

          {orden.productos.length === 0 && (
            <p className="comanda-vacia">
              Todavía no hay productos en esta mesa.
            </p>
          )}

          <div className="comanda-lista">
            {orden.productos.map((producto) => (
              <div key={producto.orden_id} className="comanda-item">
                <div className="comanda-item-superior">
                  <strong>{producto.nombre}</strong>

                  <span className="comanda-item-precio">
                    {formatearDinero(
                      producto.cantidad * producto.precio_centavos,
                    )}
                  </span>
                </div>

                <div className="comanda-item-detalle">
                  {producto.tipo_carne && (
                    <span>Carne: {producto.tipo_carne}</span>
                  )}
                </div>

                <div className="comanda-item-controles">
                  <div className="comanda-cantidad-controles">
                    <button
                      type="button"
                      disabled={
                        productoActualizando !== null ||
                        cargando ||
                        producto.cantidad <= 1
                      }
                      onClick={() => handleCambiarCantidad(producto, -1)}
                      aria-label={`Quitar una unidad de ${producto.nombre}`}
                    >
                      -
                    </button>

                    <button
                      type="button"
                      className="comanda-cantidad-valor"
                      disabled={productoActualizando !== null || cargando}
                      title="Introducir cantidad exacta"
                      onClick={() => {
                        setCantidadEditando(producto.orden_id);

                        setCantidadTemporal(String(producto.cantidad));
                      }}
                    >
                      {producto.cantidad}
                    </button>

                    <button
                      type="button"
                      disabled={productoActualizando !== null || cargando}
                      onClick={() => handleCambiarCantidad(producto, 1)}
                      aria-label={`Agregar una unidad de ${producto.nombre}`}
                    >
                      +
                    </button>
                  </div>

                  <div className="comanda-item-acciones">
                    <button
                      type="button"
                      className="comanda-item-eliminar"
                      onClick={() => handleEliminarProducto(producto.orden_id)}
                      aria-label={`Eliminar ${producto.nombre} de la comanda`}
                      title={`Eliminar ${producto.nombre}`}
                    >
                      <svg
                        xmlns="http\://www.w3.org/2000/svg"
                        width="22"
                        height="22"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M3 6h18" />
                        <path d="M8 6V4h8v2" />
                        <path d="M19 6l-1 14H6L5 6" />
                        <path d="M10 10v7" />
                        <path d="M14 10v7" />
                      </svg>
                    </button>
                  </div>
                </div>

                {cantidadEditando === producto.orden_id && (
                  <div className="comanda-cantidad-editor">
                    <label htmlFor={`cantidad-${producto.orden_id}`}>
                      Cantidad exacta
                    </label>

                    <input
                      id={`cantidad-${producto.orden_id}`}
                      type="number"
                      min="1"
                      step="1"
                      inputMode="numeric"
                      value={cantidadTemporal}
                      onChange={(e) => setCantidadTemporal(e.target.value)}
                    />

                    <div className="comanda-cantidad-editor-acciones">
                      <button
                        type="button"
                        disabled={productoActualizando !== null || cargando}
                        onClick={() => handleGuardarCantidadExacta(producto)}
                      >
                        Guardar
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setCantidadEditando(null);

                          setCantidadTemporal("");
                        }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <h4>Total a pagar: {formatearDinero(orden.total_centavos)}</h4>

          {seccionCobrar}

          {orden.productos.length === 0 && (
            <button
              type="button"
              className="comanda-boton-cerrar-vacia"
              onClick={() => handleCerrarMesa(orden.num_mesa)}
              disabled={cargando}
            >
              Cerrar mesa vacía
            </button>
          )}
        </aside>
      </div>
      {ventaCobrada && (
        <TicketModal
          venta={ventaCobrada}
          onCerrar={() => {
            setVentaCobrada(null);
            onMesaCerrada?.();
          }}
        />
      )}
    </div>
  );
}
