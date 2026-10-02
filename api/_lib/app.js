/* BFF — roteador e cadeia de segurança de cada requisição
 *
 * Ordem: rota na allowlist → rate limit global por IP → (se altera dados)
 * origem + CSRF → handler. Erros inesperados viram 500 genérico (detalhe só no log).
 */
import { assertCsrf, assertSameOrigin, clientIp } from "./guards.js";
import { ConfigError, loadConfig } from "./env.js";
import { HttpError, send } from "./http.js";
import { log } from "./log.js";
import { consume, LIMITS } from "./rate-limit.js";
import { ROUTES } from "./routes.js";

const knownPaths = new Set(Object.keys(ROUTES).map((k) => k.split(" ")[1]));

export async function handle(req, res) {
  const ip = clientIp(req);
  let url;
  try {
    url = new URL(req.url || "/", "http://bff.local");
  } catch {
    return send(res, 400, { error: "URL inválida." });
  }
  const method = String(req.method || "GET").toUpperCase();
  const route = ROUTES[`${method} ${url.pathname}`];

  try {
    if (!route) {
      if (knownPaths.has(url.pathname)) throw new HttpError(405, "Método não permitido.");
      throw new HttpError(404, "Não encontrado.");
    }
    const cfg = loadConfig();

    const retry = await consume(`global:${ip}`, LIMITS.global);
    if (retry) throw new HttpError(429, "Muitas requisições. Aguarde um instante.", { headers: { "Retry-After": String(retry) } });

    if (route.mutating) {
      assertSameOrigin(req, cfg);
      assertCsrf(req);
    }
    await route.handler({ req, res, url, ip, cfg });
  } catch (err) {
    if (res.headersSent) return;
    if (err instanceof HttpError) {
      const { headers = {}, ...extra } = err.extra || {};
      if (err.status === 403) log("warn", "security.rejected", { ip, path: url.pathname, reason: err.message });
      return send(res, err.status, { error: err.message, ...extra }, headers);
    }
    if (err instanceof ConfigError) {
      log("error", "config.invalid", { error: err.message });
      return send(res, 503, { error: "Serviço temporariamente indisponível." });
    }
    log("error", "bff.unhandled", { path: url.pathname, error: err?.message });
    return send(res, 500, { error: "Erro interno. Tente novamente." });
  }
}
