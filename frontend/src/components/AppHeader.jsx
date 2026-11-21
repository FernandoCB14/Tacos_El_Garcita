import {
  LayoutGrid,
  ShoppingBag,
  ChartNoAxesColumn,
  ClipboardList,
} from "lucide-react";

export default function AppHeader({ vista, onNavegar }) {
  return (
    <header className="app-header">
      {/* Identidad del restaurante */}
      <div className="app-header-marca">
        <div className="app-header-icono">
          <img
            src="/logo.png"
            alt="Logotipo de Tacos el Garcita"
            className="app-logo"
          />
        </div>

        <div className="app-header-texto">
          <h1>TACOS EL GARCITA</h1>
          <p>Punto de venta</p>
        </div>
      </div>

      {/* Navegación horizontal */}
      <nav className="app-navegacion" aria-label="Navegación principal">
        <button
          type="button"
          className={vista === "croquis" ? "nav-activo" : ""}
          aria-current={vista === "croquis" ? "page" : undefined}
          onClick={() => onNavegar("croquis")}
        >
          <LayoutGrid size={30} strokeWidth={2} />
          <span>Mesas</span>
        </button>

        <button
          type="button"
          className={vista === "detalle" ? "nav-activo" : ""}
          aria-current={vista === "detalle" ? "page" : undefined}
          onClick={() => onNavegar("detalle")}
        >
          <ClipboardList size={30} strokeWidth={2} />
          <span>Órdenes</span>
        </button>

        <button
          type="button"
          className={vista === "para-llevar" ? "nav-activo" : ""}
          aria-current={vista === "para-llevar" ? "page" : undefined}
          onClick={() => onNavegar("para-llevar")}
        >
          <ShoppingBag size={30} strokeWidth={2} />
          <span>Para llevar</span>
        </button>

        <button
          type="button"
          className={vista === "ventas" ? "nav-activo" : ""}
          aria-current={vista === "ventas" ? "page" : undefined}
          onClick={() => onNavegar("ventas")}
        >
          <ChartNoAxesColumn size={30} strokeWidth={2} />
          <span>Ventas</span>
        </button>
      </nav>
    </header>
  );
}
