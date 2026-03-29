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
  {
    title: "Next-Step Node Prediction",
    text: "Each node outputs q(t+1) from an 8-feature predictor, then converts it to physical density for the next time instance.",
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
  {
    label: "Prediction Features (Per Node)",
    expr: "x_pred = [density_norm, 1−speed_norm, q_local, q(t), q(t−1), |Δq|, residue, phase_deg/90]",
    note: "Exactly 8 predictor features are built for each node before quantum inference.",
  },
  {
    label: "Quantum Predictor Output",
    expr: "raw = TrafficQuantumLayer(x_pred),   q_base = sigmoid(raw)",
    note: "Quantum-layer readout is squashed to [0,1] as a base next-step traffic estimate.",
  },
  {
    label: "Stable Next-Step Blend",
    expr: "q(t+1) = clamp(0.7·q_base + 0.3·q(t), 0, 1)",
    note: "Blends predicted signal with current state to avoid abrupt one-step spikes.",
  },
  {
    label: "Next-Step Density",
    expr: "density(t+1) = q(t+1) · MAX_DENSITY   (MAX_DENSITY = 120)",
    note: "Converts normalized q to veh/km used in node cards and temporal metrics.",
  },
];

const PREDICTION_EXAMPLE = {
  qNext: 0.410,
  maxDensity: 120,
};

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

      <article className="panel">
        <h3>Prediction Readout Meaning</h3>
        <div className="equation-list">
          <div className="equation-card">
            <p className="equation-label">What "Predicted q(t+1)" Means</p>
            <pre className="equation-expr">Normalized congestion forecast for next time step, bounded in [0, 1].</pre>
            <p className="equation-note">Example: q(t+1)=0.410 means the model expects about 41.0% of max congestion next step.</p>
          </div>
          <div className="equation-card">
            <p className="equation-label">What "Predicted density(t+1)" Means</p>
            <pre className="equation-expr">density(t+1) = {PREDICTION_EXAMPLE.qNext.toFixed(3)} × {PREDICTION_EXAMPLE.maxDensity} = {(PREDICTION_EXAMPLE.qNext * PREDICTION_EXAMPLE.maxDensity).toFixed(2)} veh/km</pre>
            <p className="equation-note">This is the physical traffic density conversion of the normalized prediction.</p>
          </div>
          <div className="equation-card">
            <p className="equation-label">Calibration Note</p>
            <pre className="equation-expr">Prediction quality depends on learned weights from historical traffic sequences.</pre>
            <p className="equation-note">
              If no trained checkpoint is loaded, q(t+1) is still structurally valid but should be interpreted as an initialized model estimate,
              not a calibrated forecast.
            </p>
          </div>
        </div>
      </article>
    </section>
  );
}
