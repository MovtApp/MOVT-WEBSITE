/* BFF — guardas por requisição: IP do cliente, origem, CSRF e sessão */
import { isIP } from "node:net";
import { cookieNames, parseCookies, serialize, SESSION_MAX_AGE } from "./cookies.js";
import { open, randomToken, safeEqual, seal } from "./crypto.js";
import { onVercel } from "./env.js";
import { appendCookie, HttpError } from "./http.js";

const first = (v) => (Array.isArray(v) ? v[0] : v);

// Na Vercel, x-real-ip / x-forwarded-for são definidos pela borda (não dá para
// forjar). Fora dela, só o socket é confiável.
export function clientIp(req) {
  if (onVercel()) {
    const ip = first(req.headers["x-real-ip"]) || String(first(req.headers["x-forwarded-for"]) || "").split(",")[0].trim();
    if (isIP(ip)) return ip;
  }
  const sock = String(req.socket?.remoteAddress || "").replace(/^::ffff:/, "");
  return isIP(sock) ? sock : "0.0.0.0";
}

const host = (req) => String(first(req.headers["x-forwarded-host"]) || req.headers.host || "");

// HTTPS em qualquer lugar fora de localhost
export function isSecure(req) {
  const h = host(req).replace(/:\d+$/, "");
  return !(h === "localhost" || h === "127.0.0.1" || h === "[::1]");
}

// Origem precisa ser o próprio site (ou ALLOWED_ORIGINS). Sem Origin, exige
// Sec-Fetch-Site: same-origin. Bloqueia CSRF vindo de outros sites.
export function assertSameOrigin(req, cfg) {
  const origin = first(req.headers.origin);
  if (origin) {
    const expected = `${isSecure(req) ? "https" : "http"}://${host(req)}`;
    if (origin === expected || cfg.allowedOrigins.includes(origin)) return;
    throw new HttpError(403, "Origem não permitida.");
  }
  if (first(req.headers["sec-fetch-site"]) === "same-origin") return;
  throw new HttpError(403, "Origem não permitida.");
}

export function readCookies(req) {
  return parseCookies(req.headers.cookie);
}

// Double-submit: o header precisa ser igual ao cookie (que outro site não lê)
export function assertCsrf(req) {
  const names = cookieNames(isSecure(req));
  const cookie = readCookies(req)[names.csrf];
  const header = first(req.headers["x-csrf-token"]);
  if (!safeEqual(cookie, header)) throw new HttpError(403, "Sessão expirada. Recarregue a página.");
}

export function ensureCsrf(req, res, { rotate = false } = {}) {
  const secure = isSecure(req);
  const names = cookieNames(secure);
  const current = readCookies(req)[names.csrf];
  if (current && !rotate) return current;
  const token = randomToken(24);
  appendCookie(res, serialize(names.csrf, token, { httpOnly: false, secure, maxAge: SESSION_MAX_AGE }));
  return token;
}

export function readSession(req, cfg) {
  const names = cookieNames(isSecure(req));
  const s = open(readCookies(req)[names.session], cfg.sessionKey);
  if (!s || typeof s.sid !== "string" || !s.iat) return null;
  if (Date.now() - s.iat > SESSION_MAX_AGE * 1000) return null; // expiração absoluta
  return s;
}

export function startSession(req, res, cfg, { sid, uid }) {
  const secure = isSecure(req);
  const names = cookieNames(secure);
  const token = seal({ sid, uid, iat: Date.now() }, cfg.sessionKey);
  appendCookie(res, serialize(names.session, token, { secure, maxAge: SESSION_MAX_AGE }));
  appendCookie(res, serialize(names.auth, "1", { httpOnly: false, secure, sameSite: "Lax", maxAge: SESSION_MAX_AGE }));
  ensureCsrf(req, res, { rotate: true }); // novo token CSRF a cada login
}

export function endSession(req, res) {
  const secure = isSecure(req);
  const names = cookieNames(secure);
  appendCookie(res, serialize(names.session, "", { secure, maxAge: 0 }));
  appendCookie(res, serialize(names.auth, "", { httpOnly: false, secure, sameSite: "Lax", maxAge: 0 }));
}
