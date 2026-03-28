import { useEffect, useMemo, useState } from "react";
import { fetchComplexState } from "../api";

const WARD_LABELS = ["ward_1", "ward_2", "ward_3"];
const POS = {
  major: { x: 500, y: 90 },
  minor_1: { x: 310, y: 230 },
  minor_2: { x: 690, y: 230 },
  ward_1: { x: 180, y: 430 },
  ward_2: { x: 500, y: 430 },
  ward_3: { x: 820, y: 430 },
};

function wardLayout(wardName) {
  const c = POS[wardName];
  if (wardName === "ward_1") {
    return {
      points: [
        [c.x - 50, c.y - 40],
        [c.x + 10, c.y - 62],
        [c.x + 58, c.y - 20],
        [c.x + 50, c.y + 42],
        [c.x - 18, c.y + 80],
        [c.x + 76, c.y + 96],
        [c.x - 80, c.y + 36],
      ],
      edges: [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 4],
        [3, 5],
        [0, 6],
        [6, 4],
      ],
    };
  }

  if (wardName === "ward_2") {
    return {
      points: [
        [c.x, c.y],
        [c.x - 78, c.y - 26],
        [c.x + 84, c.y - 30],
        [c.x, c.y - 78],
        [c.x - 80, c.y + 30],
        [c.x + 58, c.y + 100],
        [c.x - 18, c.y + 112],
      ],
      edges: [
        [0, 1],
        [0, 2],
        [0, 3],
        [0, 4],
        [0, 5],
        [0, 6],
      ],
    };
  }

  return {
    points: [
      [c.x - 55, c.y - 22],
      [c.x, c.y - 62],
      [c.x + 55, c.y - 22],
      [c.x - 86, c.y + 38],
      [c.x - 20, c.y + 38],
      [c.x + 24, c.y + 42],
      [c.x + 86, c.y + 42],
    ],
    edges: [
      [0, 1],
      [1, 2],
      [0, 3],
      [0, 4],
      [2, 5],
      [2, 6],
    ],
  };
}

export default function ComplexNetworkPage() {
  const [wards, setWards] = useState([
    [40, 46, 52, 58, 64, 50, 54],
    [44, 50, 56, 60, 66, 62, 48],
    [36, 44, 54, 62, 70, 66, 58],
  ]);
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadState() {
      setLoading(true);
      setError("");
      try {
        const data = await fetchComplexState({ wards });
        if (!cancelled) {
          setState(data);
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
  }, [wards]);

  const topNodes = useMemo(
    () => ["major", "minor_1", "minor_2", "ward_1", "ward_2", "ward_3"],
    []
  );

  const hierarchyEdges = useMemo(
    () => [
      ["minor_1", "major"],
      ["minor_2", "major"],
      ["ward_1", "minor_1"],
      ["ward_2", "minor_1"],
      ["ward_2", "minor_2"],
      ["ward_3", "minor_2"],
    ],
    []
  );

  return (
    <section className="page-grid complex-grid">
      <article className="panel panel-scroll">
        <h2>Ward Junction Controls</h2>
        <p className="panel-note">
          Adjust all 21 junction traffic values. Ward and highway qubits aggregate these values dynamically.
        </p>

        {wards.map((junctions, wardIdx) => (
          <div key={`ward-controls-${wardIdx}`} className="control-card">
            <h3>Ward {wardIdx + 1} (7 junctions)</h3>
            {junctions.map((value, junctionIdx) => (
              <label key={`w${wardIdx + 1}j${junctionIdx + 1}`}>
                Junction {junctionIdx + 1} ({value})
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={value}
                  onChange={(event) => {
                    const next = wards.map((wardValues) => [...wardValues]);
                    next[wardIdx][junctionIdx] = Number(event.target.value);
                    setWards(next);
                  }}
                />
              </label>
            ))}
          </div>
        ))}
      </article>

      <article className="panel">
        <h2>Complex Hierarchical Network</h2>
        <p className="panel-note">Wards feed minor highways, then major highway. Colors move green to yellow to red to black.</p>

        <svg className="network-svg network-svg-tall" viewBox="0 0 1000 640">
          <defs>
            <filter id="softPulse" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.6" result="blurred" />
              <feMerge>
                <feMergeNode in="blurred" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <marker id="edgeArrow" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
              <path d="M0,0 L10,4 L0,8 z" fill="#263238" />
            </marker>
          </defs>

          {hierarchyEdges.map(([src, dst]) => {
            const color = state?.nodes?.[src]?.color || "rgb(0,255,0)";
            return (
              <line
                key={`${src}-${dst}`}
                x1={POS[src].x}
                y1={POS[src].y - 28}
                x2={POS[dst].x}
                y2={POS[dst].y + 28}
                stroke={color}
                strokeWidth={5}
                markerEnd="url(#edgeArrow)"
                filter="url(#softPulse)"
              />
            );
          })}

          {WARD_LABELS.map((wardName) => {
            const node = state?.nodes?.[wardName];
            const wardColor = node?.color || "rgb(0,255,0)";
            const layout = wardLayout(wardName);
            const jq = state?.junction_q?.[wardName] || [0, 0, 0, 0, 0, 0, 0];

            return (
              <g key={wardName}>
                {layout.edges.map(([a, b], idx) => (
                  <line
                    key={`${wardName}-e-${idx}`}
                    x1={layout.points[a][0]}
                    y1={layout.points[a][1]}
                    x2={layout.points[b][0]}
                    y2={layout.points[b][1]}
                    stroke="rgba(80,80,80,0.9)"
                    strokeWidth={1.6}
                  />
                ))}

                {layout.points.map((point, idx) => (
                  <circle
                    key={`${wardName}-n-${idx}`}
                    cx={point[0]}
                    cy={point[1]}
                    r={12}
                    fill={jq[idx] >= 0.75 ? "rgb(0,0,0)" : jq[idx] >= 0.5 ? "rgb(255,0,0)" : jq[idx] >= 0.25 ? "rgb(255,255,0)" : "rgb(0,255,0)"}
                    stroke="#101418"
                    strokeWidth={1.4}
                  />
                ))}
              </g>
            );
          })}

          {topNodes.map((name) => {
            const node = state?.nodes?.[name];
            const color = node?.color || "rgb(0,255,0)";
            const label = name.replace("_", " ").replace("ward", "Ward").replace("minor", "Minor").replace("major", "Major");
            const showLabel = !name.startsWith("ward_");
            const showHubCircle = !name.startsWith("ward_");
            return (
              <g key={`top-${name}`}>
                {showHubCircle && (
                  <circle cx={POS[name].x} cy={POS[name].y} r={56} fill={color} stroke="#0f172a" strokeWidth={2.4} />
                )}
                {showLabel && (
                  <text x={POS[name].x} y={POS[name].y + 5} textAnchor="middle" className="top-node-label">
                    {label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {loading && <p className="status-text">Computing complex quantum hierarchy...</p>}
        {error && <p className="status-text error">{error}</p>}

        <div className="readout-list">
          {state &&
            ["major", "minor_1", "minor_2", "ward_1", "ward_2", "ward_3"].map((nodeName) => {
              const node = state.nodes[nodeName];
              return (
                <div key={nodeName} className="readout-item" style={{ background: node.color }}>
                  <span>
                    {nodeName.replace("_", " ")}: q={node.q.toFixed(3)}, phi={node.phi.toFixed(3)} rad
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
