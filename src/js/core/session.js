/* MOVT web — sessão local (mesmas chaves usadas por public/js/auth-guard.js) */
const KEY_SESSION = "movt:sessionId";
const KEY_USER = "movt:user";

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};

// Remove o override de API das versões antigas do site, se ainda existir
store.del("movt:api");

export const session = {
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
