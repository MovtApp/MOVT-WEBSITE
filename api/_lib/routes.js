/* BFF — rotas (allowlist). Qualquer outro caminho em /api responde 404. */
import { hashKey } from "./crypto.js";
import { endSession, ensureCsrf, readSession, siteOrigin, startSession } from "./guards.js";
import { HttpError, readJson, send } from "./http.js";
import { log } from "./log.js";
import { consume, LIMITS } from "./rate-limit.js";
import * as clean from "./sanitize.js";
import {
  checkoutSchema, digits, firstIssue, idActionSchema, loginSchema, recoveryRequestSchema, recoveryResetSchema,
  recoveryVerifySchema, registerSchema, trainingsQuerySchema,
} from "./schemas.js";
import { callUpstream, upstreamMessage } from "./upstream.js";

// Versões dos documentos aceitos no cadastro. DEVEM ser iguais às de
// MOVT-BACKEND/lib/privacy.js (CONSENT_VERSIONS), senão o cadastro é recusado.
export const CONSENT_VERSIONS = { terms: "2026-09-24", privacy: "2026-09-24" };

const GENERIC_LOGIN_ERROR = "E-mail ou senha inválidos.";
const GENERIC_RECOVERY_SENT = "Se o e-mail estiver cadastrado, você receberá um código em instantes.";
const GENERIC_CODE_ERROR = "Código inválido ou expirado.";
const ALLOWED_FIELDS = new Set(["nome", "email", "senha", "cpf_cnpj", "data_nascimento", "telefone", "consents"]);

async function limit(ctx, name, key) {
  const retry = await consume(`${name}:${hashKey(key)}`, LIMITS[name]);
  if (retry) {
    log("warn", "ratelimit.blocked", { rule: name, ip: ctx.ip });
    throw new HttpError(429, "Muitas tentativas. Aguarde alguns minutos.", { headers: { "Retry-After": String(retry) } });
  }
}

async function body(ctx, schema) {
  const parsed = schema.safeParse(await readJson(ctx.req));
  if (!parsed.success) throw new HttpError(400, firstIssue(parsed.error).error, { field: firstIssue(parsed.error).field });
  return parsed.data;
}

const up = (ctx, opts) =>
  callUpstream(ctx.cfg, { ...opts, ip: ctx.ip, userAgent: ctx.req.headers["user-agent"] });

/* ---------- Autenticação ---------- */
async function getSession(ctx) {
  const csrfToken = ensureCsrf(ctx.req, ctx.res);
  const s = readSession(ctx.req, ctx.cfg);
  if (!s) {
    endSession(ctx.req, ctx.res);
    return send(ctx.res, 200, { authenticated: false, csrfToken });
  }
  const r = await up(ctx, { path: "/user/session-status", sid: s.sid });
  if (r.status === 401 || r.status === 403) {
    endSession(ctx.req, ctx.res);
    return send(ctx.res, 200, { authenticated: false, csrfToken });
  }
  if (!r.ok) throw new HttpError(502, "Não foi possível validar a sessão.");
  return send(ctx.res, 200, { authenticated: true, csrfToken, user: clean.user(r.data.user) });
}

async function login(ctx) {
  const input = await body(ctx, loginSchema);
  await limit(ctx, "loginIp", ctx.ip);
  await limit(ctx, "loginEmail", input.email);

  const r = await up(ctx, { method: "POST", path: "/login", body: input });
  if (r.status === 429) throw new HttpError(429, "Muitas tentativas. Aguarde alguns minutos.");
  if (r.status === 403) throw new HttpError(403, "Conta inativa. Entre em contato com o suporte.");
  // 400/401/404: mensagem única (não revela se o e-mail existe)
  if (!r.ok || typeof r.data.sessionId !== "string" || !r.data.sessionId) {
    log("info", "auth.login_failed", { ip: ctx.ip, status: r.status });
    throw new HttpError(401, GENERIC_LOGIN_ERROR);
  }
  startSession(ctx.req, ctx.res, ctx.cfg, { sid: r.data.sessionId, uid: r.data.user?.id ?? null });
  log("info", "auth.login", { ip: ctx.ip });
  return send(ctx.res, 200, { user: clean.user(r.data.user) });
}

