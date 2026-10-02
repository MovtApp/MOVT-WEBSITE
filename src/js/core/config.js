/* MOVT web — configuração
 *
 * O navegador só conversa com o BFF do próprio site (/api, mesma origem).
 * A URL do backend real fica no servidor (UPSTREAM_API_URL) e não aparece aqui.
 */
export const API_BASE = "/api";
export const REQUEST_TIMEOUT_MS = 30000;

export const ROUTES = {
  home: "/",
  auth: "/auth",
  dashboard: "/dashboard",
};
