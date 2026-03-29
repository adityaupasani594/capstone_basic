# Capstone Basic: Spatio-Temporal Quantum Traffic Simulation

This project is a full-stack simulation platform for traffic dynamics using a hybrid classical + quantum modeling approach.

It combines:

- FastAPI backend for traffic-state computation.
- PyTorch for classical tensor math and model components.
- PennyLane for quantum circuit simulation and probability/expectation readout.
- React + Vite frontend for live controls, dynamic visualization, and metric inspection.

Traffic color progression follows increasing congestion:

- Green: low congestion
- Yellow: medium congestion
- Red: high congestion
- Black: severe congestion

---

## 1) Implementation Overview

### Backend

Main implementation lives in `backend/main.py`.

Core backend responsibilities:

- Validate request payloads using Pydantic models.
- Compute per-node local traffic signal from density and speed.
- Apply spatio-temporal graph blending with neighborhood influence.
- Map smoothed congestion to quantum phase.
- Run single-qubit probability readout for displayed amplitudes.
- Compute operational metrics (delay, residue proxy, conservation, dt-volume).
- Return per-node outputs, edge outputs, and summary metrics.

Key constants:

- `MAX_DENSITY = 120`
- `MAX_SPEED = 100`
- `TEMPORAL_BLEND = 0.65`
- `SELF_WEIGHT = 0.55`
- `NEIGHBOR_WEIGHT = 0.45`
- `TIME_STEP_SECONDS = 15`

Quantum modules in backend:

- `qubit_probs(phi)`: single-qubit RY phase-to-probability mapping for UI amplitudes.
- `TrafficQuantumLayer`: 4-qubit open-path architecture (reference implementation) with:
   - input projection from 8 features to 4 angles,
   - angle embedding,
   - variational RY layers,
   - CNOT chain 0->1->2->3,
   - Z expectation readout and classical post-projection.

### Frontend

Frontend implementation lives in `frontend/src`.

Main pages:

- `pages/SimpleNetworkPage.jsx`: interactive A-B-C-D linear network.
- `pages/ComplexNetworkPage.jsx`: 3-ward, 2-minor, 1-major hierarchical aggregation view.
- `pages/MathematicalAspectPage.jsx`: concept and equation cards for the model.

Routing:

- React Router is configured in `src/App.jsx`.

API integration:

- `src/api.js` handles calls to:
   - `POST /api/simple/state`
   - `POST /api/complex/state`
   - base URL from `VITE_API_BASE` (fallback `http://127.0.0.1:8000`)

---

## 2) End-to-End Workflow

### Simple Network Workflow (A-B-C-D)

1. User adjusts density/speed sliders for nodes A, B, C, D.
2. Frontend builds payload with current node values and `prev_smoothed_q`.
3. Frontend sends `POST /api/simple/state` (debounced).
4. Backend computes:
    - local congestion signal,
    - spatio-temporal smoothed congestion,
    - phase and quantum probabilities,
    - delay/residue/conservation/dt metrics,
    - edge congestion from adjacent node means.
5. Backend returns `nodes`, `edges`, `quantum`, and `summary` objects.
6. Frontend updates UI state and stores new `q_st` as next `prev_smoothed_q`.
7. Graph, cards, readouts, and equation trace refresh in real time.

### Complex Hierarchical Workflow

1. User adjusts 21 junction values (3 wards x 7 junctions).
2. Frontend sends `POST /api/complex/state`.
3. Backend normalizes each junction traffic value to $[0,1]$.
4. Ward mean congestion is computed.
5. Minor highway congestion is computed from ward means.
6. Major highway congestion is computed from minor highways.
7. Each hierarchy node is mapped to phase and qubit amplitudes.
8. Frontend renders hierarchical network color + readouts.

Detailed diagrams are available in `FLOWCHARTS.md`.

---

## 3) Mathematical Formulation

Let density be $d$, speed be $s$, and previous smoothed congestion be $q(t-1)$.

### 3.1 Normalization

$$
\hat{d} = \mathrm{clip}\left(\frac{d}{D_{\max}}, 0, 1\right),
\qquad
\hat{s} = \mathrm{clip}\left(\frac{s}{S_{\max}}, 0, 1\right)
$$

where $D_{\max}=120$, $S_{\max}=100$.

### 3.2 Local Traffic Signal

$$
q_{\text{local}} = \mathrm{clip}\left(0.7\hat{d} + 0.3(1-\hat{s}), 0, 1\right)
$$

### 3.3 Graph Mix (Neighborhood Coupling)

For node $i$ with neighbors $\mathcal{N}(i)$:

$$
\bar{q}_{\mathcal{N}(i)} = \frac{1}{|\mathcal{N}(i)|} \sum_{j\in\mathcal{N}(i)} q_{\text{local},j}
$$

$$
q_{\text{graph},i} = w_s q_{\text{local},i} + w_n \bar{q}_{\mathcal{N}(i)}
$$

with $w_s=0.55$, $w_n=0.45$.

### 3.4 Temporal Smoothing

$$
q_i(t) = \beta q_i(t-1) + (1-\beta) q_{\text{graph},i}
$$

with $\beta=0.65$.

### 3.5 Quantum Phase Mapping

$$
\phi_i = \pi q_i(t)
$$

Single-qubit readout applies $R_Y(\phi_i)$ to $|0\rangle$ and measures probabilities:

$$
p_0 = \cos^2\left(\frac{\phi_i}{2}\right),
\qquad
p_1 = \sin^2\left(\frac{\phi_i}{2}\right)
$$

Displayed amplitudes are:

$$
a_0 = \sqrt{p_0},
\qquad
a_1 = \sqrt{p_1}
$$

