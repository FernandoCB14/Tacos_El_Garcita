
import React from "react";

export default function Croquis({
  mesaSeleccionada,
  setMesaSeleccionada,
  estadosMesas = {},
}) {
  const mesas = [
    { num: 1, posClass: "mesa-pos-1" },
    { num: 2, posClass: "mesa-pos-2" },
    { num: 5, posClass: "mesa-pos-3" },
    { num: 4, posClass: "mesa-pos-4" },
    { num: 6, posClass: "mesa-pos-5" },
  ];

  const mesasOcupadas = mesas.filter(
    (mesa) => estadosMesas[mesa.num]
  ).length;

  const mesasLibres = mesas.length - mesasOcupadas;

  return (
    <div className="croquis-container">

      <div className="croquis-header">
        <div>
          <h2>Mesas del restaurante</h2>
          <p>Selecciona una mesa para continuar</p>
        </div>

        <div className="resumen-mesas">
          <span>{mesasLibres} libres</span>
          <span>{mesasOcupadas} ocupadas</span>
        </div>
      </div>

      <div className="dado-grid">
        {mesas.map(({ num, posClass }) => {
          const estaOcupada = Boolean(estadosMesas[num]);

          const estaSeleccionada =
            num === mesaSeleccionada;

          return (
            <button
              key={num}
              type="button"
              onClick={() => setMesaSeleccionada(num)}
              aria-label={`Mesa ${num}, ${
                estaOcupada ? "ocupada" : "libre"
              }`}
              className={`btn-mesa ${posClass} ${
                estaOcupada ? "ocupada" : "libre"
              } ${estaSeleccionada ? "seleccionada" : ""}`}
            >
              <span className="mesa-icono" aria-hidden="true">
                🪑
              </span>

              <span className="mesa-numero">
                Mesa {num}
              </span>

              <span className="mesa-estado">
                {estaOcupada ? "Ocupada" : "Libre"}
              </span>
            </button>
          );
        })}
      </div>

    </div>
  );
}
