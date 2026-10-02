/* BFF — rate limit (janela fixa)
 *
 * Padrão: memória (por instância da função). Para um limite GLOBAL entre
 * instâncias, defina UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN: o
 * mesmo código passa a usar o Redis. Se o Redis falhar, cai para memória
 * (nunca derruba o login por indisponibilidade do contador).
 */
const MAX_KEYS = 10_000;

class MemoryStore {
  constructor() { this.map = new Map(); }

  async hit(key, windowMs, now = Date.now()) {
    let e = this.map.get(key);
    if (!e || e.reset <= now) {
      if (this.map.size >= MAX_KEYS) this.prune(now);
      e = { count: 0, reset: now + windowMs };
      this.map.set(key, e);
    }
    e.count += 1;
    return { count: e.count, resetMs: e.reset - now };
  }

  prune(now) {
    for (const [k, e] of this.map) if (e.reset <= now) this.map.delete(k);
    // Ainda cheio (ataque com muitas chaves): descarta as mais antigas
    for (const k of this.map.keys()) {
      if (this.map.size < MAX_KEYS * 0.9) break;
      this.map.delete(k);
    }
  }
}

class UpstashStore {
  constructor(url, token, fallback) {
    this.url = url.replace(/\/+$/, "");
    this.token = token;
    this.fallback = fallback;
  }

  async hit(key, windowMs) {
    try {
      const res = await fetch(`${this.url}/pipeline`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
        body: JSON.stringify([["INCR", key], ["PEXPIRE", key, windowMs, "NX"], ["PTTL", key]]),
        signal: AbortSignal.timeout(1500),
      });
      if (!res.ok) throw new Error(`upstash ${res.status}`);
      const [[, count], , [, ttl]] = (await res.json()).map((r) => [r.error, r.result]);
      return { count: Number(count), resetMs: ttl > 0 ? Number(ttl) : windowMs };
    } catch (err) {
      console.warn(JSON.stringify({ level: "warn", event: "ratelimit.redis_fallback", error: err.message }));
      return this.fallback.hit(key, windowMs);
    }
  }
}

const memory = new MemoryStore();
const store =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new UpstashStore(process.env.UPSTASH_REDIS_REST_URL, process.env.UPSTASH_REDIS_REST_TOKEN, memory)
    : memory;

/** Retorna null se liberado, ou os segundos até liberar. */
export async function consume(key, { limit, windowMs }, s = store) {
  const { count, resetMs } = await s.hit(`movt:rl:${key}`, windowMs);
  return count > limit ? Math.max(1, Math.ceil(resetMs / 1000)) : null;
}

export const MIN = 60 * 1000;

// Mais restritivo que o backend (que também limita), para barrar abuso já no BFF
export const LIMITS = {
  global: { limit: 300, windowMs: 5 * MIN },
  loginIp: { limit: 20, windowMs: 15 * MIN },
  loginEmail: { limit: 8, windowMs: 15 * MIN },
  registerIp: { limit: 10, windowMs: 15 * MIN },
  registerEmail: { limit: 5, windowMs: 15 * MIN },
  recoveryIp: { limit: 10, windowMs: 15 * MIN },
  recoveryEmail: { limit: 5, windowMs: 15 * MIN },
  // Ações do painel (cancelar, curtir, entrar em comunidade...), por sessão
  action: { limit: 60, windowMs: 5 * MIN },
  checkout: { limit: 10, windowMs: 15 * MIN },
};

export { MemoryStore };