### 3.6 Delay Metric

Phase is converted to degrees with cap:

$$
\phi_i^{\circ} = \min\left(\frac{180}{\pi}\phi_i, 90\right)
$$

Delay estimate:

$$
   au_i = \phi_i^{\circ} \left(0.30 + 0.70 q_i(t)\right)
$$

### 3.7 Residue Proxy

Temporal change:

$$
\Delta q_i = |q_i(t)-q_i(t-1)|
$$

Saturation core:

$$
\sigma_i = \hat{d}_i^{1.15}(1-\hat{s}_i)
$$

Delay pressure:

$$
\rho_i = \min\left(\frac{\tau_i}{60},1\right)
$$

Residue proxy:

$$
r_i = \mathrm{clip}\left(0.45\Delta q_i + 0.35\sigma_i + 0.20\rho_i, 0, 1\right)
$$

### 3.8 Conservation and Time-Step Volume

$$
f_{\text{in},i} = q_i(t-1) + q_{\text{local},i},
\qquad
f_{\text{out},i} = q_i(t)
$$

$$
b_i = \mathrm{clip}\left(f_{\text{in},i} - f_{\text{out},i}, 0, 1\right)
$$

With time step $\Delta t = 15\,\text{s}$:

$$
Q_i(\Delta t) = q_i(t)\Delta t,
\qquad
V_{r,i}(\Delta t) = r_i Q_i(\Delta t)
$$

### 3.9 4-Qubit Open-Path Reference Layer

Given feature embedding $e(t)\in\mathbb{R}^8$:

$$
u(t)=W_{\text{pre}}e(t)+b_{\text{pre}},
\qquad
\alpha(t)=\pi\tanh(u(t))\in\mathbb{R}^4
$$

Embedding and variational block:

$$
|\psi_{\text{emb}}\rangle = \bigotimes_{k=0}^{3} R_Y(\alpha_k)|0000\rangle
$$

For each layer $\ell$:

$$
\left(\prod_{k=0}^{3} R_Y(\theta_{\ell,k})\right)
\cdot
\mathrm{CNOT}(0,1)\,\mathrm{CNOT}(1,2)\,\mathrm{CNOT}(2,3)
$$

No ring closure gate $\mathrm{CNOT}(3,0)$ is used.

Readout:

$$
z_k = \langle Z_k \rangle,
\qquad
y = W_{\text{post}}z + b_{\text{post}}
$$

---

## 4) API Contracts

### 4.1 Health

- Method: `GET`
- Path: `/api/health`
- Response:

```json
{ "status": "ok" }
```

### 4.2 Simple State

- Method: `POST`
- Path: `/api/simple/state`

Request body:

```json
{
   "nodes": {
      "A": { "density": 38, "speed": 62 },
      "B": { "density": 55, "speed": 54 },
      "C": { "density": 72, "speed": 44 },
      "D": { "density": 86, "speed": 33 }
   },
   "prev_smoothed_q": [0.0, 0.0, 0.0, 0.0]
}
```

Response fields include:

- `nodes` with per-node metrics (`q_local`, `q_st`, `phi`, `amp0`, `amp1`, `delay_seconds`, residue metrics, trace lines, etc.)
- `edges` with A-B, B-C, C-D edge q and colors
- `quantum` metadata and circuit text
- `summary` with average/peak q, mean phi, mean delay, mean residue

### 4.3 Complex State

- Method: `POST`
- Path: `/api/complex/state`

Request body:

```json
{
   "wards": [
      [40, 46, 52, 58, 64, 50, 54],
      [44, 50, 56, 60, 66, 62, 48],
      [36, 44, 54, 62, 70, 66, 58]
   ]
}
```

Response includes:

- `junction_q` normalized per-junction congestion in each ward
- `nodes` for `ward_1`, `ward_2`, `ward_3`, `minor_1`, `minor_2`, `major`

---

## 5) Execution Method

### 5.1 Prerequisites

- Python 3.10+ recommended
- Node.js 18+ recommended
- npm

### 5.2 Backend Setup and Run

From project root:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Backend will run on:

- `http://127.0.0.1:8000`

Health check:

- `http://127.0.0.1:8000/api/health`

### 5.3 Frontend Setup and Run

Open a second terminal from project root:

```powershell
cd frontend
npm install
npm run dev
```

Frontend default dev URL:

- `http://127.0.0.1:5173` (or local Vite URL shown in terminal)

### 5.4 Optional Environment Variable

In frontend, API base can be overridden with `.env`:

```env
VITE_API_BASE=http://127.0.0.1:8000
```

### 5.5 Production Build (Frontend)

```powershell
cd frontend
npm run build
npm run preview
```

---

## 6) Project Structure

```text
capstone_basic/
   backend/
      main.py
      requirements.txt
   frontend/
      package.json
      vite.config.js
      src/
         api.js
         App.jsx
         main.jsx
         styles.css
         pages/
            SimpleNetworkPage.jsx
            ComplexNetworkPage.jsx
            MathematicalAspectPage.jsx
   FLOWCHARTS.md
   README.md
```

---

## 7) Developer Notes

- Simple page request is debounced by ~110 ms to reduce rapid API bursts.
- `prev_smoothed_q` is intentionally fed back by frontend to preserve temporal continuity.
- Circuit text shown in UI is generated via PennyLane draw utility in backend.
- Complex hierarchy expects exactly 3 wards x 7 junction values.

---

## 8) Quick Start (Minimal)

Terminal 1:

```powershell
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Terminal 2:

```powershell
cd frontend
npm install
npm run dev
```

Then open the frontend URL and start interacting with the Implementation, Hierarchical Demo, and Mathematical Aspect pages.
