/* BFF — helpers HTTP (Node puro: funciona na Vercel e no middleware do Vite) */
export const MAX_BODY_BYTES = 16 * 1024;

export class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

export function send(res, status, data, headers = {}) {
  const body = JSON.stringify(data ?? {});
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(body);
}

export function appendCookie(res, cookie) {
  const prev = res.getHeader("Set-Cookie");
  res.setHeader("Set-Cookie", prev ? [].concat(prev, cookie) : [cookie]);
}

export async function readJson(req) {
  const type = String(req.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
  if (type !== "application/json") throw new HttpError(415, "Formato de requisição inválido.");
  const declared = Number(req.headers["content-length"] || 0);
  if (declared > MAX_BODY_BYTES) throw new HttpError(413, "Requisição muito grande.");

  let raw = "";
  if (req.readableEnded || req.complete) {
    // Runtime que já consumiu o stream (ex.: body pré-parseado)
    if (req.body && typeof req.body === "object") return req.body;
    raw = typeof req.body === "string" ? req.body : "";
  } else {
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) throw new HttpError(413, "Requisição muito grande.");
      raw += chunk;
    }
  }
  try {
    const data = JSON.parse(raw || "{}");
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error();
    return data;
  } catch {
    throw new HttpError(400, "JSON inválido.");
  }
}
