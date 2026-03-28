const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

export async function fetchSimpleState(payload) {
  const response = await fetch(`${API_BASE}/api/simple/state`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Simple API failed with status ${response.status}`);
  }

  return response.json();
}

export async function fetchComplexState(payload) {
  const response = await fetch(`${API_BASE}/api/complex/state`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Complex API failed with status ${response.status}`);
  }

  return response.json();
}
