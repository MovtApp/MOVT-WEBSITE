/* BFF — minimização de dados (LGPD art. 6º, III)
 *
 * Toda resposta do backend passa por uma allowlist de campos antes de chegar
 * ao navegador. O backend devolve, por exemplo, CNPJ, IDs internos, UID do
 * Supabase e e-mail do personal trainer: nada disso é usado pelo site, então
 * nada disso sai daqui.
 */
const str = (v, max = 200) => (typeof v === "string" ? v.slice(0, max) : v == null ? "" : String(v).slice(0, max));
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const httpsUrl = (v) => {
  try {
    const u = new URL(String(v));
    return u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
};
const PLANS = new Set(["free", "premium", "familia"]);
const plan = (v) => (PLANS.has(v) ? v : "free");

export const user = (u = {}) => ({
  name: str(u.nome || u.name, 120),
  email: str(u.email, 254),
  isVerified: u.isVerified === true || u.email_verified === true,
  plan: plan(u.plan),
  photo: httpsUrl(u.photo || u.foto || u.avatar_url),
});

// O backend guarda a lista de exercícios como JSON (às vezes em texto)
const jsonList = (v) => {
  if (Array.isArray(v)) return v;
  if (typeof v !== "string" || v.length > 50_000) return [];
  try {
    const parsed = JSON.parse(v);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const exercise = (e) => {
  if (typeof e === "string") return { name: str(e, 120), detail: "" };
  const reps = e?.series && e?.repeticoes ? `${str(e.series, 6)} × ${str(e.repeticoes, 12)}` : "";
  return { name: str(e?.nome || e?.name, 120), detail: reps || str(e?.duracao || e?.detail, 40) };
};

export const training = (t = {}) => ({
  id: str(t.id_treino ?? t.id, 64),
  title: str(t.nome || t.title, 120) || "Treino",
  description: str(t.descricao || t.description, 600),
  calories: str(t.calorias || t.calories, 40),
  minutes: str(t.duracao || t.minutes, 40),
  category: str(t.categoria || t.category, 60) || "Fitness",
  level: str(t.nivel || t.level, 40),
  imageUrl: httpsUrl(t.imageurl || t.image_url || t.imageUrl),
  exercises: list(jsonList(t.exercicios), exercise, 30).filter((e) => e.name),
});

export const names = (v, max = 30) => (Array.isArray(v) ? v.filter((n) => typeof n === "string").slice(0, max).map((n) => str(n, 60)) : []);

const isoDate = (v) => {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

// id: necessário para cancelar; o backend confere que o agendamento é do usuário
export const appointment = (a = {}) => ({
  id: /^\d{1,12}$/.test(String(a.id_agendamento ?? "")) ? String(a.id_agendamento) : null,
  date: isoDate(a.data_agendamento),
  start: str(a.hora_inicio, 5),
  end: str(a.hora_fim, 5),
  status: str(a.status || "pendente", 30).toLowerCase(),
  trainer: str(a.trainer_name, 120) || "Personal trainer",
  trainerPhoto: httpsUrl(a.trainer_avatar),
  rated: a.avaliado === true,
});

const limit = (l) => (l && typeof l === "object" ? { used: num(l.used), limit: l.limit == null ? null : num(l.limit) } : null);

export const planStatus = (p = {}) => ({
  plan: plan(p.plan),
  expiresAt: isoDate(p.plan_expires_at),
  limits: {
    treinos: limit(p.limits?.treinos),
    agendamentos: limit(p.limits?.agendamentos),
    comunidades: limit(p.limits?.comunidades),
    dietas: limit(p.limits?.dietas),
    desafios: limit(p.limits?.desafios),
  },
});

export const health = (h = {}) => {
  const d = h.data || h;
  return { steps: num(d.steps), calories: num(d.calories), sleepHours: num(d.sleep_hours), water: num(d.water_intake) };
};

export const stats = (s = {}) => {
  const d = s.data || s;
  return { posts: num(d.posts), followers: num(d.followers), following: num(d.following) };
};

export const list = (v, fn, max) => (Array.isArray(v) ? v.slice(0, max).map(fn) : []);
