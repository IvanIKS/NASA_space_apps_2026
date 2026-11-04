// nginx (prod) and the Vite dev proxy both forward /api/* to the FastAPI backend.
const BASE = "/api";

export async function postJson<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

// FastAPI returns { detail: string } for 400 and { detail: [{ msg }] } for 422.
async function readError(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const { detail } = JSON.parse(text);
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) return detail.map((d) => d.msg).join("; ");
  } catch {
    // not JSON — fall through to raw text
  }
  return text || `HTTP ${res.status}`;
}
