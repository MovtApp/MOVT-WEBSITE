/* Testes de segurança do BFF (api/). Rodar: npm test
 *
 * Sobe o BFF num servidor HTTP real e um backend FALSO (nada toca a produção).
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { after, before, beforeEach, describe, test } from "node:test";

/* ---------- Backend falso ---------- */
let upstreamCalls = [];
let upstreamReply = () => ({ status: 200, body: {} });
const upstream = createServer(async (req, res) => {
  let raw = "";
  for await (const c of req) raw += c;
  const call = { method: req.method, url: req.url, headers: req.headers, body: raw ? JSON.parse(raw) : undefined };
  upstreamCalls.push(call);
  const { status, body } = upstreamReply(call);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
});

const PROXY_SECRET = "p".repeat(48);
let bff, base, origin;

before(async () => {
  await new Promise((r) => upstream.listen(0, "127.0.0.1", r));
  process.env.UPSTREAM_API_URL = `http://127.0.0.1:${upstream.address().port}/api`;
  process.env.BFF_SESSION_KEY = randomBytes(32).toString("base64");
  process.env.BFF_PROXY_SECRET = PROXY_SECRET;
  const { handle } = await import("../api/_lib/app.js");
  bff = createServer(handle);
  await new Promise((r) => bff.listen(0, "127.0.0.1", r));
  base = `http://localhost:${bff.address().port}`;
  origin = base;
});
after(() => { bff.close(); upstream.close(); });
beforeEach(() => { upstreamCalls = []; upstreamReply = () => ({ status: 200, body: {} }); });

/* ---------- Cliente de teste (com "pote" de cookies) ---------- */
function client() {
  const jar = new Map();
  const cookieHeader = () => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
  const call = async (method, path, { body, headers = {}, raw } = {}) => {
    const res = await fetch(base + path, {
      method,
      headers: { ...(jar.size ? { cookie: cookieHeader() } : {}), ...headers },
      body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined),
    });
    const setCookies = res.headers.getSetCookie();
    for (const c of setCookies) {
      const [pair] = c.split(";");
      const i = pair.indexOf("=");
      const v = pair.slice(i + 1);
      if (v) jar.set(pair.slice(0, i), v);
      else jar.delete(pair.slice(0, i));
    }
    let data = null;
    try { data = await res.json(); } catch {}
    return { status: res.status, data, setCookies, headers: res.headers };
  };
  const csrf = () => decodeURIComponent(jar.get("movt_csrf") || "");
  const post = async (path, body, extra = {}) => {
    if (!jar.has("movt_csrf")) await call("GET", "/api/auth/session");
    return call("POST", path, {
      body,
      headers: { "Content-Type": "application/json", Origin: origin, "X-CSRF-Token": csrf(), ...extra },
    });
  };
  return { call, post, jar, csrf };
}

const loginOk = (user = {}) => () => ({
  status: 200,
  body: {
    sessionId: "sid-123",
    user: { id: 42, nome: "Ana Silva", email: "ana@x.com", isVerified: true, supabase_uid: "uuid-secret", cnpj: "12345678000199", role: "user", ...user },
  },
});

/* ---------- Roteamento ---------- */
describe("allowlist de rotas", () => {
  test("caminho desconhecido → 404 e nada chega ao backend", async () => {
    const r = await client().call("GET", "/api/user/42/export");
    assert.equal(r.status, 404);
    assert.equal(upstreamCalls.length, 0);
  });
  test("método errado → 405", async () => {
    const r = await client().call("GET", "/api/auth/login");
    assert.equal(r.status, 405);
  });
  test("respostas não são cacheáveis", async () => {
    const r = await client().call("GET", "/api/auth/session");
    assert.equal(r.headers.get("cache-control"), "no-store");
  });
});

