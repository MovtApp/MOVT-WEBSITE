/* BFF — chamadas ao MOVT-BACKEND
 *
 * Os caminhos vêm SEMPRE da tabela de rotas do BFF (nunca da URL do cliente):
 * não existe proxy aberto. O token de sessão só trafega servidor → servidor.
 */
import { signProxyHeaders } from "./crypto.js";
import { HttpError } from "./http.js";
import { log } from "./log.js";

const TIMEOUT_MS = 15000;

export async function callUpstream(cfg, { method = "GET", path, query, body, sid, ip, userAgent }) {
  const url = new URL(cfg.upstream + path);
  if (query) for (const [k, v] of Object.entries(query)) if (v != null && v !== "") url.searchParams.set(k, v);

  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (sid) headers.Authorization = `Bearer ${sid}`;
  if (userAgent) headers["User-Agent"] = String(userAgent).slice(0, 400);
  if (cfg.proxySecret && ip) {
    const { ts, sig } = signProxyHeaders(cfg.proxySecret, { ip, method, pathname: url.pathname });
    headers["X-MOVT-Client-IP"] = ip;
    headers["X-MOVT-Proxy-Ts"] = ts;
    headers["X-MOVT-Proxy-Sig"] = sig;
  }

  let res;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      redirect: "error",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    log("error", "upstream.unreachable", { path, error: err.name });
    throw new HttpError(502, "Serviço temporariamente indisponível. Tente novamente.");
  }
  let data = null;
  try { data = await res.json(); } catch {}
  if (res.status >= 500) {
    log("error", "upstream.error", { path, status: res.status });
    throw new HttpError(502, "Serviço temporariamente indisponível. Tente novamente.");
  }
  return { status: res.status, ok: res.ok, data: data || {} };
}

// Mensagem de erro do backend: só texto curto, nunca `details`/stack
export const upstreamMessage = (data, fallback) =>
  typeof data?.error === "string" && data.error.length <= 200 ? data.error : fallback;
