const CONCEPTS = [
  {
    title: "Spatio-Temporal Signal",
    text: "Traffic state is handled as q(t), where each node carries dynamic congestion over time.",
  },
  {
    title: "Conservation With Residue",
    text: "Flow balance uses incoming, outgoing, and residue terms to model realistic queue carry-over.",
  },
  {
    title: "Quantum Phase Mapping",
    text: "Classical traffic features are transformed into bounded rotation angles before quantum embedding.",
  },
  {
    title: "Open-Path Entanglement",
    text: "The variational circuit uses CNOT 0->1->2->3 only, preserving directional topology.",
  },
];

const EQUATIONS = [
  {
    label: "Step A: Pre-projection",
    expr: "u(t) = W_pre e(t) + b_pre,   α(t) = π tanh(u(t))",
    note: "Maps 8-D GNN embedding to 4 valid qubit angles.",
  },
  {
    label: "Step B: Angle Embedding",
    expr: "|ψ_emb(t)⟩ = ∏(i=0→3) Rᵧ(αᵢ(t)) |0000⟩",
    note: "Loads traffic-conditioned phase into each qubit wire.",
  },
  {
    label: "Step B: Variational Open Path",
    expr: "For each layer ℓ: ∏(i=0→3) Rᵧ(θℓ,i), then CNOT(0,1), CNOT(1,2), CNOT(2,3)",
    note: "No ring closure gate CNOT(3,0) is used.",
  },
  {
    label: "Step C: Readout",
    expr: "zᵢ(t) = ⟨ψ(t)|Zᵢ|ψ(t)⟩,   y(t) = W_post z(t) + b_post",
    note: "Converts quantum expectation vector back to classical model space.",
  },
  {
    label: "Traffic Local Signal",
    expr: "q_local = 0.7·density_norm + 0.3·(1 − speed_norm)",
    note: "High density and low speed increase congestion signal.",
  },
  {
    label: "Temporal Blend",
    expr: "q(t) = β·q(t−1) + (1−β)·graph_mix",
    note: "Smooths abrupt changes with temporal memory.",
  },
  {
    label: "Residue Proxy",
    expr: "residue = 0.45|q(t)−q(t−1)| + 0.35·saturation + 0.20·delay_pressure",
    note: "Practical queue carry-over estimate for real road behavior.",
  },
  {
    label: "Conservation Balance",
    expr: "residue_balance = max(0, flow_in − flow_out)",
    note: "Captures unresolved traffic that remains in the system.",
  },
];

export default function MathematicalAspectPage() {
  return (
    <section className="math-page">
      <article className="panel math-hero">
        <p className="eyebrow">Model Blueprint</p>
        <h2>Mathematical Aspect Of Spatio-Temporal QGNN</h2>
        <p className="panel-note">
          This section summarizes the equations and concepts used by the backend pipeline so you can compare output
          values directly with paper calculations.
        </p>
      </article>

      <article className="panel">
        <h3>Core Concepts</h3>
        <div className="concept-grid">
          {CONCEPTS.map((concept) => (
            <div key={concept.title} className="concept-card">
              <h4>{concept.title}</h4>
              <p>{concept.text}</p>
            </div>
          ))}
        </div>
      </article>

      <article className="panel">
        <h3>Equation Library</h3>
        <div className="equation-list">
          {EQUATIONS.map((eq) => (
            <div key={eq.label} className="equation-card">
              <p className="equation-label">{eq.label}</p>
              <pre className="equation-expr">{eq.expr}</pre>
              <p className="equation-note">{eq.note}</p>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
