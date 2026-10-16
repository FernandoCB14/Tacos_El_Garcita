// Todo el dinero del backend viaja como CENTAVOS ENTEROS (1800 = $18.00).
// Esta es la ÚNICA función que lo convierte a texto para mostrarlo en pantalla.
const formateador = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
});

export const formatearDinero = (centavos) => formateador.format(centavos / 100);