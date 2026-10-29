import { useEffect, useState } from "react";
import Croquis from "./components/Croquis";
import DetalleMesa from "./components/DetalleMesa";
import VentasDelDia from "./components/VentasDelDia";
import "./App.css";
import { obtenerEstadoMesas } from "./api";
import AppHeader from "./components/AppHeader";

function App() {
  // Estado para la mesa seleccionada actualmente
  const [mesaSeleccionada, setMesaSeleccionada] = useState(null);
  const [vista, setVista] = useState("croquis");

  // Estados ficticios/simulados para probar que las rojas y verdes cambien de color
  const [estadosMesas, setEstadoMesas] = useState({
    1: false,   // Mesa 1 Ocupada (Rojo)
    2: false,  // Mesa 2 Libre (Verde)
    3: false,   // Mesa 3 Ocupada (Rojo)
    4: false,  // Mesa 4 Libre (Verde)
    5: false,  // Mesa 5 Libre (Verde)
  });

  // consultar a la API qué mesas están abiertas en la base de datos
  const actualizarEstado = async() => {
    const estadosReales = await obtenerEstadoMesas();
    setEstadoMesas(estadosReales);
  }
  useEffect(() =>{
    if (vista=== "croquis") {
      actualizarEstado();
    }
  }, [vista]);

  const handleSeleccionarMesa = (num_mesa) => {
    setMesaSeleccionada(num_mesa);
    setVista("detalle")
  };

  const handVolverAlcroquis = () => {
    setMesaSeleccionada(null);
    setVista("croquis")
  }

  const navegarA = (nuevaVista) => {
  setMesaSeleccionada(null);
  setVista(nuevaVista);
};

  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif", maxWidth: "800px", margin: "0 auto" }}>
      {vista === "croquis" && (
        <div style={{ textAlign: "center", marginBottom: "20px" }}>
          <AppHeader
            vista={vista}
            onNavegar={navegarA}
          />
        </div>
      )}

      {/* Evaluamos qué pantalla mostrar según la variable 'vista' */}
      {vista === "croquis" ? (
        /* PANTALLA 1: CROQUIS */
        <Croquis 
          mesaSeleccionada={mesaSeleccionada}
          setMesaSeleccionada={handleSeleccionarMesa}
          estadosMesas={estadosMesas}
        />
      ) : (
        /* PANTALLA 2: DETALLE DE LA COMANDA */
        <div>
          <button 
            onClick={handVolverAlcroquis}
            style={{ 
              marginBottom: "20px", 
              padding: "10px 18px", 
              fontSize: "15px",
              cursor: "pointer",
              backgroundColor: "#6c757d",
              color: "white",
              border: "none",
              borderRadius: "6px",
              fontWeight: "bold"
            }}
          >
            ⬅️ Regresar al Croquis
          </button>

          {vista === "detalle" && <DetalleMesa mesaSeleccionada={mesaSeleccionada} />}
          {vista === "ventas" && <VentasDelDia />}
        </div>
      )}
    </div>
  );
}

export default App;