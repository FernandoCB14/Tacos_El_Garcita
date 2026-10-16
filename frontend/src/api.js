const API_URL = "http://127.0.0.1:8000";

const leerError = async (res, mensajePorDefecto) => {
  const cuerpo = await res.json().catch(() => ({}));
  // FastAPI manda "detail" como texto en los errores que levantamos nosotros (404, 400),
  // pero como lista en los errores de validación (422).
  return typeof cuerpo.detail === "string" ? cuerpo.detail : mensajePorDefecto;
};

export const obtenerMenu = async () => {
  const res = await fetch(`${API_URL}/menu`);
  if (!res.ok) throw new Error(await leerError(res, "No se pudo cargar el menú"));
  return await res.json();
};

export const obtenerEstadoMesas = async() => {
  const res = await fetch(`${API_URL}/mesa/estado`);
  if (!res.ok) throw new Error("No se pudo consultar el estado de las mesas");
  return await res.json();
}


//función para abrir mesa
export const abrirMesa = async (num_mesa = 1)=>{
  const url = `${API_URL}/abrir-mesa/ ${num_mesa}`;
  const res = await fetch(url, {method : "POST"})
  if (!res.ok) throw new Error("Error al agregar el producto");
  return await res.json();
  
}
// Función para obtener la orden completa
export const obtenerTicket = async (num_mesa = 1) => {
  const res = await fetch(`${API_URL}/ordenes/${num_mesa}/ticket`);
  if (!res.ok) throw new Error("Error al obtener la orden");
  return await res.json();
};

// Función para agregar un alimento a la orden
export const agregarProducto = async ({ num_mesa, producto_id, cantidad, carne }) => {
  const res = await fetch(`${API_URL}/ordenes/productos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ num_mesa, producto_id, cantidad, carne }),
  });
  if (!res.ok) throw new Error(await leerError(res, "Error al agregar el producto"));
  return await res.json();
};
//Función para eliminar un producto
export const eliminarProducto = async(orden_id) =>{
    
    const url = `${API_URL}/ordenes/eliminar-producto/${orden_id}` 
    const res = await fetch(url, { method: "DELETE" });

    if (!res.ok) throw new Error("Error al eliminar el producto");
    return await res.json();
};

export const cerrarMesa = async(num_mesa) =>{
  if (!num_mesa) {
    throw new Error("Se requiere un número de mesa válido para poder cerrarla.");
  }
   const url =`${API_URL}/ordenes/${num_mesa}/cerrar`
   const res = await fetch(url, {method : "DELETE"});
   if(!res.ok) throw new Error("Error al cerrar la mesa")
    return await res.json();
}

export const actualizarProducto = async (datos) => {
  const url = `${API_URL}/ordenes/actualizar`;

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      orden_id: datos.orden_id, 
      cantidad: datos.cantidad,
      carne: datos.carne,
      num_mesa: datos.num_mesa
    }),
  });

  if (!res.ok) throw new Error("Error al actualizar el producto");
  return await res.json();
};
