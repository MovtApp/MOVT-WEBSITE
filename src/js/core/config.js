/* MOVT web — configuração de ambiente
 *
 * A URL da API vem SOMENTE do build (VITE_API_URL). Não existe override em
 * runtime (localStorage, query string etc.): isso impediria que um script
 * injetado ou um golpe de "cole isso no console" desviasse login e token
 * para um servidor de terceiros.
 */
const DEFAULT_API_URL = "https://movt-backend.vercel.app/api";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function resolveApiUrl(raw) {
  const url = new URL(raw);
  const isLocal = LOCAL_HOSTS.has(url.hostname);
  // HTTP só é aceito para backend local durante o desenvolvimento
  if (url.protocol !== "https:" && !(import.meta.env.DEV && isLocal)) {
    throw new Error(`VITE_API_URL inválida: use HTTPS (${url.origin}).`);
  }
  return url.href.replace(/\/+$/, "");
}

export const API_BASE = resolveApiUrl(import.meta.env.VITE_API_URL || DEFAULT_API_URL);
export const REQUEST_TIMEOUT_MS = 30000;

export const ROUTES = {
  home: "/",
  auth: "/auth",
  dashboard: "/dashboard",
};