/* ---------- CSRF / origem ---------- */
describe("CSRF e origem", () => {
  test("POST sem token CSRF → 403", async () => {
    const c = client();
    await c.call("GET", "/api/auth/session");
    const r = await c.call("POST", "/api/auth/login", {
      body: { email: "a@b.com", senha: "x" },
      headers: { "Content-Type": "application/json", Origin: origin },
    });
    assert.equal(r.status, 403);
    assert.equal(upstreamCalls.length, 0);
  });
  test("POST com token errado → 403", async () => {
    const c = client();
    await c.call("GET", "/api/auth/session");
    const r = await c.call("POST", "/api/auth/login", {
      body: { email: "a@b.com", senha: "x" },
      headers: { "Content-Type": "application/json", Origin: origin, "X-CSRF-Token": "forjado" },
    });
    assert.equal(r.status, 403);
  });
  test("POST vindo de outro site → 403", async () => {
    const r = await client().post("/api/auth/login", { email: "a@b.com", senha: "x" }, { Origin: "https://evil.example" });
    assert.equal(r.status, 403);
    assert.equal(upstreamCalls.filter((c) => c.method === "POST").length, 0);
  });
  test("cookie CSRF: SameSite=Strict e legível pelo JS", async () => {
    const r = await client().call("GET", "/api/auth/session");
    const c = r.setCookies.find((s) => s.startsWith("movt_csrf="));
    assert.match(c, /SameSite=Strict/);
    assert.doesNotMatch(c, /HttpOnly/);
  });
});

/* ---------- Login ---------- */
describe("login", () => {
  test("sucesso: token só no cookie HttpOnly, dados minimizados", async () => {
    upstreamReply = loginOk();
    const c = client();
    const r = await c.post("/api/auth/login", { email: "Ana@X.com ", senha: "segredo123" });
    assert.equal(r.status, 200);
    assert.deepEqual(r.data.user, { name: "Ana Silva", email: "ana@x.com", isVerified: true, plan: "free", photo: null });
    assert.ok(!JSON.stringify(r.data).includes("sid-123"), "sessionId não pode ir ao navegador");
    const sid = r.setCookies.find((s) => s.startsWith("movt_sid="));
    assert.match(sid, /HttpOnly/);
    assert.match(sid, /SameSite=Strict/);
    assert.ok(!sid.includes("sid-123"), "cookie precisa estar cifrado");
    // e-mail normalizado antes de ir ao backend
    assert.equal(upstreamCalls.at(-1).body.email, "ana@x.com");
  });

  test("erros de e-mail e de senha geram a MESMA mensagem (anti-enumeração)", async () => {
    upstreamReply = () => ({ status: 401, body: { error: "Endereço de e-mail incorreto, tente novamente!" } });
    const a = await client().post("/api/auth/login", { email: "nao@existe.com", senha: "x" });
    upstreamReply = () => ({ status: 401, body: { error: "Senha inválida, tente novamente!" } });
    const b = await client().post("/api/auth/login", { email: "ana@x.com", senha: "errada" });
    assert.equal(a.status, 401);
    assert.equal(a.data.error, b.data.error);
    assert.equal(a.data.error, "E-mail ou senha inválidos.");
  });

  test("campo extra no corpo → 400 (schema estrito)", async () => {
    const r = await client().post("/api/auth/login", { email: "a@b.com", senha: "x", role: "admin" });
    assert.equal(r.status, 400);
    assert.equal(upstreamCalls.filter((c) => c.method === "POST").length, 0);
  });

  test("Content-Type diferente de JSON → 415", async () => {
    const c = client();
    await c.call("GET", "/api/auth/session");
    const r = await c.call("POST", "/api/auth/login", {
      raw: "email=a@b.com",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Origin: origin, "X-CSRF-Token": c.csrf() },
    });
    assert.equal(r.status, 415);
  });

  test("corpo grande demais → 413", async () => {
    const r = await client().post("/api/auth/login", { email: "a@b.com", senha: "x".repeat(20000) });
    assert.equal(r.status, 413);
  });

  test("força bruta no mesmo e-mail → 429 a partir da 9ª tentativa", async () => {
    upstreamReply = () => ({ status: 401, body: {} });
    const statuses = [];
    for (let i = 0; i < 9; i++) statuses.push((await client().post("/api/auth/login", { email: "alvo@x.com", senha: `t${i}` })).status);
    assert.deepEqual(statuses.slice(0, 8), Array(8).fill(401));
    assert.equal(statuses[8], 429);
  });
});

