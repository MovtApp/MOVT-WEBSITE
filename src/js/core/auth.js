/* MOVT web — autenticação (login, registro, recuperação, logout) */
import { request } from "./api.js";
import { ROUTES } from "./config.js";
import { session } from "./session.js";

// Mesmo mapeamento que o signinScreen do app faz da resposta de /login
export const mapUser = (u = {}) => ({
  id: u.id,
  name: u.nome || u.name || "",
  email: u.email || "",
  username: u.username || "",
  isVerified: !!u.isVerified,
  supabaseUserId: u.supabase_uid || null,
  photo: u.photo || u.foto || null,
  plan: u.plan || "free",
  role: (u.role || "").trim().toLowerCase(),
});

export async function login(email, senha) {
  const data = await request("/login", { method: "POST", body: { email, senha } });
  if (!data?.sessionId) throw new Error(data?.message || "Resposta inválida do servidor.");
  session.save(data.sessionId, mapUser(data.user));
  return data;
}

export const register = (payload) => request("/register", { method: "POST", body: payload });

export const recovery = {
  request: (email) => request("/auth/recovery/request", { method: "POST", body: { email } }),
  verify: (email, code) => request("/auth/recovery/verify", { method: "POST", body: { email, code } }),
  reset: (email, code, newPassword) =>
    request("/auth/recovery/reset", { method: "POST", body: { email, code, newPassword } }),
};

// Invalida a sessão no servidor (best effort) e limpa o navegador
export async function logout() {
  if (session.id) {
    try { await request("/auth/logout", { method: "POST" }); } catch {}
  }
  session.clear();
  location.replace(ROUTES.auth);
}
