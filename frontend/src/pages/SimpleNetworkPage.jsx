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
                q={state.nodes[id].q_st.toFixed(3)} | phi={state.nodes[id].phi.toFixed(3)}
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
                    Node {id}: q={node.q_st.toFixed(3)}, phi={node.phi.toFixed(3)} rad
                  </span>
                  <span>
                    |0&gt;~{node.amp0.toFixed(3)} | |1&gt;~{node.amp1.toFixed(3)}
                  </span>
                </div>
              );
            })}
        </div>
      </article>
    </section>
  );
}
