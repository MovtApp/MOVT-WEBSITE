/* BFF — primitivas criptográficas */
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const VERSION = "v1";
const AAD = Buffer.from("movt-session-v1");

// AES-256-GCM: o conteúdo do cookie fica cifrado E autenticado (qualquer
// alteração de 1 bit faz open() devolver null).
export function seal(payload, key) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(AAD);
  const ct = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${VERSION}.${Buffer.concat([iv, tag, ct]).toString("base64url")}`;
}

export function open(token, key) {
  if (typeof token !== "string" || !token.startsWith(`${VERSION}.`) || token.length > 4096) return null;
  try {
    const buf = Buffer.from(token.slice(VERSION.length + 1), "base64url");
    if (buf.length < 29) return null;
    const decipher = createDecipheriv("aes-256-gcm", key, buf.subarray(0, 12));
    decipher.setAAD(AAD);
    decipher.setAuthTag(buf.subarray(12, 28));
    const pt = Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]);
    return JSON.parse(pt.toString("utf8"));
  } catch {
    return null;
  }
}

export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");

// Comparação em tempo constante para strings de qualquer tamanho
export function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || !a || !b) return false;
  const x = createHash("sha256").update(a).digest();
  const y = createHash("sha256").update(b).digest();
  return timingSafeEqual(x, y) && a.length === b.length;
}

// Chave de rate limit sem guardar o dado pessoal em memória (ex.: e-mail)
export const hashKey = (v) => createHash("sha256").update(String(v)).digest("hex").slice(0, 32);

// Mesmo formato que MOVT-BACKEND/lib/trusted-proxy.js verifica
export function signProxyHeaders(secret, { ip, method, pathname, ts = Math.floor(Date.now() / 1000) }) {
  const msg = `v1.${ts}.${ip}.${String(method).toUpperCase()}.${pathname}`;
  return { ts: String(ts), sig: createHmac("sha256", secret).update(msg).digest("hex") };
}
