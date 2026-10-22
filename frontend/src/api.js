const API_URL = "http://127.0.0.1:8000";

// Convierte una respuesta fallida en el mensaje REAL que mandó el backend.
// FastAPI manda "detail" como texto en los errores que levantamos nosotros (404, 400, 500),
// pero como lista en los errores de validación (422).
const leerError = async (res, mensajePorDefecto) => {
  const cuerpo = await res.json().catch(() => ({}));
  return typeof cuerpo.detail === "string" ? cuerpo.detail : mensajePorDefecto;
};

// Una sola función hace la petición, revisa el resultado y lanza el error si falla.
// Así no se repite el mismo bloque en cada llamada.
const pedir = async (ruta, opciones = {}, mensajePorDefecto = "Error inesperado") => {
  const res = await fetch(`${API_URL}${ruta}`, opciones);
  if (!res.ok) throw new Error(await leerError(res, mensajePorDefecto));
  return await res.json();
};

// Arma las opciones de una petición que lleva datos en el cuerpo (JSON).
const conJSON = (metodo, datos) => ({
  method: metodo,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(datos),
});

// ---- Mesas ----
export const obtenerEstadoMesas = () =>
  pedir("/mesa/estado", {}, "No se pudo consultar el estado de las mesas");

export const abrirMesa = (num_mesa) =>
  pedir(`/abrir-mesa/${num_mesa}`, { method: "POST" }, "Error al abrir la mesa");

export const cerrarMesa = async (num_mesa) => {
  if (!num_mesa) {
    throw new Error("Se requiere un número de mesa válido para poder cerrarla.");
  }
  return pedir(`/ordenes/${num_mesa}/cerrar`, { method: "DELETE" }, "Error al cerrar la mesa");
};

export const cobrarMesa = (num_mesa) =>{
  if (!num_mesa) {
    throw new Error("Se requiere un número de mesa válido para poder cobrar.");
  }
  return pedir(`/ordenes/${num_mesa}/cobrar`, { method: "POST" }, "Error al cobrar la mesa");
};
  

// ---- Menú y cuenta ----
export const obtenerMenu = () =>
  pedir("/menu", {}, "No se pudo cargar el menú");

export const obtenerTicket = (num_mesa) =>
  pedir(`/ordenes/${num_mesa}/ticket`, {}, "Error al obtener la orden");

// ---- Productos de la cuenta ----
export const agregarProducto = ({ num_mesa, producto_id, cantidad, carne }) =>
  pedir(
    "/ordenes/productos",
    conJSON("POST", { num_mesa, producto_id, cantidad, carne }),
    "Error al agregar el producto"
  );

export const actualizarProducto = ({ orden_id, cantidad, carne }) =>
  pedir(
    "/ordenes/actualizar",
    conJSON("PUT", { orden_id, cantidad, carne }),
    "Error al actualizar el producto"
  );

export const eliminarProducto = (orden_id) =>
  pedir(`/ordenes/eliminar-producto/${orden_id}`, { method: "DELETE" }, "Error al eliminar el producto");