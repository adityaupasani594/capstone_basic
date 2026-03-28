import math
from typing import Dict, List

import pennylane as qml
import torch
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

app = FastAPI(title="Quantum Traffic API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

qdev = qml.device("default.qubit", wires=1)


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
    for i, nid in enumerate(NODE_IDS):
        probs = qubit_probs(phi[i])
        p0 = float(probs[0])
        p1 = float(probs[1])
        node_output[nid] = {
            "density": float(density[i]),
            "speed": float(speed[i]),
            "q_local": float(local_q[i]),
            "q_st": float(smoothed_q[i]),
            "phi": float(phi[i]),
            "amp0": float(torch.sqrt(torch.tensor(p0))),
            "amp1": float(torch.sqrt(torch.tensor(p1))),
            "color": q_to_color(float(smoothed_q[i])),
        }

    edges = []
    for src, dst in EDGE_LIST:
        edge_q = (node_output[src]["q_st"] + node_output[dst]["q_st"]) / 2.0
        edges.append({"source": src, "target": dst, "q": edge_q, "color": q_to_color(edge_q)})

    values = [node_output[n]["q_st"] for n in NODE_IDS]
    return {
        "nodes": node_output,
        "edges": edges,
        "summary": {
            "average_q": sum(values) / len(values),
            "peak_q": max(values),
            "mean_phi": sum(node_output[n]["phi"] for n in NODE_IDS) / len(NODE_IDS),
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