async function register(ctx) {
  const v = await body(ctx, registerSchema);
  await limit(ctx, "registerIp", ctx.ip);
  await limit(ctx, "registerEmail", v.email);

  const r = await up(ctx, {
    method: "POST",
    path: "/register",
    body: {
      nome: v.nome,
      email: v.email,
      senha: v.senha,
      cpf_cnpj: digits(v.cpf_cnpj),
      data_nascimento: v.data_nascimento,
      telefone: v.telefone,
      tipo_documento: v.tipo_documento,
      consents: [
        { type: "terms", version: CONSENT_VERSIONS.terms },
        { type: "privacy", version: CONSENT_VERSIONS.privacy },
      ],
    },
  });
  if (r.status === 429) throw new HttpError(429, "Muitas tentativas. Aguarde alguns minutos.");
  if (!r.ok) {
    const field = ALLOWED_FIELDS.has(r.data.field) ? r.data.field : undefined;
    throw new HttpError(r.status === 409 ? 409 : 400, upstreamMessage(r.data, "Não foi possível criar a conta."), { field });
  }
  // O backend já devolve uma sessão: o usuário entra direto (o token fica só no cookie HttpOnly)
  if (typeof r.data.sessionId === "string" && r.data.sessionId) {
    startSession(ctx.req, ctx.res, ctx.cfg, { sid: r.data.sessionId, uid: r.data.user?.id ?? null });
  }
  log("info", "auth.register", { ip: ctx.ip });
  return send(ctx.res, 201, { message: "Conta criada! Verifique seu e-mail.", authenticated: !!r.data.sessionId });
}

async function recoveryRequest(ctx) {
  const { email } = await body(ctx, recoveryRequestSchema);
  await limit(ctx, "recoveryIp", ctx.ip);
  await limit(ctx, "recoveryEmail", email);
  const r = await up(ctx, { method: "POST", path: "/auth/recovery/request", body: { email } });
  if (r.status === 429) throw new HttpError(429, "Muitas tentativas. Aguarde alguns minutos.");
  // Sempre a mesma resposta: não revela se o e-mail tem conta
  return send(ctx.res, 200, { message: GENERIC_RECOVERY_SENT });
}

async function recoveryVerify(ctx) {
  const { email, code } = await body(ctx, recoveryVerifySchema);
  await limit(ctx, "recoveryIp", ctx.ip);
  await limit(ctx, "recoveryEmail", email);
  const r = await up(ctx, { method: "POST", path: "/auth/recovery/verify", body: { email, code } });
  if (r.status === 429) throw new HttpError(429, "Muitas tentativas. Aguarde alguns minutos.");
  if (!r.ok) throw new HttpError(400, GENERIC_CODE_ERROR);
  return send(ctx.res, 200, { ok: true });
}

async function recoveryReset(ctx) {
  const { email, code, newPassword } = await body(ctx, recoveryResetSchema);
  await limit(ctx, "recoveryIp", ctx.ip);
  await limit(ctx, "recoveryEmail", email);
  const r = await up(ctx, { method: "POST", path: "/auth/recovery/reset", body: { email, code, newPassword } });
  if (r.status === 429) throw new HttpError(429, "Muitas tentativas. Aguarde alguns minutos.");
  if (!r.ok) throw new HttpError(400, upstreamMessage(r.data, GENERIC_CODE_ERROR));
  endSession(ctx.req, ctx.res); // senha trocada: derruba a sessão deste navegador
  log("info", "auth.password_reset", { ip: ctx.ip });
  return send(ctx.res, 200, { ok: true });
}

async function logout(ctx) {
  const s = readSession(ctx.req, ctx.cfg);
  if (s) {
    try { await up(ctx, { method: "POST", path: "/auth/logout", sid: s.sid }); } catch {}
  }
  endSession(ctx.req, ctx.res);
  return send(ctx.res, 200, { ok: true });
}

/* ---------- Dados do usuário logado ---------- */
async function authed(ctx, opts) {
  const s = readSession(ctx.req, ctx.cfg);
  if (!s) throw new HttpError(401, "Sessão expirada. Entre novamente.");
  const r = await up(ctx, { ...opts, sid: s.sid });
  if (r.status === 401 || r.status === 403) {
    endSession(ctx.req, ctx.res);
    throw new HttpError(401, "Sessão expirada. Entre novamente.");
  }
  if (!r.ok) throw new HttpError(502, "Não foi possível carregar os dados agora.");
  return { data: r.data, session: s };
}

