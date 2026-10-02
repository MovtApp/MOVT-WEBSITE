/* MOVT web — autenticação via BFF (o token nunca passa pelo JavaScript) */
import { request } from "./api.js";
import { ROUTES } from "./config.js";

export const getSession = () => request("/auth/session");

export const login = (email, senha) => request("/auth/login", { method: "POST", body: { email, senha } });

export const register = (payload) => request("/auth/register", { method: "POST", body: payload });

export const recovery = {
  request: (email) => request("/auth/recovery/request", { method: "POST", body: { email } }),
  verify: (email, code) => request("/auth/recovery/verify", { method: "POST", body: { email, code } }),
  reset: (email, code, newPassword) =>
    request("/auth/recovery/reset", { method: "POST", body: { email, code, newPassword } }),
};

// Invalida a sessão no backend e apaga os cookies (feito pelo BFF)
export async function logout() {
  try { await request("/auth/logout", { method: "POST" }); } catch {}
  location.replace(ROUTES.auth);
}
