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

const isoDateTime = (v) => {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};
const numOrNull = (v) => (v == null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));

/* ---------- Planos e cobrança ---------- */
// Mesmo critério do app (planScreen.tsx): metadata.plan_type ou o nome do produto
const plain = (v) => String(v || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export const planType = (p = {}) => {
  const t = plain(p.metadata?.plan_type);
  const name = plain(p.name); // "Família" → "familia"
  if (t === "family" || t === "familia" || name.includes("famil")) return "familia";
  if (t === "premium" || name.includes("premium")) return "premium";
  return "free";
};

export const catalogPlan = (p = {}) => ({
  priceId: /^price_[A-Za-z0-9]{1,100}$/.test(p.stripe_price_id || "") ? p.stripe_price_id : null,
  type: planType(p),
  name: str(p.name, 80),
  description: str(p.description, 300),
  price: num(p.price),
  currency: /^[a-z]{3}$/.test(p.currency || "") ? p.currency : "brl",
  interval: ["day", "week", "month", "year"].includes(p.interval) ? p.interval : null,
});

const CARD_BRANDS = new Set(["visa", "mastercard", "amex", "elo", "hipercard", "discover", "diners", "jcb", "unionpay"]);
// Cobrança: sem e-mail, CPF/CNPJ ou IDs da Stripe; do cartão só bandeira e final
export const billing = (b = {}) => ({
  hasSubscription: b.hasSubscription === true,
  status: str(b.status, 30),
  planName: str(b.planName, 80),
  amount: numOrNull(b.amount),
  currency: /^[a-z]{3}$/.test(b.currency || "") ? b.currency : "brl",
  nextBillingDate: isoDate(b.nextBillingDate),
  card: b.card && typeof b.card === "object"
    ? {
        brand: CARD_BRANDS.has(String(b.card.brand)) ? b.card.brand : "card",
        last4: /^\d{4}$/.test(String(b.card.last4)) ? String(b.card.last4) : null,
        expMonth: num(b.card.expMonth),
        expYear: num(b.card.expYear),
      }
    : null,
});

/* ---------- Comunidade ---------- */
export const profile = (p = {}) => {
  const d = p.data || p;
  return {
    name: str(d.name || d.nome, 120),
    username: str(d.username, 40),
    photo: httpsUrl(d.photo || d.avatar_url),
    banner: httpsUrl(d.banner || d.banner_url),
    bio: str(d.bio, 300),
    location: str(d.location, 80),
    jobTitle: str(d.job_title, 80),
  };
};

const postId = (v) => (/^\d{1,12}$/.test(String(v ?? "")) ? String(v) : null);

export const ownPost = (p = {}) => ({
  id: postId(p.id),
  image: httpsUrl(p.image_url),
  caption: str(p.legenda || p.caption, 600),
  likes: num(p.likes_count),
  comments: num(p.comments_count),
  createdAt: isoDateTime(p.created_at),
});

// Feed: só o que aparece no card; nada de IDs internos dos autores
export const feedPost = (p = {}) => ({
  id: postId(p.post_id),
  author: {
    name: str(p.author?.full_name, 120),
    username: str(p.author?.username, 40),
    photo: httpsUrl(p.author?.avatar_url),
    verified: p.author?.is_verified === true,
  },
  image: httpsUrl(p.media?.[0]?.media_url),
  caption: str(p.caption, 600),
  likes: num(p.like_count),
  comments: num(p.comment_count),
  liked: p.is_liked === true,
  createdAt: isoDateTime(p.created_at),
});

// Telefone de contato e demais campos internos não saem do servidor
export const community = (c = {}) => ({
  id: postId(c.id_comunidade),
  name: str(c.nome, 120),
  description: str(c.descricao, 500),
  image: httpsUrl(c.imageurl),
  participants: num(c.participantes),
  max: numOrNull(c.max_participantes),
  category: str(c.categoria, 60),
  type: str(c.tipo_comunidade, 40),
  eventDate: isoDate(c.data_evento),
  location: str(c.local_inicio, 120),
  isMember: c.is_member === true,
});

export const list = (v, fn, max) => (Array.isArray(v) ? v.slice(0, max).map(fn) : []);
