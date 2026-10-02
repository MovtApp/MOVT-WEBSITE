/* BFF — configuração de ambiente (lida em runtime, só no servidor).
 *
 * Este BFF NUNCA recebe credenciais do banco: o único dono dos dados é o
 * MOVT-BACKEND. Aqui só existem a URL da API e os segredos do próprio BFF.
 */
import { randomBytes } from "node:crypto";

const DEFAULT_UPSTREAM = "https://movt-backend.vercel.app/api";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export const onVercel = () => process.env.VERCEL === "1";

let ephemeralKey = null;
let warned = false;

export class ConfigError extends Error {}

function sessionKey() {
  const raw = process.env.BFF_SESSION_KEY;
  if (raw) {
    const key = Buffer.from(raw, "base64");
    if (key.length !== 32) throw new ConfigError("BFF_SESSION_KEY deve ter 32 bytes em base64.");
    return key;
  }
  // Fail closed em qualquer deploy (produção e preview)
  if (onVercel()) throw new ConfigError("BFF_SESSION_KEY não configurada.");
  if (!warned) {
    console.warn("[bff] BFF_SESSION_KEY ausente: usando chave temporária (sessões somem ao reiniciar).");
    warned = true;
  }
  return (ephemeralKey ??= randomBytes(32));
}

function proxySecret() {
  const s = process.env.BFF_PROXY_SECRET || "";
  if (s && s.length < 32) throw new ConfigError("BFF_PROXY_SECRET deve ter pelo menos 32 caracteres.");
  if (!s && onVercel()) throw new ConfigError("BFF_PROXY_SECRET não configurada.");
  return s || null;
}

function upstreamUrl() {
  const url = new URL(process.env.UPSTREAM_API_URL || DEFAULT_UPSTREAM);
  const local = LOCAL_HOSTS.has(url.hostname);
  if (url.protocol !== "https:" && !(local && !onVercel())) {
    throw new ConfigError("UPSTREAM_API_URL precisa ser HTTPS.");
  }
  return url.href.replace(/\/+$/, "");
}

const allowedOrigins = () =>
  (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

export function loadConfig() {
  return {
    upstream: upstreamUrl(),
    sessionKey: sessionKey(),
    proxySecret: proxySecret(),
    allowedOrigins: allowedOrigins(),
  };
}
