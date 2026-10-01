/* MOVT web — cliente da API e sessão (mesmo backend do app mobile) */
(() => {
  // Para apontar para o backend local: localStorage.setItem("movt:api", "http://localhost:3000/api")
  const API_BASE = (() => {
    try { return localStorage.getItem("movt:api") || "https://movt-backend.vercel.app/api"; }
    catch { return "https://movt-backend.vercel.app/api"; }
  })();

  const KEY_SESSION = "movt:sessionId";
  const KEY_USER = "movt:user";

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
    del(k) { try { localStorage.removeItem(k); } catch {} },
  };

  async function request(path, { method = "GET", body, params } = {}) {
    const url = new URL(API_BASE + path);
    if (params) Object.entries(params).forEach(([k, v]) => v != null && url.searchParams.set(k, v));
    const headers = { "Content-Type": "application/json" };
    const sid = store.get(KEY_SESSION);
    if (sid) headers.Authorization = `Bearer ${sid}`;

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30000);
    let res;
    try {
      res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined, signal: ctrl.signal });
    } catch (e) {
      throw new Error(e.name === "AbortError" ? "O servidor demorou para responder." : "Não foi possível conectar ao servidor.");
    } finally {
      clearTimeout(timer);
    }
    let data = null;
    try { data = await res.json(); } catch {}
    if (!res.ok) {
      const err = new Error(data?.error || data?.message || `Erro ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  const session = {
    get user() {
      try { return JSON.parse(store.get(KEY_USER) || "null"); } catch { return null; }
    },
    get id() { return store.get(KEY_SESSION); },
    save(sessionId, user) {
      store.set(KEY_SESSION, sessionId);
      store.set(KEY_USER, JSON.stringify(user));
    },
    update(patch) {
      const u = { ...(session.user || {}), ...patch };
      store.set(KEY_USER, JSON.stringify(u));
      return u;
    },
    clear() { store.del(KEY_SESSION); store.del(KEY_USER); },
  };

  // Mesmo mapeamento que o signinScreen do app faz da resposta de /login
  const mapUser = (u = {}) => ({
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

  const MOVT = {
    API_BASE,
    session,
    request,
    async login(email, senha) {
      const data = await request("/login", { method: "POST", body: { email, senha } });
      if (!data?.sessionId) throw new Error(data?.message || "Resposta inválida do servidor.");
      session.save(data.sessionId, mapUser(data.user));
      return data;
    },
    register(payload) {
      return request("/register", { method: "POST", body: payload });
    },
    recovery: {
      request: (email) => request("/auth/recovery/request", { method: "POST", body: { email } }),
      verify: (email, code) => request("/auth/recovery/verify", { method: "POST", body: { email, code } }),
      reset: (email, code, newPassword) =>
        request("/auth/recovery/reset", { method: "POST", body: { email, code, newPassword } }),
    },
    logout() {
      session.clear();
      location.href = "auth.html";
    },
  };

  window.MOVT = MOVT;

  // Botões "Entrar" da landing viram "Dashboard" quando já há sessão
  document.addEventListener("DOMContentLoaded", () => {
    if (!session.id) return;
    document.querySelectorAll("[data-auth-link]").forEach((a) => {
      a.textContent = "Dashboard";
      a.href = "dashboard.html";
    });
  });
})();
