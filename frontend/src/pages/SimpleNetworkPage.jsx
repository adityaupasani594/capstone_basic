import { useEffect, useMemo, useState } from "react";
import { fetchSimpleState } from "../api";

const NODE_IDS = ["A", "B", "C", "D"];
const INITIAL_DENSITY = [38, 55, 72, 86];
const INITIAL_SPEED = [62, 54, 44, 33];
const POSITIONS = {
  A: { x: 120, y: 130 },
  B: { x: 330, y: 130 },
  C: { x: 540, y: 130 },
  D: { x: 750, y: 130 },
};

function toDegrees(radians) {
  return (radians * 180) / Math.PI;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function buildPayload(density, speed, prevSmoothed) {
  const nodes = {};
  NODE_IDS.forEach((id, idx) => {
    nodes[id] = { density: Number(density[idx]), speed: Number(speed[idx]) };
  });
  return { nodes, prev_smoothed_q: prevSmoothed };
}

export default function SimpleNetworkPage() {
  const [density, setDensity] = useState(INITIAL_DENSITY);
  const [speed, setSpeed] = useState(INITIAL_SPEED);
  const [prevSmoothed, setPrevSmoothed] = useState([0, 0, 0, 0]);
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadState() {
      setLoading(true);
      setError("");
      try {
        const data = await fetchSimpleState(buildPayload(density, speed, prevSmoothed));
        if (!cancelled) {
          setState(data);
          setPrevSmoothed(NODE_IDS.map((id) => data.nodes[id].q_st));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    const timer = setTimeout(loadState, 110);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [density, speed]);

  const summary = state?.summary;
  const meanDelay = summary?.mean_delay_seconds ?? 0;
  const meanResidue = summary?.mean_residue ?? 0;

  const edgeData = useMemo(() => {
    if (!state) {
      return [];
    }
    return state.edges.map((edge) => {
      const from = POSITIONS[edge.source];
      const to = POSITIONS[edge.target];
      return { ...edge, from, to };
    });
  }, [state]);

  const temporalLens = useMemo(() => {
    if (!state) {
      return [];
    }

    return NODE_IDS.map((id) => {
      const node = state.nodes[id];
      return {
        id,
        phaseDeg: Number(node.phase_deg ?? clamp(toDegrees(node.phi), 0, 90)),
        delaySec: Number(node.delay_seconds ?? 0),
        residue: Number(node.residue_proxy ?? 0),
        conserved: Number(node.residue_balance ?? 0),
        flowIn: Number(node.flow_in ?? 0),
        flowOut: Number(node.flow_out ?? 0),
        qFlowDt: Number(node.q_flow_dt ?? 0),
        residueVolDt: Number(node.residue_volume_dt ?? 0),
        predictedNextQ: Number(node.predicted_next_q ?? 0),
        predictedNextDensity: Number(node.predicted_next_density ?? 0),
        trace: node.trace || {},
      };
    });
  }, [state]);

  return (
    <section className="page-grid">
      <article className="panel panel-scroll">
        <h2>Traffic Controls</h2>
        <p className="panel-note">
          Change density and average speed at each node. Higher density and lower speed increase q(t).
        </p>

        {NODE_IDS.map((id, idx) => (
          <div key={id} className="control-card">
            <h3>Node {id}</h3>
            <label>
              Density ({density[idx]} veh/km)
              <input
                type="range"
                min={0}
                max={120}
                value={density[idx]}
                onChange={(event) => {
                  const next = [...density];
                  next[idx] = Number(event.target.value);
                  setDensity(next);
                }}
              />
            </label>
            <label>
              Avg speed ({speed[idx]} km/h)
              <input
                type="range"
                min={0}
                max={100}
                value={speed[idx]}
                onChange={(event) => {
                  const next = [...speed];
                  next[idx] = Number(event.target.value);
                  setSpeed(next);
                }}
              />
            </label>
            {state && (
              <p className="micro-readout" style={{ background: state.nodes[id].color }}>
                q={state.nodes[id].q_st.toFixed(3)} | q(t+1)={Number(state.nodes[id].predicted_next_q ?? 0).toFixed(3)} | phi={state.nodes[id].phi.toFixed(3)}
              </p>
            )}
          </div>
        ))}
      </article>

      <article className="panel">
        <h2>Linear Network A-B-C-D</h2>
        <p className="panel-note">Qubit nodes are color-coded in increasing traffic order: green, yellow, red, black.</p>

        <svg className="network-svg" viewBox="0 0 870 260">
          <defs>
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {edgeData.map((edge) => {
            const startX = edge.from.x + 50;
            const endX = edge.to.x - 68;
            const y = edge.to.y;
            const strokeWidth = 6 + edge.q * 7;
            return (
              <g key={`${edge.source}-${edge.target}`}>
                <line
                  x1={startX}
                  y1={edge.from.y}
                  x2={endX}
                  y2={y}
                  stroke={edge.color}
                  strokeWidth={strokeWidth}
                  strokeLinecap="round"
                  filter="url(#glow)"
                />
                <polygon
                  points={`${endX + 14},${y} ${endX - 4},${y - 11} ${endX - 4},${y + 11}`}
                  fill={edge.color}
                  filter="url(#glow)"
                />
              </g>
            );
          })}

          {NODE_IDS.map((id) => {
            const p = POSITIONS[id];
            const color = state?.nodes[id]?.color || "rgb(0,255,0)";
            return (
              <g key={id}>
                <circle cx={p.x} cy={p.y} r={54} fill={color} opacity={0.26} />
                <circle cx={p.x} cy={p.y} r={40} fill={color} stroke="#0f172a" strokeWidth={2.4} />
                <text x={p.x} y={p.y + 8} textAnchor="middle" className="node-label">
                  {id}
                </text>
              </g>
            );
          })}
        </svg>

        <div className="stats-row">
          <div className="stat-card">
            <span>Average q</span>
            <strong>{summary ? summary.average_q.toFixed(3) : "--"}</strong>
          </div>
          <div className="stat-card">
            <span>Peak q</span>
            <strong>{summary ? summary.peak_q.toFixed(3) : "--"}</strong>
          </div>
          <div className="stat-card">
            <span>Mean phi</span>
            <strong>{summary ? summary.mean_phi.toFixed(3) : "--"}</strong>
          </div>
        </div>

        {loading && <p className="status-text">Computing quantum state...</p>}
        {error && <p className="status-text error">{error}</p>}

        <div className="readout-list">
          {state &&
            NODE_IDS.map((id) => {
              const node = state.nodes[id];
              return (
                <div key={id} className="readout-item" style={{ background: node.color }}>
                  <span>
                    Node {id}: q={node.q_st.toFixed(3)}, q(t+1)={Number(node.predicted_next_q ?? 0).toFixed(3)}, phi={node.phi.toFixed(3)} rad
                  </span>
                  <span>
                    |0&gt;~{node.amp0.toFixed(3)} | |1&gt;~{node.amp1.toFixed(3)} | next density~{Number(node.predicted_next_density ?? 0).toFixed(2)}
                  </span>
                </div>
              );
            })}
        </div>

        <div className="qgnn-lens">
          <div className="lens-header">
            <div>
              <h3>Spatio-Temporal QGNN Lens</h3>
              <p className="panel-note">
                Backend-calculated live dynamics: projection, open-path quantum mixing, residue, and conservation readouts.
              </p>
            </div>
            <div className="lens-kpis">
              <div className="lens-kpi">
                <span>Mean Delay</span>
                <strong>{meanDelay.toFixed(2)} sec</strong>
              </div>
              <div className="lens-kpi">
                <span>Mean Residue</span>
                <strong>{meanResidue.toFixed(3)}</strong>
              </div>
            </div>
          </div>

          <div className="pipeline-grid">
            <div className="pipeline-card">
              <span className="pipeline-step">Step A</span>
              <strong>alpha = pi * tanh(W * e)</strong>
              <p>Classical bottleneck converts features into valid rotation angles.</p>
            </div>
            <div className="pipeline-card">
              <span className="pipeline-step">Step B</span>
              <strong>AngleEmbedding + RY + CNOT(0-1-2-3)</strong>
              <p>Open path topology only, no loop from qubit 3 to qubit 0.</p>
            </div>
            <div className="pipeline-card">
              <span className="pipeline-step">Step C</span>
              <strong>y = W' * &lt;Z&gt; + b</strong>
              <p>Expectation values are projected to downstream model dimensions.</p>
            </div>
          </div>

          <div className="temporal-metrics-grid">
            {temporalLens.map((item) => (
              <div key={`metric-${item.id}`} className="temporal-card">
                <h4>Node {item.id}</h4>
                <div className="metric-row"><span>Phase</span><strong>{item.phaseDeg.toFixed(2)} deg</strong></div>
                <div className="metric-row"><span>Delay</span><strong>{item.delaySec.toFixed(2)} sec</strong></div>
                <div className="metric-row"><span>Residue proxy</span><strong>{item.residue.toFixed(3)}</strong></div>
                <div className="metric-row"><span>Residue balance</span><strong>{item.conserved.toFixed(3)}</strong></div>
                <div className="metric-row"><span>Flow in / out</span><strong>{item.flowIn.toFixed(3)} / {item.flowOut.toFixed(3)}</strong></div>
                <div className="metric-row"><span>Q(dt) / Residue vol</span><strong>{item.qFlowDt.toFixed(3)} / {item.residueVolDt.toFixed(3)}</strong></div>
                <div className="metric-row"><span>Predicted q(t+1)</span><strong>{item.predictedNextQ.toFixed(3)}</strong></div>
                <div className="metric-row"><span>Predicted density(t+1)</span><strong>{item.predictedNextDensity.toFixed(2)}</strong></div>
              </div>
            ))}
          </div>

          <div className="calc-stream">
            <h4>Live Equation Trace (updates on every toggle)</h4>
            <div className="calc-grid">
              {temporalLens.map((item) => (
                <div key={`trace-${item.id}`} className="calc-card">
                  <p className="calc-node">Node {item.id}</p>
                  <p>{item.trace.q_local_line}</p>
                  <p>{item.trace.temporal_line}</p>
                  <p>{item.trace.phase_line}</p>
                  <p>{item.trace.residue_line}</p>
                  <p>{item.trace.conservation_line}</p>
                  <p>{item.trace.dt_line}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="circuit-panel">
            <h4>Quantum Circuit (Open Path 0-&gt;1-&gt;2-&gt;3)</h4>
            <svg className="circuit-svg" viewBox="0 0 920 220" preserveAspectRatio="xMinYMin meet">
              <line x1="40" y1="40" x2="890" y2="40" className="wire" />
              <line x1="40" y1="85" x2="890" y2="85" className="wire" />
              <line x1="40" y1="130" x2="890" y2="130" className="wire" />
              <line x1="40" y1="175" x2="890" y2="175" className="wire" />

              <text x="10" y="44" className="wire-label">q0</text>
              <text x="10" y="89" className="wire-label">q1</text>
              <text x="10" y="134" className="wire-label">q2</text>
              <text x="10" y="179" className="wire-label">q3</text>

              <rect x="120" y="24" width="86" height="32" rx="6" className="gate" />
              <rect x="120" y="69" width="86" height="32" rx="6" className="gate" />
              <rect x="120" y="114" width="86" height="32" rx="6" className="gate" />
              <rect x="120" y="159" width="86" height="32" rx="6" className="gate" />
              <text x="136" y="45" className="gate-text">Enc Y</text>
              <text x="136" y="90" className="gate-text">Enc Y</text>
              <text x="136" y="135" className="gate-text">Enc Y</text>
              <text x="136" y="180" className="gate-text">Enc Y</text>

              <rect x="280" y="24" width="66" height="32" rx="6" className="gate" />
              <rect x="280" y="69" width="66" height="32" rx="6" className="gate" />
              <rect x="280" y="114" width="66" height="32" rx="6" className="gate" />
              <rect x="280" y="159" width="66" height="32" rx="6" className="gate" />
              <text x="303" y="45" className="gate-text">RY</text>
              <text x="303" y="90" className="gate-text">RY</text>
              <text x="303" y="135" className="gate-text">RY</text>
              <text x="303" y="180" className="gate-text">RY</text>

              <circle cx="430" cy="40" r="6" className="ctrl" />
              <line x1="430" y1="40" x2="430" y2="85" className="ent" />
              <circle cx="430" cy="85" r="10" className="target" />
              <line x1="423" y1="85" x2="437" y2="85" className="target-plus" />
              <line x1="430" y1="78" x2="430" y2="92" className="target-plus" />

              <circle cx="560" cy="85" r="6" className="ctrl" />
              <line x1="560" y1="85" x2="560" y2="130" className="ent" />
              <circle cx="560" cy="130" r="10" className="target" />
              <line x1="553" y1="130" x2="567" y2="130" className="target-plus" />
              <line x1="560" y1="123" x2="560" y2="137" className="target-plus" />

              <circle cx="690" cy="130" r="6" className="ctrl" />
              <line x1="690" y1="130" x2="690" y2="175" className="ent" />
              <circle cx="690" cy="175" r="10" className="target" />
              <line x1="683" y1="175" x2="697" y2="175" className="target-plus" />
              <line x1="690" y1="168" x2="690" y2="182" className="target-plus" />

              <rect x="790" y="24" width="88" height="166" rx="8" className="measure" />
              <text x="807" y="110" className="measure-text">&lt;Z0..Z3&gt;</text>
            </svg>
            <p className="panel-note">
              Backend generated PennyLane draw:
            </p>
            <pre className="circuit-text">{state?.quantum?.circuit_text || "Loading circuit..."}</pre>
          </div>
        </div>
      </article>
    </section>
  );
}
