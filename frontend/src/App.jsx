import { NavLink, Route, Routes } from "react-router-dom";
import SimpleNetworkPage from "./pages/SimpleNetworkPage";
import ComplexNetworkPage from "./pages/ComplexNetworkPage";

export default function App() {
  return (
    <div className="shell">
      <header className="hero">
        <p className="eyebrow">Quantum Traffic Studio</p>
        <h1>Spatio-Temporal Quantum Traffic Management</h1>
        <p className="hero-subtitle">Minimal interface, quantum backend, and clear traffic-state visualization.</p>
        <nav className="tabs">
          <NavLink to="/" end className={({ isActive }) => `tab ${isActive ? "active" : ""}`}>
            Linear A-B-C-D
          </NavLink>
          <NavLink to="/complex" className={({ isActive }) => `tab ${isActive ? "active" : ""}`}>
            Complex Hierarchy
          </NavLink>
        </nav>
      </header>

      <main className="content">
        <Routes>
          <Route path="/" element={<SimpleNetworkPage />} />
          <Route path="/complex" element={<ComplexNetworkPage />} />
        </Routes>
      </main>
    </div>
  );
}
