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

export const training = (t = {}) => ({
  id: str(t.id_treino ?? t.id, 64),
  title: str(t.nome || t.title, 120) || "Treino",
  description: str(t.descricao || t.description, 600),
  calories: str(t.calorias || t.calories, 40),
  minutes: str(t.duracao || t.minutes, 40),
  category: str(t.categoria || t.category, 60) || "Fitness",
  imageUrl: httpsUrl(t.imageurl || t.image_url || t.imageUrl),
});

const isoDate = (v) => {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

export const appointment = (a = {}) => ({
  date: isoDate(a.data_agendamento),
  start: str(a.hora_inicio, 5),
  status: str(a.status || "pendente", 30).toLowerCase(),
  trainer: str(a.trainer_name, 120) || "Personal trainer",
});

const limit = (l) => (l && typeof l === "object" ? { used: num(l.used), limit: l.limit == null ? null : num(l.limit) } : null);

export const planStatus = (p = {}) => ({
  plan: plan(p.plan),
  limits: {
    agendamentos: limit(p.limits?.agendamentos),
    comunidades: limit(p.limits?.comunidades),
    dietas: limit(p.limits?.dietas),
  },
});

export const stats = (s = {}) => {
  const d = s.data || s;
  return { posts: num(d.posts), followers: num(d.followers), following: num(d.following) };
};

export const list = (v, fn, max) => (Array.isArray(v) ? v.slice(0, max).map(fn) : []);
