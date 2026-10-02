/* BFF — cookies de sessão e CSRF
 *
 * - sessão: HttpOnly (JS não lê), Secure, SameSite=Strict, prefixo __Host-
 *   (só pode ser definido por este host, em HTTPS, sem Domain).
 * - csrf:   legível pelo JS (double-submit), mesmas flags fora o HttpOnly.
 * - auth:   só uma "dica" de que há sessão (valor "1"), para o front decidir
 *   redirecionamentos sem chamar a API. Não autoriza nada.
 */
export const SESSION_MAX_AGE = 60 * 24 * 60 * 60; // igual ao TTL do backend (60 dias)

export const cookieNames = (secure) => {
  const p = secure ? "__Host-" : "";
  return { session: `${p}movt_sid`, csrf: `${p}movt_csrf`, auth: "movt_auth" };
};

export function parseCookies(header = "") {
  const out = {};
  for (const part of String(header).split(";")) {
    const i = part.indexOf("=");
    if (i < 1) continue;
    const k = part.slice(0, i).trim();
    if (!(k in out)) {
      try { out[k] = decodeURIComponent(part.slice(i + 1).trim()); } catch {}
    }
  }
  return out;
}

export function serialize(name, value, { maxAge, httpOnly = true, secure, sameSite = "Strict" } = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, "Path=/", `SameSite=${sameSite}`];
  if (maxAge !== undefined) parts.push(`Max-Age=${maxAge}`);
  if (httpOnly) parts.push("HttpOnly");
  if (secure) parts.push("Secure");
  return parts.join("; ");
}
