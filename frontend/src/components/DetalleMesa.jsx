import { useState, useEffect } from "react";
import { formatearDinero } from "../formato";
import {
  obtenerTicket,
  obtenerMenu,
  agregarProducto,
  eliminarProducto,
  actualizarProducto,
  cerrarMesa,
  abrirMesa,
} from "../api";

// Carnes disponibles para los productos que llevan carne.
const CARNES = [
  { valor: "suadero", etiqueta: "Suadero" },
  { valor: "pastor", etiqueta: "Pastor" },
  { valor: "bistec", etiqueta: "Bistec" },
  { valor: "chorizo", etiqueta: "Chorizo" },
  { valor: "campechanos", etiqueta: "Campechanos" },
];

// Cómo se muestra cada categoría de la base de datos en pantalla.
const ETIQUETAS_CATEGORIA = {
  tacos: "Tacos",
  con_queso: "Con queso",
  frios: "Bebidas y postre",
};

export default function DetalleMesa({ mesaSeleccionada }) {
  // ---- Estado "real": datos que no se pueden calcular a partir de otros ----
  const [orden, setOrden] = useState(null);
  const [menu, setMenu] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const [categoria, setCategoria] = useState(null); // null = "la primera que haya"
  const [productoId, setProductoId] = useState(null);
  const [carne, setCarne] = useState("suadero");
  const [cantidad, setCantidad] = useState(1);

  const [productoAeditar, setProductoAeditar] = useState(null);

  // ---- Estado derivado: se CALCULA en cada render, no se guarda ----
  // [...new Set(...)] quita las categorías repetidas y las vuelve a convertir en lista.
  const categorias = [...new Set(menu.map((p) => p.categoria))];
  const categoriaActiva = categoria ?? categorias[0];
  const productosDeCategoria = menu.filter((p) => p.categoria === categoriaActiva);
  const productoElegido = productosDeCategoria.find((p) => p.producto_id === productoId);

  // En el panel de edición: ¿el producto que se edita lleva carne?
  const productoDelCatalogo = productoAeditar
    ? menu.find((p) => p.producto_id === productoAeditar.producto_id)
    : null;
  const editaLlevaCarne = productoDelCatalogo?.lleva_carne === 1;

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

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!productoElegido) {
      alert("⚠️ Elige un producto del menú.");
      return;
    }

    setCargando(true);
    try {
      await agregarProducto({
        num_mesa: mesaSeleccionada,
        producto_id: productoElegido.producto_id,
        cantidad,
        // Solo mandamos carne si el producto la lleva
        carne: productoElegido.lleva_carne ? carne : null,
      });
      setCantidad(1);
      await cargarTicket();
    } catch (err) {
      console.error(err);
      alert(`No se pudo agregar: ${err.message}`);
    } finally {
      setCargando(false);
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
    if (!num_mesa) {
      alert("⚠️ Error: No se especificó el número de mesa.");
      return;
    }

    const confirmado = window.confirm(
      `🚨 ¿Confirmas que deseas cobrar y cerrar la MESA ${num_mesa}?\n\nEsta acción borrará el ticket actual y liberará la mesa.`
    );
    if (!confirmado) return;

    try {
      setCargando(true);
      await cerrarMesa(num_mesa);
      alert(`✅ La Mesa ${num_mesa} ha sido cerrada con éxito.`);
      await cargarTicket();
    } catch (err) {
      console.error("Error al cerrar la mesa:", err);
      alert(`No se pudo cerrar la mesa: ${err.message}`);
    } finally {
      setCargando(false);
    }
  };

  const handleGuardarEdicion = async () => {
    if (!productoAeditar) return;
    try {
      await actualizarProducto({
        orden_id: productoAeditar.orden_id,
        cantidad: productoAeditar.cantidad,
        carne: editaLlevaCarne ? productoAeditar.tipo_carne : null,
      });
      setProductoAeditar(null);
      await cargarTicket();
    } catch (err) {
      console.error("Error al editar tu orden:", err);
      alert(`No se pudo actualizar: ${err.message}`);
    }
  };

  // -------------------------------------------------------------------
  // PIEZAS REUTILIZABLES (se escriben una vez y se usan en varias pantallas)
  // -------------------------------------------------------------------
  const formularioAgregar = (
    <form onSubmit={handleSubmit} style={{ marginTop: "20px" }}>
      <h3>Agregar a la mesa</h3>

      {menu.length === 0 ? (
        <p>Cargando menú...</p>
      ) : (
        <>
          {/* Pestañas de categoría. type="button" evita que envíen el formulario. */}
          <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
            {categorias.map((cat) => {
              const activa = cat === categoriaActiva;
              return (
                <button
                  type="button"
                  key={cat}
                  onClick={() => setCategoria(cat)}
                  style={{
                    padding: "6px 12px",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontWeight: activa ? "bold" : "normal",
                    backgroundColor: activa ? "#007bff" : "#eee",
                    color: activa ? "white" : "black",
                  }}
                >
                  {ETIQUETAS_CATEGORIA[cat] ?? cat}
                </button>
              );
            })}
          </div>

          {/* Producto */}
          <div>
            <label>Producto: </label>
            <select
              value={productoElegido?.producto_id ?? ""}
              onChange={(e) => setProductoId(Number(e.target.value))}
            >
              <option value="">-- Elige --</option>
              {productosDeCategoria.map((p) => (
                <option key={p.producto_id} value={p.producto_id}>
                  {p.nombre} - {formatearDinero(p.precio_centavos)}
                </option>
              ))}
            </select>
          </div>

          {/* Carne: solo aparece si el producto elegido la lleva */}
          {productoElegido?.lleva_carne === 1 && (
            <div style={{ marginTop: "10px" }}>
              <label>Carne: </label>
              <select value={carne} onChange={(e) => setCarne(e.target.value)}>
                {CARNES.map((c) => (
                  <option key={c.valor} value={c.valor}>
                    {c.etiqueta}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Cantidad */}
          <div style={{ marginTop: "10px" }}>
            <label>Cantidad: </label>
            <input
              type="number"
              min="1"
              value={cantidad}
              onChange={(e) => setCantidad(parseInt(e.target.value, 10) || 1)}
            />
          </div>

          <button type="submit" disabled={cargando} style={{ marginTop: "10px" }}>
            {cargando ? "Agregando..." : "Agregar"}
          </button>
        </>
      )}
    </form>
  );

  const seccionCerrarMesa = (
    <div style={{ marginTop: "30px", paddingTop: "15px", borderTop: "1px solid #ddd" }}>
      <h3>Cerrar mesa</h3>
      <button
        type="button"
        onClick={() => handleCerrarMesa(orden?.num_mesa)}
        style={{
          color: "#d9534f",
          border: "1px solid #d9534f",
          backgroundColor: "transparent",
          borderRadius: "4px",
          cursor: "pointer",
          padding: "8px 12px",
          fontWeight: "bold",
        }}
      >
        💳 Cobrar y Cerrar Mesa {orden?.num_mesa}
      </button>
    </div>
  );

  // -------------------------------------------------------------------
  // GUARDAS: cada una decide qué pantalla mostrar y corta con "return"
  // -------------------------------------------------------------------

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

  // 3. Mesa cerrada: lo único posible es abrirla
  if (!orden?.abierta) {
    return (
      <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
        <h3>Mesa {mesaSeleccionada}</h3>
        <p>⚠️ La mesa está cerrada actualmente.</p>

        <button
          type="button"
          onClick={handleAbrirMesa}
          disabled={cargando}
          style={{
            marginTop: "15px",
            padding: "10px 20px",
            backgroundColor: "#28a745",
            color: "white",
            border: "none",
            borderRadius: "5px",
            fontSize: "16px",
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          🟢 Abrir Mesa
        </button>
      </div>
    );
  }

  // 4. Mesa abierta, sin pedidos todavía
  if (orden.productos.length === 0) {
    return (
      <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
        <h3>Mesa {mesaSeleccionada} (abierta)</h3>
        <p>Aún no hay pedidos.</p>

        {formularioAgregar}
        {seccionCerrarMesa}
      </div>
    );
  }

  // -------------------------------------------------------------------
  // VISTA PRINCIPAL: mesa abierta con pedidos (sin "if": si llegamos aquí,
  // es porque ninguna guarda de arriba se cumplió)
  // -------------------------------------------------------------------
  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
      <h3>Mesa {orden.num_mesa}</h3>

      <ul>
        {orden.productos.map((producto) => (
          <li key={producto.orden_id} style={{ marginBottom: "8px" }}>
            {producto.cantidad} x {producto.nombre}
            {producto.tipo_carne ? ` (${producto.tipo_carne})` : ""} -{" "}
            {formatearDinero(producto.cantidad * producto.precio_centavos)}

            <button
              onClick={() => handleEliminarProducto(producto.orden_id)}
              style={{
                marginLeft: "12px",
                color: "#d9534f",
                border: "1px solid #d9534f",
                backgroundColor: "transparent",
                borderRadius: "4px",
                cursor: "pointer",
                padding: "2px 8px",
              }}
            >
              ❌ Eliminar
            </button>

            <button
              onClick={() => setProductoAeditar(producto)}
              style={{ marginLeft: "8px", cursor: "pointer" }}
            >
              ✏️ Actualizar
            </button>
          </li>
        ))}
      </ul>

      {/* Panel de edición */}
      {productoAeditar && (
        <div
          style={{
            margin: "15px 0",
            padding: "15px",
            border: "2px solid #007bff",
            borderRadius: "6px",
            backgroundColor: "#f4f8ff",
          }}
        >
          <h4>✏️ Editando: {productoAeditar.nombre}</h4>

          <div style={{ marginBottom: "10px" }}>
            <label>
              Cantidad:
              <input
                type="number"
                min="1"
                value={productoAeditar.cantidad}
                onChange={(e) =>
                  setProductoAeditar({
                    ...productoAeditar,
                    cantidad: parseInt(e.target.value, 10) || 1,
                  })
                }
                style={{ marginLeft: "8px", width: "60px" }}
              />
            </label>
          </div>

          {/* La carne solo se edita si el producto la lleva */}
          {editaLlevaCarne && (
            <div style={{ marginBottom: "10px" }}>
              <label>
                Carne:
                <select
                  value={productoAeditar.tipo_carne ?? "suadero"}
                  onChange={(e) =>
                    setProductoAeditar({
                      ...productoAeditar,
                      tipo_carne: e.target.value,
                    })
                  }
                  style={{ marginLeft: "8px" }}
                >
                  {CARNES.map((c) => (
                    <option key={c.valor} value={c.valor}>
                      {c.etiqueta}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          <button onClick={handleGuardarEdicion} style={{ marginRight: "8px" }}>
            💾 Guardar
          </button>
          <button onClick={() => setProductoAeditar(null)}>❌ Cancelar</button>
        </div>
      )}

      <h4>Total a pagar: {formatearDinero(orden.total_centavos)}</h4>

      {formularioAgregar}
      {seccionCerrarMesa}
    </div>
  );
}
