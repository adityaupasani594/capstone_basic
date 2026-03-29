import { NavLink, Route, Routes } from "react-router-dom";
import SimpleNetworkPage from "./pages/SimpleNetworkPage";
import ComplexNetworkPage from "./pages/ComplexNetworkPage";
import MathematicalAspectPage from "./pages/MathematicalAspectPage";

export default function App() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <p className="eyebrow">Quantum Traffic Studio</p>
          <h1>Spatio-Temporal QGNN</h1>
          <p className="hero-subtitle">Hybrid GCN + Quantum control, with live operational insights.</p>
        </div>

        <nav className="sidebar-nav">
          <NavLink to="/" end className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}>
            <span className="sidebar-link-title">Implementation</span>
            <span className="sidebar-link-desc">Live controls, metrics, residue, and circuit depiction</span>
          </NavLink>

          <NavLink to="/complex" className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}>
            <span className="sidebar-link-title">Hierarchical Demo</span>
            <span className="sidebar-link-desc">Ward-minor-major topology and 21-junction aggregation</span>
          </NavLink>

          <NavLink to="/mathematical-aspect" className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}>
            <span className="sidebar-link-title">Mathematical Aspect</span>
            <span className="sidebar-link-desc">Formulas, conservation laws, and quantum workflow equations</span>
          </NavLink>
        </nav>
      </aside>

      <main className="workspace">
        <Routes>
          <Route path="/" element={<SimpleNetworkPage />} />
          <Route path="/complex" element={<ComplexNetworkPage />} />
          <Route path="/mathematical-aspect" element={<MathematicalAspectPage />} />
        </Routes>
      </main>
    </div>
  );
}