// Ações do painel: sessão obrigatória + limite por sessão. Erros "de negócio"
// do backend (limite do plano, sem permissão, já encerrado) NÃO derrubam a
// sessão: viram 402/409 com mensagem curta. Só 401 (ou conta inativa) desloga.
async function action(ctx, opts, { rule = "action" } = {}) {
  const s = readSession(ctx.req, ctx.cfg);
  if (!s) throw new HttpError(401, "Sessão expirada. Entre novamente.");
  await limit(ctx, rule, s.sid);
  const r = await up(ctx, { ...opts, sid: s.sid });
  if (r.status === 401 || (r.status === 403 && r.data?.error === "USER_INACTIVE")) {
    endSession(ctx.req, ctx.res);
    throw new HttpError(401, "Sessão expirada. Entre novamente.");
  }
  if (r.status === 403 && r.data?.error === "FREE_LIMIT_REACHED") {
    const msg = typeof r.data.message === "string" && r.data.message.length <= 200 ? r.data.message : "Você atingiu o limite do seu plano.";
    throw new HttpError(402, msg, { code: "PLAN_LIMIT" });
  }
  if (r.status === 404) throw new HttpError(404, "Item não encontrado.");
  if (r.status === 429) throw new HttpError(429, "Muitas tentativas. Aguarde alguns minutos.");
  if (!r.ok) throw new HttpError(409, upstreamMessage(r.data, "Não foi possível concluir a ação."));
  return { data: r.data, session: s };
}

async function trainingFilters(ctx) {
  const { data } = await authed(ctx, { path: "/treino-niveis" });
  return send(ctx.res, 200, { levels: clean.names(data.data, 10) });
}

async function cancelAppointment(ctx) {
  const { id } = await body(ctx, idActionSchema);
  await action(ctx, { method: "PUT", path: `/appointments/${id}`, body: { status: "cancelado" } });
  log("info", "appointment.cancelled", { ip: ctx.ip });
  return send(ctx.res, 200, { ok: true });
}

/* ---------- Plano e assinatura ---------- */
// Só abrimos páginas de pagamento destes domínios (mesma lista do app)
const STRIPE_HOSTS = { checkout: ["checkout.stripe.com"], portal: ["billing.stripe.com"] };
const trustedUrl = (v, hosts) => {
  try {
    const u = new URL(String(v));
    return u.protocol === "https:" && hosts.includes(u.hostname) ? u.href : null;
  } catch {
    return null;
  }
};

async function catalog(ctx) {
  const r = await up(ctx, { path: "/plans" });
  if (!r.ok || !Array.isArray(r.data)) throw new HttpError(502, "Não foi possível carregar os planos agora.");
  return clean.list(r.data, clean.catalogPlan, 10);
}

async function plans(ctx) {
  if (!readSession(ctx.req, ctx.cfg)) throw new HttpError(401, "Sessão expirada. Entre novamente.");
  return send(ctx.res, 200, { data: await catalog(ctx) });
}

async function billing(ctx) {
  const { data } = await authed(ctx, { path: "/user/billing-info" });
  return send(ctx.res, 200, clean.billing(data));
}

async function checkout(ctx) {
  const { priceId, quantity = 1 } = await body(ctx, checkoutSchema);
  // O preço precisa existir no catálogo e ser de um plano pago
  const plan = (await catalog(ctx)).find((p) => p.priceId === priceId && p.type !== "free");
  if (!plan) throw new HttpError(400, "Plano inválido.");
  const seats = plan.type === "familia" ? Math.min(10, Math.max(2, quantity)) : 1;
  const origin = typeof ctx.req.headers.origin === "string" ? ctx.req.headers.origin : siteOrigin(ctx.req);
  const { data } = await action(
    ctx,
    { method: "POST", path: "/create-checkout-session", body: { priceId, quantity: seats, returnUrl: `${origin}/dashboard/plano?checkout=retorno` } },
    { rule: "checkout" }
  );
  const url = trustedUrl(data.url, STRIPE_HOSTS.checkout);
  if (!url) throw new HttpError(502, "Não foi possível iniciar o pagamento agora.");
  log("info", "billing.checkout_started", { ip: ctx.ip, plan: plan.type });
  return send(ctx.res, 200, { url });
}

async function portal(ctx) {
  const { data } = await action(ctx, { method: "POST", path: "/billing/portal" }, { rule: "checkout" });
  const url = trustedUrl(data.url, STRIPE_HOSTS.portal);
  if (!url) throw new HttpError(502, "Não foi possível abrir o portal de assinatura agora.");
  return send(ctx.res, 200, { url });
}

/* ---------- Comunidade ---------- */
// O ID vem da sessão cifrada, nunca do cliente (evita IDOR)
const uidPath = (ctx, suffix = "") => {
  const s = readSession(ctx.req, ctx.cfg);
  if (!s?.uid) throw new HttpError(401, "Sessão expirada. Entre novamente.");
  return `/user/${encodeURIComponent(s.uid)}${suffix}`;
};

