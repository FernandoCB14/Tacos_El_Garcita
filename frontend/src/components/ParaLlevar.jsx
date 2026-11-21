import { useEffect, useRef, useState } from "react";
import {
  crearPedidoParaLlevar,
  obtenerPedidosParaLlevar,
  obtenerPedidoParaLlevar,
  actualizarProductoParaLlevar,
  agregarProductoParaLlevar,
  eliminarProductoParaLlevar,
  obtenerMenu,
  cobrarPedidoParaLlevar,
  obtenerTicket,
} from "../api";
import TicketModal from "./TicketModal";
import { confirmarCobro, mostrarError } from "../utils/alertas";
import {
  ShoppingBag,
  Trash2,
  Banknote,
  CreditCard,
  ReceiptText,
} from "lucide-react";
import { formatearDinero } from "../formato";
import "../styles/detalle-mesa.css";
import "../styles/para-llevar.css";

const ETIQUETAS_CATEGORIA = {
  tacos: "Tacos",
  con_queso: "Con queso",
  frios: "Bebidas y postre",
};

export default function ParaLlevar() {
  const cobroEnProceso = useRef(false);
  const [pedidoId, setPedidoId] = useState(null);
  const [creando, setCreando] = useState(false);
  const [pedidoActual, setPedidoActual] = useState(null);
  const [mostrarPendientes, setMostrarPendientes] = useState(false);
  const [productoActualizando, setProductoActualizando] = useState(null);
  const [cantidadEditando, setCantidadEditando] = useState(null);
  const [categoria, setCategoria] = useState(null);
  const [cantidadTemporal, setCantidadTemporal] = useState("");
  const [productoAgregando, setProductoAgregando] = useState(false);
  const [metodoPago, setMetodoPago] = useState("efectivo");
  const [cobrando, setCobrando] = useState(false);
  const [ventaCobrada, setVentaCobrada] = useState(null);

  const [menu, setMenu] = useState([]);
  const [pedidosPendientes, setPedidosPendientes] = useState([]);

  const categorias = [...new Set(menu.map((producto) => producto.categoria))];
  const categoriaActiva = categoria ?? categorias[0];

  const productosDeCategoria = menu.filter(
    (producto) => producto.categoria === categoriaActiva,
  );

  useEffect(() => {
    let activo = true;

    const cargarPendientes = async () => {
      try {
        const respuesta = await obtenerPedidosParaLlevar();

        if (activo) {
          setPedidosPendientes(respuesta);
        }
      } catch (error) {
        console.error("Error al cargar pedidos pendientes:", error);
      }
    };

    cargarPendientes();

    return () => {
      activo = false;
    };
  }, []);

  useEffect(() => {
    if (pedidoId === null) {
      setPedidoActual(null);
      return;
    }

    let activo = true;

    const cargarPedido = async () => {
      try {
        const respuesta = await obtenerPedidoParaLlevar(pedidoId);

        if (activo) {
          setPedidoActual(respuesta);
        }
      } catch (error) {
        console.error("Error al cargar el pedido:", error);
      }
    };

    cargarPedido();

    return () => {
      activo = false;
    };
  }, [pedidoId]);

  useEffect(() => {
    let activo = true;

    const cargarMenu = async () => {
      try {
        const productos = await obtenerMenu();

        if (activo) {
          setMenu(productos);
        }
      } catch (error) {
        console.error("Error al cargar el menú:", error);
      }
    };

    cargarMenu();

    return () => {
      activo = false;
    };
  }, []);

  const actualizarPendientes = async () => {
    try {
      const respuesta = await obtenerPedidosParaLlevar();
      setPedidosPendientes(respuesta);
    } catch (error) {
      console.error("Error al actualizar pedidos pendientes:", error);
    }
  };

  const handleNuevoPedido = async () => {
    if (creando || pedidoId !== null) return;

    setCreando(true);

    try {
      const pedido = await crearPedidoParaLlevar();
      setPedidoId(pedido.pedido_id);
      await actualizarPendientes();
    } catch (error) {
      console.error("Error al crear pedido:", error);
      alert(`No se pudo crear el pedido: ${error.message}`);
    } finally {
      setCreando(false);
    }
  };

  const handleCambiarCantidad = async (producto, cambio) => {
    if (productoActualizando !== null || pedidoId === null) return;

    const nuevaCantidad = producto.cantidad + cambio;

    if (nuevaCantidad < 1) return;

    setProductoActualizando(producto.detalle_id);

    try {
      await actualizarProductoParaLlevar(
        pedidoId,
        producto.detalle_id,
        nuevaCantidad,
      );

      const pedidoActualizado = await obtenerPedidoParaLlevar(pedidoId);
      setPedidoActual(pedidoActualizado);
    } catch (error) {
      console.error("Error al actualizar cantidad:", error);
      alert(`No se pudo actualizar la cantidad: ${error.message}`);
    } finally {
      setProductoActualizando(null);
    }
  };

  const handleGuardarCantidadExacta = async (producto) => {
    const nuevaCantidad = Number(cantidadTemporal);

    if (
      !Number.isSafeInteger(nuevaCantidad) ||
      nuevaCantidad < 1 ||
      cantidadTemporal.trim() === ""
    ) {
      alert("Introduce una cantidad válida mayor que cero.");
      return;
    }

    if (productoActualizando !== null || pedidoId === null) return;

    setProductoActualizando(producto.detalle_id);

    try {
      await actualizarProductoParaLlevar(
        pedidoId,
        producto.detalle_id,
        nuevaCantidad,
      );

      const pedidoActualizado = await obtenerPedidoParaLlevar(pedidoId);
      setPedidoActual(pedidoActualizado);

      setCantidadEditando(null);
      setCantidadTemporal("");
    } catch (error) {
      console.error("Error al guardar cantidad:", error);
      alert(`No se pudo actualizar la cantidad: ${error.message}`);
    } finally {
      setProductoActualizando(null);
    }
  };

  const handleAgregarRapido = async (producto, tipoCarne = null) => {
    if (productoAgregando || pedidoId === null) return;

    setProductoAgregando(true);

    try {
      await agregarProductoParaLlevar(pedidoId, {
        producto_id: producto.producto_id,
        cantidad: 1,
        carne: producto.lleva_carne === 1 ? tipoCarne : null,
      });

      const pedidoActualizado = await obtenerPedidoParaLlevar(pedidoId);
      setPedidoActual(pedidoActualizado);
    } catch (error) {
      console.error("Error al agregar producto:", error);
      alert(`No se pudo agregar el producto: ${error.message}`);
    } finally {
      setProductoAgregando(false);
    }
  };

  const handleEliminarProducto = async (producto) => {
    if (productoActualizando !== null || pedidoId === null) return;

    setProductoActualizando(producto.detalle_id);

    try {
      await eliminarProductoParaLlevar(pedidoId, producto.detalle_id);

      const pedidoActualizado = await obtenerPedidoParaLlevar(pedidoId);
      setPedidoActual(pedidoActualizado);
    } catch (error) {
      console.error("Error al eliminar producto:", error);
      alert(`No se pudo eliminar el producto: ${error.message}`);
    } finally {
      setProductoActualizando(null);
    }
  };

  const handleDejarPendiente = () => {
    if (pedidoId === null) return;

    if (productoAgregando || productoActualizando !== null) return;

    setPedidoId(null);
    setPedidoActual(null);
    setCantidadEditando(null);
    setCantidadTemporal("");
    setMostrarPendientes(false);
    actualizarPendientes();
  };

  const handleCobrar = async () => {
    if (
      cobroEnProceso.current ||
      cobrando ||
      pedidoId === null ||
      !pedidoActual?.productos?.length ||
      pedidoActual.total_centavos <= 0 ||
      productoAgregando ||
      productoActualizando !== null
    ) {
      return;
    }
    cobroEnProceso.current = true;
    setCobrando(true);

    try {
      const confirmado = await confirmarCobro({
        pedido: pedidoId,
        total: formatearDinero(pedidoActual.total_centavos),
        metodo: metodoPago === "efectivo" ? "Efectivo" : "Mercado Pago",
      });

      if (!confirmado) return;

      const venta = await cobrarPedidoParaLlevar(pedidoId, metodoPago);

      setVentaCobrada(venta);
    } catch (error) {
      console.error("Error al cobrar pedido:", error);

      await mostrarError(
        `No se pudo confirmar el cobro: ${error.message}. ` +
          "Si el pago ya fue realizado, revisa Ventas del día " +
          "antes de intentar nuevamente.",
      );
    } finally {
      cobroEnProceso.current = false;
      setCobrando(false);
    }
  };

  return (
    <div className="comanda-pagina para-llevar">
      <header className="comanda-encabezado">
        <div>
          <span className="comanda-subtitulo">TACOS EL GARCITA · COMANDAS</span>

          <h2>Para llevar</h2>

          <p>Captura y cobra pedidos rápidamente.</p>
        </div>

        <span className="comanda-estado">
          <ShoppingBag size={20} />
          {pedidoId === null ? "Pedido nuevo" : `Pedido #${pedidoId}`}
        </span>
      </header>

      <div className="para-llevar-barra-pendientes">
        <div className="comanda-pendientes-resumen">
          <span>Pedidos pendientes</span>

          <strong>{pedidosPendientes.length}</strong>
        </div>

        <button
          type="button"
          className="para-llevar-boton"
          onClick={() => setMostrarPendientes(!mostrarPendientes)}
          aria-expanded={mostrarPendientes}
        >
          {mostrarPendientes ? "Ocultar pendientes" : "Ver pendientes"}
        </button>
      </div>

      {mostrarPendientes && (
        <div className="comanda-pendientes-lista">
          {pedidoId !== null && (
            <p className="para-llevar-aviso-activo">
              Estás trabajando en el pedido #{pedidoId}. Para recuperar otro,
              primero pulsa "Dejar pendiente".
            </p>
          )}

          {pedidosPendientes.length === 0 ? (
            <p>No hay pedidos pendientes.</p>
          ) : (
            pedidosPendientes.map((pedido) => (
              <button
                key={pedido.pedido_id}
                type="button"
                className="para-llevar-pedido-pendiente"
                disabled={pedidoId !== null}
                onClick={() => {
                  setPedidoId(pedido.pedido_id);
                  setMostrarPendientes(false);
                }}
              >
                <span className="para-llevar-pedido-datos">
                  <strong>Pedido #{pedido.pedido_id}</strong>

                  <span>{formatearDinero(pedido.total_centavos)}</span>
                </span>

                <span className="para-llevar-pedido-recuperar">Recuperar</span>
              </button>
            ))
          )}
        </div>
      )}

      <div className="comanda-layout">
        <section className="comanda-menu-panel">
          <h3>Agregar productos</h3>

          <div className="comanda-categorias">
            {categorias.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`comanda-categoria ${
                  cat === categoriaActiva ? "activa" : ""
                }`}
                onClick={() => setCategoria(cat)}
              >
                {ETIQUETAS_CATEGORIA[cat] ?? cat}
              </button>
            ))}
          </div>

          <div className="comanda-productos-grid">
            {productosDeCategoria.map((producto) => {
              const esConQueso = producto.categoria === "con_queso";
              const llevaCarne = producto.lleva_carne === 1;

              return (
                <div
                  key={producto.producto_id}
                  className="comanda-producto comanda-producto-rapido"
                >
                  <span className="comanda-producto-nombre">
                    {producto.nombre}
                  </span>

                  <span className="comanda-producto-precio">
                    {formatearDinero(producto.precio_centavos)}
                  </span>

                  <div className="comanda-producto-botones">
                    {esConQueso && llevaCarne ? (
                      <>
                        <button
                          type="button"
                          className="comanda-boton-normal"
                          disabled={productoAgregando || pedidoId === null}
                          onClick={() =>
                            handleAgregarRapido(producto, "normal")
                          }
                        >
                          + Normal
                        </button>

                        <button
                          type="button"
                          className="comanda-boton-suadero"
                          disabled={productoAgregando || pedidoId === null}
                          onClick={() =>
                            handleAgregarRapido(producto, "suadero")
                          }
                        >
                          + Suadero
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="comanda-boton-agregar"
                        disabled={productoAgregando || pedidoId === null}
                        onClick={() => handleAgregarRapido(producto)}
                      >
                        + Agregar
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {pedidoActual && (
          <aside className="comanda-ticket-panel">
            <h3>Comanda #{pedidoActual.pedido_id}</h3>

            {pedidoActual.productos.length === 0 && (
              <p className="comanda-vacia">
                Todavía no hay productos en este pedido.
              </p>
            )}

            <div className="comanda-lista">
              {pedidoActual.productos.map((producto) => (
                <div key={producto.detalle_id} className="comanda-item">
                  <div className="comanda-item-superior">
                    <strong>{producto.nombre}</strong>

                    <span className="comanda-item-precio">
                      {formatearDinero(
                        producto.cantidad * producto.precio_centavos,
                      )}
                    </span>
                  </div>

                  {producto.tipo_carne && (
                    <div className="comanda-item-detalle">
                      <span>Carne: {producto.tipo_carne}</span>
                    </div>
                  )}

                  <div className="comanda-item-controles">
                    <div className="comanda-cantidad-controles">
                      <button
                        type="button"
                        disabled={
                          productoActualizando !== null ||
                          producto.cantidad <= 1
                        }
                        onClick={() => handleCambiarCantidad(producto, -1)}
                        aria-label={`Quitar una unidad de ${producto.nombre}`}
                      >
                        −
                      </button>

                      <button
                        type="button"
                        className="comanda-cantidad-valor"
                        disabled={productoActualizando !== null}
                        title="Introducir cantidad exacta"
                        onClick={() => {
                          setCantidadEditando(producto.detalle_id);
                          setCantidadTemporal(String(producto.cantidad));
                        }}
                      >
                        {producto.cantidad}
                      </button>

                      <button
                        type="button"
                        disabled={productoActualizando !== null}
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
                        disabled={productoActualizando !== null}
                        onClick={() => handleEliminarProducto(producto)}
                        aria-label={`Eliminar ${producto.nombre} de la comanda`}
                        title={`Eliminar ${producto.nombre}`}
                      >
                        <Trash2 size={22} strokeWidth={2} />
                      </button>
                    </div>
                  </div>

                  {cantidadEditando === producto.detalle_id && (
                    <div className="comanda-cantidad-editor">
                      <label htmlFor={`cantidad-${producto.detalle_id}`}>
                        Cantidad exacta
                      </label>

                      <input
                        id={`cantidad-${producto.detalle_id}`}
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
                          disabled={productoActualizando !== null}
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

            <h4>
              Total a pagar: {formatearDinero(pedidoActual.total_centavos)}
            </h4>

            <h3>Método de pago</h3>

            <div className="comanda-metodos-pago">
              <button
                type="button"
                onClick={() => setMetodoPago("efectivo")}
                aria-pressed={metodoPago === "efectivo"}
                style={{
                  border:
                    metodoPago === "efectivo"
                      ? "2px solid #009745"
                      : "1px solid #ccc",
                  backgroundColor:
                    metodoPago === "efectivo" ? "#e2f4e9" : "white",
                }}
              >
                <Banknote size={24} />
                Efectivo
              </button>

              <button
                type="button"
                onClick={() => setMetodoPago("tarjeta")}
                aria-pressed={metodoPago === "tarjeta"}
                style={{
                  border:
                    metodoPago === "tarjeta"
                      ? "2px solid #009745"
                      : "1px solid #ccc",
                  backgroundColor:
                    metodoPago === "tarjeta" ? "#e2f4e9" : "white",
                }}
              >
                <CreditCard size={24} />
                Mercado Pago
              </button>
            </div>

            <button
              type="button"
              onClick={handleCobrar}
              disabled={
                cobrando ||
                productoAgregando ||
                productoActualizando !== null ||
                !pedidoActual?.productos?.length ||
                pedidoActual.total_centavos <= 0
              }
              className="comanda-boton-cobrar"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
                width: "100%",
                padding: "14px 20px",
                backgroundColor: "#009745",
                color: "white",
                border: "none",
                borderRadius: "8px",
                fontSize: "16px",
                fontWeight: "bold",
                cursor: cobrando ? "not-allowed" : "pointer",
              }}
            >
              <ReceiptText size={28} strokeWidth={2} />

              {cobrando
                ? "Procesando cobro..."
                : `Cobrar ${formatearDinero(
                    pedidoActual.total_centavos,
                  )} e imprimir ticket`}
            </button>

            <button
              type="button"
              className="para-llevar-boton para-llevar-boton-pendiente"
              onClick={handleDejarPendiente}
              disabled={productoAgregando || productoActualizando !== null}
            >
              Dejar pendiente
            </button>
          </aside>
        )}
      </div>

      <button
        type="button"
        className="para-llevar-boton para-llevar-boton-nuevo"
        onClick={handleNuevoPedido}
        disabled={creando || pedidoId !== null}
      >
        {creando ? "Creando pedido..." : "Nuevo pedido"}
      </button>

      {ventaCobrada && (
        <TicketModal
          venta={ventaCobrada}
          onCerrar={() => {
            setVentaCobrada(null);
            setPedidoId(null);
            setPedidoActual(null);
            setMetodoPago("efectivo");
            setMostrarPendientes(false);
            actualizarPendientes();
          }}
        />
      )}
    </div>
  );
}
