# Quantum Traffic React Full Stack

A new full-stack implementation of your quantum traffic system:

- Frontend: React + Vite with two pages (linear and complex hierarchy)
- Backend: FastAPI using PyTorch + PennyLane for quantum traffic computation
- Traffic colors in increasing order: bright green -> bright yellow -> bright red -> black

## Folder Layout

- `backend/main.py`: API endpoints and quantum model
- `backend/requirements.txt`: backend dependencies
- `frontend/src/pages/SimpleNetworkPage.jsx`: linear A-B-C-D page
- `frontend/src/pages/ComplexNetworkPage.jsx`: complex hierarchy page

## Backend Run

1. From `quantum-traffic-react/backend` install packages:
   - `pip install -r requirements.txt`
2. Start API server:
   - `uvicorn main:app --reload --port 8000`

## Frontend Run

1. From `quantum-traffic-react/frontend` install packages:
   - `npm install`
2. Copy `.env.example` to `.env` if needed and set API base URL.
3. Start React app:
   - `npm run dev`

## API Endpoints

- `POST /api/simple/state`
- `POST /api/complex/state`
- `GET /api/health`
