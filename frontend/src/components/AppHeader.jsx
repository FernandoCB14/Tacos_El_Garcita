
export default function AppHeader({ vista, onNavegar }) {
  return (
    <header className="app-header">

      <div className="app-header-marca">
        <div className="app-header-icono">
          🌮
        </div>

        <div>
          <h1>TACOS EL GARCITA</h1>
          <p>Punto de venta</p>
        </div>
      </div>

      <nav className="app-navegacion">

        <button
          type="button"
          className={vista === "croquis" ? "nav-activo" : ""}
          onClick={() => onNavegar("croquis")}
        >
          Mesas
        </button>

        <button
          type="button"
          disabled
          title="Próximamente"
        >
          Para llevar
        </button>

        <button
          type="button"
          className={
            vista === "croquis" || vista === "detalle"
                ? "nav-activo"
                : ""
            }
          onClick={() => onNavegar("ventas")}
        >
          Ventas
        </button>

      </nav>

    </header>
  );
}
