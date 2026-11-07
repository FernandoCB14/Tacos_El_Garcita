import React, { useState } from "react";
import CuentaRapida from "./CuentaRapida";
import TicketModal from "./TicketModal";
import { abrirMesa } from "../api";

export default function Croquis({
  mesaSeleccionada,
  setMesaSeleccionada,
  estadosMesas = {},
  onVerCuenta,
  mesaParaCobrar,
  setMesaParaCobrar,
  onActualizarMesas,
}) {
  const [ventaCobrada, setVentaCobrada] = useState(null);

  const [mesaAbriendo, setMesaAbriendo] = useState(null);

  const handleEntrarMesa = async (num, estaOcupada) => {
    // Evitamos abrir dos mesas al mismo tiempo.
    if (mesaAbriendo !== null) return;

    // Si ya está ocupada, solo mostramos su comanda.
    if (estaOcupada) {
      setMesaSeleccionada(num);
      return;
    }

    try {
      setMesaAbriendo(num);

      // Abrimos la mesa en la base de datos.
      await abrirMesa(num);

      // Actualizamos el estado del croquis.
      await onActualizarMesas();

      // Entramos a la comanda cuando la apertura terminó.
      setMesaSeleccionada(num);
    } catch (err) {
      console.error("Error al abrir mesa:", err);

      alert(`No se pudo abrir la Mesa ${num}: ${err.message}`);
    } finally {
      setMesaAbriendo(null);
    }
  };

  const handleCobroExitoso = (venta) => {
    setVentaCobrada(venta);
    setMesaParaCobrar(null);

    // Actualizamos los colores y el resumen de las mesas.
    Promise.resolve()
      .then(() => onActualizarMesas())
      .catch((err) => {
        console.error("No se pudo actualizar el croquis:", err);
      });
  };
  const mesas = [{ num: 1 }, { num: 2 }, { num: 4 }, { num: 5 }, { num: 6 }];

  const mesasOcupadas = mesas.filter((mesa) => estadosMesas[mesa.num]).length;
  const mesasLibres = mesas.length - mesasOcupadas;

  return (
    <section className="mesas-layout">
      <div className="mesas-panel">
        <div className="mesas-panel-header">
          <div>
            <h2>Mesas</h2>
            <p>Selecciona una mesa para continuar</p>
          </div>
        </div>

        <div className="mesa-grid">
          {mesas.map(({ num }) => {
            const estaOcupada = Boolean(estadosMesas[num]);
            const estaSeleccionada = num === mesaSeleccionada;

            return (
              <div
                key={num}
                className={`mesa-card ${
                  estaOcupada ? "ocupada" : "libre"
                } ${estaSeleccionada ? "seleccionada" : ""}`}
              >
                <div className="mesa-card-superior">
                  <span className="mesa-card-titulo">Mesa {num}</span>

                  <span className="mesa-card-icono" aria-hidden="true">
                    {estaOcupada ? "📋" : "✓"}
                  </span>
                </div>

                <div className="mesa-card-informacion">
                  <span className="mesa-card-estado">
                    {estaOcupada ? "Ocupada" : "Libre"}
                  </span>

                  <span className="mesa-card-descripcion">
                    {estaOcupada ? "Comanda abierta" : "Disponible"}
                  </span>
                </div>

                <div className="mesa-card-botones">
                  <button
                    type="button"
                    className="mesa-boton-principal"
                    disabled={mesaAbriendo !== null}
                    onClick={() => handleEntrarMesa(num, estaOcupada)}
                  >
                    {mesaAbriendo === num
                      ? "Abriendo..."
                      : estaOcupada
                        ? "Ver comanda"
                        : "Abrir mesa"}
                  </button>

                  {estaOcupada && (
                    <button
                      type="button"
                      className="mesa-boton-cobrar"
                      onClick={() => onVerCuenta(num)}
                    >
                      Cobrar
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <aside className="resumen-panel">
        {mesaParaCobrar !== null ? (
          <CuentaRapida
            key={mesaParaCobrar}
            numMesa={mesaParaCobrar}
            onCerrar={() => setMesaParaCobrar(null)}
            onCobroExitoso={handleCobroExitoso}
          />
        ) : (
          <>
            <h3>Resumen</h3>

            <div className="resumen-stats">
              <div className="stat-card">
                <span className="stat-numero">{mesasLibres}</span>
                <span className="stat-label">Libres</span>
              </div>

              <div className="stat-card">
                <span className="stat-numero">{mesasOcupadas}</span>
                <span className="stat-label">Ocupadas</span>
              </div>
            </div>
          </>
        )}
      </aside>
      {ventaCobrada && (
        <TicketModal
          venta={ventaCobrada}
          onCerrar={() => setVentaCobrada(null)}
        />
      )}
    </section>
  );
}
