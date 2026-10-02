/* MOVT web — cliente HTTP do BFF (/api, mesma origem) */
import { API_BASE, REQUEST_TIMEOUT_MS } from "./config.js";
import { session } from "./session.js";

let csrfBootstrap = null;

// Garante o cookie CSRF antes da primeira requisição que altera dados
async function ensureCsrf() {
  if (session.csrf) return session.csrf;
  csrfBootstrap ??= request("/auth/session").finally(() => (csrfBootstrap = null));
  const data = await csrfBootstrap;
  return session.csrf || data?.csrfToken;
}

export async function request(path, { method = "GET", body, params } = {}) {
  const url = new URL(API_BASE + path, location.origin);
  if (params) Object.entries(params).forEach(([k, v]) => v != null && v !== "" && url.searchParams.set(k, v));
  const headers = { Accept: "application/json" };
  if (method !== "GET") {
    headers["Content-Type"] = "application/json";
    headers["X-CSRF-Token"] = await ensureCsrf();
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch (e) {
    throw new Error(e.name === "AbortError" ? "O servidor demorou para responder." : "Não foi possível conectar ao servidor.", { cause: e });
  } finally {
    clearTimeout(timer);
  }
  let data = null;
  try { data = await res.json(); } catch {}
  if (!res.ok) {
    const err = new Error(data?.error || `Erro ${res.status}`);
    err.status = res.status;
    err.field = data?.field;
    throw err;
  }
  return data;
}
