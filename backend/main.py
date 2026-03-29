import math
from typing import Dict, List

import pennylane as qml
import torch
import torch.nn as nn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

NODE_IDS = ["A", "B", "C", "D"]
ADJACENCY = {
    "A": ["B"],
    "B": ["A", "C"],
    "C": ["B", "D"],
    "D": ["C"],
}
EDGE_LIST = [("A", "B"), ("B", "C"), ("C", "D")]

MAX_DENSITY = 120.0
MAX_SPEED = 100.0
TEMPORAL_BLEND = 0.65
SELF_WEIGHT = 0.55
NEIGHBOR_WEIGHT = 0.45
MAX_JUNCTION_TRAFFIC = 100.0
TIME_STEP_SECONDS = 15.0

app = FastAPI(title="Quantum Traffic API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

qdev = qml.device("default.qubit", wires=1)


class TrafficQuantumLayer(nn.Module):
    """Hybrid classical-quantum layer with a strict 4-qubit open-path circuit."""

    N_QUBITS = 4
    INPUT_FEATURES = 8

    def __init__(self, output_features: int, n_layers: int = 2) -> None:
        super().__init__()
        self.output_features = output_features
        self.n_layers = n_layers

        # Step A: Classical bottleneck from 8 features to 4 qubit angles.
        self.pre_projection = nn.Linear(self.INPUT_FEATURES, self.N_QUBITS)

        # Trainable variational parameters for Step B.
        self.theta = nn.Parameter(0.01 * torch.randn(n_layers, self.N_QUBITS))

        # Step C: Project 4 expectation values to any downstream dimension.
        self.post_projection = nn.Linear(self.N_QUBITS, output_features)

        self.qdev = qml.device("default.qubit", wires=self.N_QUBITS)
        self.qnode = qml.QNode(self._circuit, self.qdev, interface="torch")

    def _circuit(self, alpha: torch.Tensor, weights: torch.Tensor) -> List[torch.Tensor]:
        # Step B.1 and B.2: |0> state and angle embedding with Y rotations.
        qml.AngleEmbedding(alpha, wires=range(self.N_QUBITS), rotation="Y")

        # Step B.3: Variational RY + strict open-path entanglement 0->1->2->3.
        for layer in range(self.n_layers):
            for wire in range(self.N_QUBITS):
                qml.RY(weights[layer, wire], wires=wire)
            for wire in range(self.N_QUBITS - 1):
                qml.CNOT(wires=[wire, wire + 1])

        return [qml.expval(qml.PauliZ(wire)) for wire in range(self.N_QUBITS)]

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # Accept [8] or [batch, 8].
        if x.dim() == 1:
            x = x.unsqueeze(0)

        # Step A: alpha = pi * tanh(W e).
        alpha = torch.pi * torch.tanh(self.pre_projection(x))

        # Evaluate each sample through the same QNode and normalize to tensors.
        target_dtype = self.post_projection.weight.dtype
        target_device = self.post_projection.weight.device

        z_vals: List[torch.Tensor] = []
        for alpha_i in alpha:
            q_out = self.qnode(alpha_i, self.theta)
            if isinstance(q_out, (list, tuple)):
                q_out = torch.stack(list(q_out), dim=0)
            q_out = q_out.to(dtype=target_dtype, device=target_device)
            z_vals.append(q_out)

        z_stack = torch.stack(z_vals, dim=0).to(dtype=target_dtype, device=target_device)

        # Step C: W' <Z> + b.
        return self.post_projection(z_stack)




torch.manual_seed(42)
NODE_NEXT_Q_PREDICTOR = TrafficQuantumLayer(output_features=4, n_layers=2)
NODE_NEXT_Q_PREDICTOR.eval()


@qml.qnode(qdev, interface="torch")
def qubit_probs(phi: torch.Tensor) -> torch.Tensor:
    qml.RY(phi, wires=0)
    return qml.probs(wires=0)


class SimpleNode(BaseModel):
    density: float = Field(ge=0.0, le=MAX_DENSITY)
    speed: float = Field(ge=0.0, le=MAX_SPEED)


class SimpleNetworkRequest(BaseModel):
    nodes: Dict[str, SimpleNode]
    prev_smoothed_q: List[float] = Field(default=[0.0, 0.0, 0.0, 0.0], min_length=4, max_length=4)


class ComplexNetworkRequest(BaseModel):
    wards: List[List[float]] = Field(min_length=3, max_length=3)


def clamp01(value: float) -> float:
    return max(0.0, min(1.0, value))


def q_to_color(q_val: float) -> str:
    q_clamped = clamp01(q_val)
    if q_clamped < 0.25:
        return "rgb(0,255,0)"
    if q_clamped < 0.50:
        return "rgb(255,255,0)"
    if q_clamped < 0.75:
        return "rgb(255,0,0)"
    return "rgb(0,0,0)"


def traffic_signal(density: torch.Tensor, speed: torch.Tensor) -> torch.Tensor:
    d_norm = torch.clamp(density / MAX_DENSITY, min=0.0, max=1.0)
    s_norm = torch.clamp(speed / MAX_SPEED, min=0.0, max=1.0)
    return torch.clamp(0.7 * d_norm + 0.3 * (1.0 - s_norm), min=0.0, max=1.0)


def run_st_qgcn(local_q: torch.Tensor, prev_q: torch.Tensor) -> torch.Tensor:
    values = []
    for node in NODE_IDS:
        idx = NODE_IDS.index(node)
        nbr_idx = [NODE_IDS.index(n) for n in ADJACENCY[node]]
        nbr_avg = torch.mean(local_q[nbr_idx])
        graph_mix = SELF_WEIGHT * local_q[idx] + NEIGHBOR_WEIGHT * nbr_avg
        st_q = TEMPORAL_BLEND * prev_q[idx] + (1.0 - TEMPORAL_BLEND) * graph_mix
        values.append(torch.clamp(st_q, min=0.0, max=1.0))
    return torch.stack(values)


def build_open_path_circuit_text(n_layers: int = 2) -> str:
    qdev_draw = qml.device("default.qubit", wires=4)

    @qml.qnode(qdev_draw)
    def open_path(alpha: torch.Tensor, theta: torch.Tensor) -> List[torch.Tensor]:
        qml.AngleEmbedding(alpha, wires=range(4), rotation="Y")
        for layer in range(n_layers):
            for wire in range(4):
                qml.RY(theta[layer, wire], wires=wire)
            for wire in range(3):
                qml.CNOT(wires=[wire, wire + 1])
        return [qml.expval(qml.PauliZ(wire)) for wire in range(4)]

    alpha_demo = torch.tensor([0.12, 0.38, 0.64, 0.9], dtype=torch.float32)
    theta_demo = torch.zeros((n_layers, 4), dtype=torch.float32)
    return qml.draw(open_path, decimals=2)(alpha_demo, theta_demo)


OPEN_PATH_CIRCUIT_TEXT = build_open_path_circuit_text()


@app.get("/api/health")
def health() -> Dict[str, str]:
    return {"status": "ok"}


@app.post("/api/simple/state")
def simple_state(payload: SimpleNetworkRequest) -> Dict[str, object]:
    ordered_nodes = [payload.nodes[nid] for nid in NODE_IDS]
    density = torch.tensor([n.density for n in ordered_nodes], dtype=torch.float32)
    speed = torch.tensor([n.speed for n in ordered_nodes], dtype=torch.float32)
    prev_q = torch.tensor(payload.prev_smoothed_q, dtype=torch.float32)

    local_q = traffic_signal(density, speed)
    smoothed_q = run_st_qgcn(local_q, prev_q)
    phi = math.pi * smoothed_q

    node_output: Dict[str, Dict[str, float]] = {}
    predictor_features: List[List[float]] = []
    for i, nid in enumerate(NODE_IDS):
        probs = qubit_probs(phi[i])
        p0 = float(probs[0])
        p1 = float(probs[1])

        d_norm = float(torch.clamp(density[i] / MAX_DENSITY, min=0.0, max=1.0))
        s_norm = float(torch.clamp(speed[i] / MAX_SPEED, min=0.0, max=1.0))
        q_local = float(local_q[i])
        q_t = float(smoothed_q[i])
        q_prev = float(prev_q[i])
        temporal_delta = abs(q_t - q_prev)

        phase_deg = float(min((180.0 / math.pi) * float(phi[i]), 90.0))
        delay_seconds = phase_deg * (0.30 + 0.70 * q_t)

        # Practical residue proxy: combines imbalance, saturation, and delay pressure.
        imbalance_term = 0.45 * temporal_delta
        saturation_term = 0.35 * (d_norm**1.15) * (1.0 - s_norm)
        delay_term = 0.20 * min(delay_seconds / 60.0, 1.0)
        residue_proxy = max(0.0, min(1.0, imbalance_term + saturation_term + delay_term))

        flow_in = q_prev + q_local
        flow_out = q_t
        residue_balance = max(0.0, min(1.0, flow_in - flow_out))
        q_flow_dt = q_t * TIME_STEP_SECONDS
        residue_volume_dt = residue_proxy * q_flow_dt

        # Exactly 8 features per node for the hybrid quantum predictor input.
        predictor_features.append(
            [
                d_norm,
                1.0 - s_norm,
                q_local,
                q_t,
                q_prev,
                temporal_delta,
                residue_proxy,
                phase_deg / 90.0,
            ]
        )

        node_output[nid] = {
            "density": float(density[i]),
            "speed": float(speed[i]),
            "q_local": float(local_q[i]),
            "q_st": float(smoothed_q[i]),
            "phi": float(phi[i]),
            "amp0": float(torch.sqrt(torch.tensor(p0))),
            "amp1": float(torch.sqrt(torch.tensor(p1))),
            "color": q_to_color(float(smoothed_q[i])),
            "phase_deg": phase_deg,
            "delay_seconds": delay_seconds,
            "residue_proxy": residue_proxy,
            "residue_balance": residue_balance,
            "flow_in": flow_in,
            "flow_out": flow_out,
            "q_flow_dt": q_flow_dt,
            "residue_volume_dt": residue_volume_dt,
            "trace": {
                "q_local_line": f"q_local = 0.7*{d_norm:.3f} + 0.3*(1-{s_norm:.3f}) = {q_local:.3f}",
                "temporal_line": f"q(t)={q_t:.3f}, q(t-1)={q_prev:.3f}, |delta|={temporal_delta:.3f}",
                "phase_line": f"phi={float(phi[i]):.3f} rad => {phase_deg:.2f} deg, delay={delay_seconds:.2f} sec",
                "residue_line": f"residue = 0.45*{temporal_delta:.3f} + 0.35*sat + 0.20*delay = {residue_proxy:.3f}",
                "conservation_line": f"flow_in={flow_in:.3f}, flow_out={flow_out:.3f}, residue_balance={residue_balance:.3f}",
                "dt_line": f"Q_flow(dt={TIME_STEP_SECONDS:.0f}s)={q_flow_dt:.3f}, residue_volume={residue_volume_dt:.3f}",
            },
        }

    # Predict q(t+1) for all four nodes using the strict 4-qubit hybrid layer.
    features_tensor = torch.tensor(predictor_features, dtype=torch.float32)
    with torch.no_grad():
        raw_pred = NODE_NEXT_Q_PREDICTOR(features_tensor).squeeze(0)
        raw_pred = raw_pred if raw_pred.dim() == 1 else raw_pred.mean(dim=0)
        q_pred_base = torch.sigmoid(raw_pred)

    # Blend learned quantum estimate with current q(t) for short-horizon stability.
    for i, nid in enumerate(NODE_IDS):
        q_t = float(node_output[nid]["q_st"])
        q_next = float(torch.clamp(0.7 * q_pred_base[i] + 0.3 * q_t, min=0.0, max=1.0))
        node_output[nid]["predicted_next_q"] = q_next
        node_output[nid]["predicted_next_density"] = q_next * MAX_DENSITY

    edges = []
    for src, dst in EDGE_LIST:
        edge_q = (node_output[src]["q_st"] + node_output[dst]["q_st"]) / 2.0
        edges.append({"source": src, "target": dst, "q": edge_q, "color": q_to_color(edge_q)})

    values = [node_output[n]["q_st"] for n in NODE_IDS]
    return {
        "nodes": node_output,
        "edges": edges,
        "quantum": {
            "n_qubits": 4,
            "input_features": 8,
            "time_step_seconds": TIME_STEP_SECONDS,
            "circuit_text": OPEN_PATH_CIRCUIT_TEXT,
        },
        "summary": {
            "average_q": sum(values) / len(values),
            "peak_q": max(values),
            "mean_phi": sum(node_output[n]["phi"] for n in NODE_IDS) / len(NODE_IDS),
            "mean_delay_seconds": sum(node_output[n]["delay_seconds"] for n in NODE_IDS) / len(NODE_IDS),
            "mean_residue": sum(node_output[n]["residue_proxy"] for n in NODE_IDS) / len(NODE_IDS),
        },
    }


@app.post("/api/complex/state")
def complex_state(payload: ComplexNetworkRequest) -> Dict[str, object]:
    if any(len(ward) != 7 for ward in payload.wards):
        return {"error": "Each ward must contain exactly 7 junction traffic values."}

    ward_q: List[float] = []
    junction_q: List[List[float]] = []
    for ward in payload.wards:
        ward_tensor = torch.tensor(ward, dtype=torch.float32)
        q_vals = torch.clamp(ward_tensor / MAX_JUNCTION_TRAFFIC, min=0.0, max=1.0)
        junction_q.append([float(v) for v in q_vals])
        ward_q.append(float(torch.mean(q_vals)))

    minor_1_q = (ward_q[0] + ward_q[1]) / 2.0
    minor_2_q = (ward_q[1] + ward_q[2]) / 2.0
    major_q = (minor_1_q + minor_2_q) / 2.0

    node_q = {
        "ward_1": ward_q[0],
        "ward_2": ward_q[1],
        "ward_3": ward_q[2],
        "minor_1": minor_1_q,
        "minor_2": minor_2_q,
        "major": major_q,
    }

    node_output: Dict[str, Dict[str, float]] = {}
    for name, q_val in node_q.items():
        phi = math.pi * q_val
        probs = qubit_probs(torch.tensor(phi, dtype=torch.float32))
        p0 = float(probs[0])
        p1 = float(probs[1])
        node_output[name] = {
            "q": q_val,
            "phi": phi,
            "amp0": float(torch.sqrt(torch.tensor(p0))),
            "amp1": float(torch.sqrt(torch.tensor(p1))),
            "color": q_to_color(q_val),
        }

    return {
        "junction_q": {
            "ward_1": junction_q[0],
            "ward_2": junction_q[1],
            "ward_3": junction_q[2],
        },
        "nodes": node_output,
    }