/* ---------- Sessão e dados ---------- */
describe("sessão e dados do usuário", () => {
  test("sessão válida: backend recebe o token; navegador recebe só o necessário", async () => {
    upstreamReply = loginOk();
    const c = client();
    await c.post("/api/auth/login", { email: "ana@x.com", senha: "segredo123" });

    upstreamReply = () => ({ status: 200, body: { user: { nome: "Ana", email: "ana@x.com", plan: "premium", cnpj: "123", supabase_uid: "u" } } });
    const r = await c.call("GET", "/api/auth/session");
    assert.equal(upstreamCalls.at(-1).headers.authorization, "Bearer sid-123");
    assert.equal(r.data.authenticated, true);
    assert.deepEqual(Object.keys(r.data.user).sort(), ["email", "isVerified", "name", "photo", "plan"]);
  });

  test("agendamentos: e-mail do personal e anotações não saem do servidor", async () => {
    upstreamReply = loginOk();
    const c = client();
    await c.post("/api/auth/login", { email: "ana@x.com", senha: "segredo123" });
    upstreamReply = () => ({
      status: 200,
      body: { data: [{ id_agendamento: 9, id_trainer: 7, data_agendamento: "2026-10-05T03:00:00Z", hora_inicio: "07:30:00", status: "confirmado", notas: "lesão no joelho", trainer_name: "Carlos", trainer_email: "carlos@x.com" }] },
    });
    const r = await c.call("GET", "/api/me/appointments");
    assert.deepEqual(r.data.data, [{ date: "2026-10-05", start: "07:30", status: "confirmado", trainer: "Carlos" }]);
  });

  test("estatísticas usam o ID da sessão cifrada (sem IDOR)", async () => {
    upstreamReply = loginOk({ id: 42 });
    const c = client();
    await c.post("/api/auth/login", { email: "ana@x.com", senha: "segredo123" });
    upstreamReply = () => ({ status: 200, body: { success: true, data: { posts: 3, followers: 10, following: 5 } } });
    const r = await c.call("GET", "/api/me/stats?userId=1");
    assert.equal(upstreamCalls.at(-1).url, "/api/user/42/stats");
    assert.deepEqual(r.data, { posts: 3, followers: 10, following: 5 });
  });

  test("cookie de sessão adulterado → tratado como deslogado", async () => {
    const c = client();
    c.jar.set("movt_sid", "v1.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
    const r = await c.call("GET", "/api/me/plan");
    assert.equal(r.status, 401);
    assert.equal(upstreamCalls.length, 0);
  });

  test("backend diz 401 → BFF apaga os cookies", async () => {
    upstreamReply = loginOk();
    const c = client();
    await c.post("/api/auth/login", { email: "ana@x.com", senha: "segredo123" });
    upstreamReply = () => ({ status: 401, body: {} });
    const r = await c.call("GET", "/api/me/plan");
    assert.equal(r.status, 401);
    assert.ok(!c.jar.has("movt_sid"));
    assert.ok(!c.jar.has("movt_auth"));
  });

  test("logout invalida no backend e apaga os cookies", async () => {
    upstreamReply = loginOk();
    const c = client();
    await c.post("/api/auth/login", { email: "ana@x.com", senha: "segredo123" });
    upstreamReply = () => ({ status: 200, body: { success: true } });
    await c.post("/api/auth/logout");
    assert.equal(upstreamCalls.at(-1).url, "/api/auth/logout");
    assert.equal(upstreamCalls.at(-1).headers.authorization, "Bearer sid-123");
    assert.ok(!c.jar.has("movt_sid"));
  });
});

/* ---------- Cadastro ---------- */
const validRegister = {
  nome: "Ana Silva",
  email: "nova@x.com",
  senha: "senhaforte1",
  tipo_documento: "CPF",
  cpf_cnpj: "529.982.247-25",
  data_nascimento: "10/05/1995",
  telefone: "(11) 98765-4321",
  acceptTerms: true,
  acceptPrivacy: true,
};

describe("cadastro", () => {
  test("CPF inválido → 400 no campo certo, sem chamar o backend", async () => {
    const r = await client().post("/api/auth/register", { ...validRegister, cpf_cnpj: "111.111.111-11" });
    assert.equal(r.status, 400);
    assert.equal(r.data.field, "cpf_cnpj");
    assert.equal(upstreamCalls.filter((c) => c.method === "POST").length, 0);
  });
  test("sem aceite dos termos → 400", async () => {
    const r = await client().post("/api/auth/register", { ...validRegister, acceptTerms: false });
    assert.equal(r.status, 400);
  });
  test("menor de 18 anos → 400", async () => {
    const r = await client().post("/api/auth/register", { ...validRegister, data_nascimento: "01/01/2015" });
    assert.equal(r.status, 400);
  });
  test("sucesso: envia consentimentos versionados e entra direto", async () => {
    upstreamReply = () => ({ status: 201, body: { message: "ok", sessionId: "sid-new", user: { id: 77 } } });
    const r = await client().post("/api/auth/register", validRegister);
    assert.equal(r.status, 201);
    assert.equal(r.data.authenticated, true);
    const sent = upstreamCalls.at(-1).body;
    assert.equal(sent.cpf_cnpj, "52998224725");
    assert.deepEqual(sent.consents.map((c) => c.type), ["terms", "privacy"]);
    assert.ok(!("acceptTerms" in sent));
    assert.ok(!JSON.stringify(r.data).includes("sid-new"));
  });
});

/* ---------- Recuperação ---------- */
describe("recuperação de senha", () => {
  test("e-mail inexistente → mesma resposta de sucesso (anti-enumeração)", async () => {
    upstreamReply = () => ({ status: 404, body: { error: "Usuário não encontrado" } });
    const r = await client().post("/api/auth/recovery/request", { email: "fantasma@x.com" });
    assert.equal(r.status, 200);
    assert.match(r.data.message, /Se o e-mail estiver cadastrado/);
  });
});

/* ---------- IP real assinado para o backend ---------- */
describe("trusted proxy", () => {
  test("backend recebe o IP do usuário assinado", async () => {
    await client().post("/api/auth/recovery/request", { email: "ip@x.com" });
    const h = upstreamCalls.at(-1).headers;
    assert.equal(h["x-movt-client-ip"], "127.0.0.1");
    assert.match(h["x-movt-proxy-sig"], /^[0-9a-f]{64}$/);
  });

  // Caminho do verificador do backend (padrão: repositório ao lado). Sobrescreva com MOVT_BACKEND_TRUSTED_PROXY.
  const backendLib = process.env.MOVT_BACKEND_TRUSTED_PROXY || resolve(import.meta.dirname, "../../MOVT-BACKEND/lib/trusted-proxy.js");
  test("assinatura é aceita pelo verificador do MOVT-BACKEND", { skip: !existsSync(backendLib) && "MOVT-BACKEND não encontrado ao lado" }, async () => {
    await client().post("/api/auth/recovery/request", { email: "ip2@x.com" });
    const call = upstreamCalls.at(-1);
    const { verifiedProxyIp } = createRequire(import.meta.url)(backendLib);
    const req = { method: call.method, originalUrl: call.url, headers: call.headers };
    assert.equal(verifiedProxyIp(req, PROXY_SECRET), "127.0.0.1");
    assert.equal(verifiedProxyIp(req, "q".repeat(48)), null);
  });
});

/* ---------- Unidades ---------- */
describe("unidades", () => {
  test("seal/open: ida e volta; adulteração e chave errada falham", async () => {
    const { seal, open } = await import("../api/_lib/crypto.js");
    const key = randomBytes(32);
    const t = seal({ sid: "abc" }, key);
    assert.deepEqual(open(t, key), { sid: "abc" });
    const tampered = t.slice(0, -2) + (t.at(-2) === "A" ? "B" : "A") + t.at(-1);
    assert.equal(open(tampered, key), null);
    assert.equal(open(t, randomBytes(32)), null);
  });

  test("em HTTPS os cookies usam __Host- e Secure", async () => {
    const { startSession } = await import("../api/_lib/guards.js");
    const headers = {};
    const res = { getHeader: (k) => headers[k], setHeader: (k, v) => (headers[k] = v) };
    startSession({ headers: { host: "movt.app" } }, res, { sessionKey: randomBytes(32) }, { sid: "s", uid: 1 });
    const sid = headers["Set-Cookie"].find((c) => c.startsWith("__Host-movt_sid="));
    assert.match(sid, /; Secure/);
    assert.match(sid, /HttpOnly/);
    assert.match(sid, /Path=\//);
    assert.doesNotMatch(sid, /Domain=/);
  });

  test("logs mascaram dados pessoais e segredos", async () => {
    const { redact } = await import("../api/_lib/log.js");
    const out = redact({ email: "ana@x.com", senha: "123", cpf_cnpj: "529", ip: "203.0.113.7", nested: { token: "t" } });
    assert.deepEqual(out, { email: "a***@x.com", senha: "[redacted]", cpf_cnpj: "[redacted]", ip: "203.0.113.x", nested: { token: "[redacted]" } });
  });

  test("CPF/CNPJ: dígitos verificadores", async () => {
    const { isValidCPF, isValidCNPJ } = await import("../api/_lib/schemas.js");
    assert.ok(isValidCPF("529.982.247-25"));
    assert.ok(!isValidCPF("529.982.247-26"));
    assert.ok(isValidCNPJ("11.222.333/0001-81"));
    assert.ok(!isValidCNPJ("11.222.333/0001-82"));
  });
});
