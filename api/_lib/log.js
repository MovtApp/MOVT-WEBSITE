/* BFF — logs estruturados (JSON) sem dados pessoais nem segredos */
const REDACT = new Set([
  "senha", "password", "newpassword", "code", "token", "sid", "sessionid", "authorization",
  "cookie", "cpf_cnpj", "cpf", "cnpj", "telefone", "phone", "data_nascimento",
]);

const maskEmail = (v) => String(v).replace(/^(.).*(@.*)$/, "$1***$2");
const maskIp = (v) => String(v).replace(/\.\d+$/, ".x").replace(/:[0-9a-f]*$/i, ":x");

export function redact(value, depth = 0) {
  if (depth > 4 || value == null) return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (typeof value !== "object") return value;
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    const key = k.toLowerCase();
    if (REDACT.has(key)) out[k] = "[redacted]";
    else if (key === "email") out[k] = maskEmail(v);
    else if (key === "ip") out[k] = maskIp(v);
    else out[k] = redact(v, depth + 1);
  }
  return out;
}

export function log(level, event, fields = {}) {
  const line = JSON.stringify({ level, event, at: new Date().toISOString(), ...redact(fields) });
  (level === "error" ? console.error : level === "warn" ? console.warn : console.log)(line);
}
