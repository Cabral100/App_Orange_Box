const configuredBase = String(import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

export const API_BASE = configuredBase;

function apiUrl(path) {
  return `${API_BASE}${path}`;
}

async function parseError(response) {
  try {
    const payload = await response.json();
    return payload?.detail?.message || payload?.detail || `Erro ${response.status}`;
  } catch {
    return `Erro ${response.status}`;
  }
}

export async function inferImage(file, { confidence = 0.01, annotated = false, location, signal } = {}) {
  const body = new FormData();
  body.append("file", file, file.name || "camera.jpg");
  if (location?.latitude != null && location?.longitude != null) {
    body.append("latitude", String(location.latitude));
    body.append("longitude", String(location.longitude));
    if (location.accuracy != null) body.append("accuracy_m", String(location.accuracy));
  }
  const query = new URLSearchParams({
    conf: String(confidence),
    annotated: String(annotated),
  });
  const response = await fetch(apiUrl(`/api/infer?${query}`), {
    method: "POST",
    body,
    signal,
  });
  if (!response.ok) throw new Error(await parseError(response));
  return response.json();
}

export async function getHealth(signal) {
  const response = await fetch(apiUrl("/api/health"), { signal });
  if (!response.ok) throw new Error(await parseError(response));
  return response.json();
}