async function profile(ctx) {
  const { data } = await authed(ctx, { path: uidPath(ctx) });
  return send(ctx.res, 200, clean.profile(data));
}

async function myPosts(ctx) {
  const { data } = await authed(ctx, { path: uidPath(ctx, "/posts") });
  return send(ctx.res, 200, { data: clean.list(data.data, clean.ownPost, 60).filter((p) => p.id) });
}

async function feed(ctx) {
  const { data } = await authed(ctx, { path: "/feed" });
  return send(ctx.res, 200, { data: clean.list(data.posts, clean.feedPost, 30).filter((p) => p.id) });
}

async function communities(ctx) {
  const { data } = await authed(ctx, { path: "/comunidades" });
  return send(ctx.res, 200, { data: clean.list(data.data, clean.community, 60).filter((c) => c.id) });
}

async function likePost(ctx) {
  const { id } = await body(ctx, idActionSchema);
  const { data } = await action(ctx, { method: "POST", path: `/user/posts/${id}/like` });
  return send(ctx.res, 200, { liked: data.isLiked === true });
}

async function joinCommunity(ctx) {
  const { id } = await body(ctx, idActionSchema);
  await action(ctx, { method: "POST", path: `/comunidades/${id}/entrar` });
  log("info", "community.joined", { ip: ctx.ip });
  return send(ctx.res, 200, { ok: true });
}

async function trainings(ctx) {
  const parsed = trainingsQuerySchema.safeParse(Object.fromEntries(ctx.url.searchParams));
  if (!parsed.success) throw new HttpError(400, "Filtro inválido.");
  const { specialty, daily } = parsed.data;
  const { data } = await authed(ctx, { path: "/treinos", query: { specialty, isDaily: daily ? "true" : undefined } });
  return send(ctx.res, 200, { data: clean.list(data.data, clean.training, 30) });
}

async function appointments(ctx) {
  const { data } = await authed(ctx, { path: "/appointments", query: { role: "client" } });
  return send(ctx.res, 200, { data: clean.list(data.data, clean.appointment, 50) });
}

async function planStatus(ctx) {
  const { data } = await authed(ctx, { path: "/user/plan-status" });
  return send(ctx.res, 200, clean.planStatus(data));
}

async function health(ctx) {
  const { data } = await authed(ctx, { path: "/health/daily-summary" });
  return send(ctx.res, 200, clean.health(data));
}

async function stats(ctx) {
  const s = readSession(ctx.req, ctx.cfg);
  // O ID vem da sessão cifrada, nunca do cliente (evita IDOR)
  if (!s?.uid) throw new HttpError(401, "Sessão expirada. Entre novamente.");
  const { data } = await authed(ctx, { path: `/user/${encodeURIComponent(s.uid)}/stats` });
  return send(ctx.res, 200, clean.stats(data));
}

// method + path → { handler, mutating }
export const ROUTES = {
  "GET /api/auth/session": { handler: getSession },
  "POST /api/auth/login": { handler: login, mutating: true },
  "POST /api/auth/register": { handler: register, mutating: true },
  "POST /api/auth/recovery/request": { handler: recoveryRequest, mutating: true },
  "POST /api/auth/recovery/verify": { handler: recoveryVerify, mutating: true },
  "POST /api/auth/recovery/reset": { handler: recoveryReset, mutating: true },
  "POST /api/auth/logout": { handler: logout, mutating: true },
  "GET /api/me/trainings": { handler: trainings },
  "GET /api/me/appointments": { handler: appointments },
  "GET /api/me/plan": { handler: planStatus },
  "GET /api/me/stats": { handler: stats },
  "GET /api/me/health": { handler: health },
  "GET /api/me/training-filters": { handler: trainingFilters },
  "POST /api/me/appointments/cancel": { handler: cancelAppointment, mutating: true },
  "GET /api/plans": { handler: plans },
  "GET /api/me/billing": { handler: billing },
  "POST /api/me/billing/checkout": { handler: checkout, mutating: true },
  "POST /api/me/billing/portal": { handler: portal, mutating: true },
  "GET /api/me/profile": { handler: profile },
  "GET /api/me/posts": { handler: myPosts },
  "GET /api/feed": { handler: feed },
  "POST /api/feed/like": { handler: likePost, mutating: true },
  "GET /api/me/communities": { handler: communities },
  "POST /api/me/communities/join": { handler: joinCommunity, mutating: true },
};
