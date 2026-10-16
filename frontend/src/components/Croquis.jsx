import React from "react";

export default function Croquis({mesaSeleccionada, setMesaSeleccionada, estadosMesas = {} }){
    const mesas = [
    { num: 1, posClass: "mesa-pos-1" },
    { num: 2, posClass: "mesa-pos-2" },
    { num: 3, posClass: "mesa-pos-3" },
    { num: 4, posClass: "mesa-pos-4" },
    { num: 5, posClass: "mesa-pos-5" },
  ];
    return(
        <div style={{textAlign: "center", marginBottom: "20px"}}>
            <h2>Croquis del restaurante</h2>
            <div style={{display: "flex", justifyContent: "center", gap: "15px", marginBottom: "15px"}}>
                <span>🟢 Libre</span>
                <span>🔴 Ocupada</span>
                <span>🟡 Seleccionada</span>
            </div>
            <div className="dado-grid">
                {mesas.map(({num, posClass})=>{
                    const estaOcupada = estadosMesas[num]; 
                    const estaSeleccionada = num === mesaSeleccionada;
                    return(
                        <button
                            key={num}
                            onClick={() => setMesaSeleccionada(num)}
                            className={`btn-mesa ${posClass} ${estaOcupada ? "ocupada" : "libre"} ${estaSeleccionada ? "seleccionada" : ""}`}
                        >
                            <span style={{ fontSize: "18px" }}>🪑</span>
                            <span>Mesa {num}</span>
                        </button>
                    )
                })}
            </div>
        </div>
    )
}