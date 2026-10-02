/* MOVT web — cliente HTTP da API (mesmo backend do app mobile) */
import { API_BASE, REQUEST_TIMEOUT_MS } from "./config.js";
import { session } from "./session.js";

export async function request(path, { method = "GET", body, params } = {}) {
  const url = new URL(API_BASE + path);
  if (params) Object.entries(params).forEach(([k, v]) => v != null && url.searchParams.set(k, v));
  const headers = { "Content-Type": "application/json" };
  const sid = session.id;
  if (sid) headers.Authorization = `Bearer ${sid}`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
      credentials: "omit",
      referrerPolicy: "strict-origin-when-cross-origin",
    });
  } catch (e) {
    throw new Error(e.name === "AbortError" ? "O servidor demorou para responder." : "Não foi possível conectar ao servidor.", { cause: e });
  } finally {
    clearTimeout(timer);
  }
  let data = null;
  try { data = await res.json(); } catch {}
  if (!res.ok) {
    const err = new Error(data?.error || data?.message || `Erro ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}
