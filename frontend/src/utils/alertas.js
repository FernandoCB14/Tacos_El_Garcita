
import Swal from "sweetalert2";
import "../styles/alertas.css";


export async function confirmarAccion({
  titulo,
  mensaje,
  textoConfirmar = "Confirmar",
}) {
  const resultado = await Swal.fire({
    html: `
      <div class="cobro-nuevo-encabezado">
        <div class="cobro-nuevo-marca">
          <strong>TACOS<br>EL GARCITA</strong>
        </div>
      </div>

      <div class="cobro-nuevo-cuerpo">
        <div class="cobro-nuevo-icono">
          <svg viewBox="0 0 24 24" width="32" height="32"
               fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round"
               stroke-linejoin="round" aria-hidden="true">
              <path d="M10 12h.01"/>
              <path d="M18 6V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16"/>
              <path d="M2 20h20"/>
              <path d="M20 20V8a2 2 0 0 0-2-2H6"/>
              <path d="M6 2v18"/>
          </svg>
        </div>

        <h2 id="accion-titulo"></h2>

        <p id="accion-mensaje"></p>
      </div>
    `,

    showCancelButton: true,
    confirmButtonText: textoConfirmar,
    cancelButtonText: "Cancelar",

    buttonsStyling: false,
    reverseButtons: true,
    focusCancel: true,

    customClass: {
      popup: "alerta-pos cobro-nuevo",
      htmlContainer: "cobro-nuevo-html",
      actions: "alerta-pos-acciones",
      confirmButton: "alerta-pos-confirmar",
      cancelButton: "alerta-pos-cancelar",
    },

    didOpen: (popup) => {
      popup.querySelector("#accion-titulo").textContent =
        String(titulo);

      popup.querySelector("#accion-mensaje").textContent =
        String(mensaje);
    },
  });

  return resultado.isConfirmed;
}



export async function mostrarError(mensaje) {
  await Swal.fire({
    title: "Ocurrió un error",
    text: mensaje,
    icon: "error",

    confirmButtonText: "Entendido",
    buttonsStyling: false,

    customClass: {
      popup: "alerta-pos",
      title: "alerta-pos-titulo",
      htmlContainer: "alerta-pos-mensaje",
      icon: "alerta-pos-icono",
      actions: "alerta-pos-acciones",
      confirmButton: "alerta-pos-confirmar",
    },
  });
}


export async function confirmarCobro({ mesa, pedido, total, metodo }) {
  const identificador = pedido != null
  ? `Para llevar #${pedido}`
  : `Mesa ${mesa}`;
  const resultado = await Swal.fire({
    html: `
      <div class="cobro-nuevo-encabezado">
        <div class="cobro-nuevo-marca">
          <strong>TACOS<br>EL GARCITA</strong>
        </div>
      </div>

      <div class="cobro-nuevo-cuerpo">
        <div class="cobro-nuevo-icono">
          <svg viewBox="0 0 24 24" width="32" height="32"
               fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round"
               stroke-linejoin="round" aria-hidden="true">
            <rect x="2" y="5" width="20" height="14" rx="2"/>
            <path d="M2 10h20"/>
            <path d="M6 15h4"/>
          </svg>
        </div>

        <h2>Confirmar cobro</h2>
        <p>
          Vas a registrar el pago de la
          <strong id="cobro-mesa"></strong>.
        </p>

        <div class="cobro-nuevo-resumen">
          <span>Total a cobrar</span>
          <strong id="cobro-total"></strong>
          <div class="cobro-nuevo-metodo">
            Método de pago:
            <b id="cobro-metodo"></b>
          </div>
        </div>
      </div>
    `,

    showCancelButton: true,
    confirmButtonText: "Confirmar cobro",
    cancelButtonText: "Cancelar",

    buttonsStyling: false,
    reverseButtons: true,
    focusCancel: true,
    ariaLabel: "Confirmación de cobro",

    customClass: {
      popup: "alerta-pos cobro-nuevo",
      htmlContainer: "cobro-nuevo-html",
      actions: "alerta-pos-acciones",
      confirmButton: "alerta-pos-confirmar",
      cancelButton: "alerta-pos-cancelar",
    },

    didOpen: (popup) => {
      popup.querySelector("#cobro-mesa").textContent =
        identificador;

      popup.querySelector("#cobro-total").textContent =
        String(total);

      popup.querySelector("#cobro-metodo").textContent =
        String(metodo);
    },
  });

  return resultado.isConfirmed;
}
