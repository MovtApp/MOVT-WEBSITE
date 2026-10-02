/* MOVT web — peças de domínio usadas por mais de uma tela */
import { esc, fmtDate, icon, localDate, openSheet, safeUrl, startOfToday, statusPill } from "../ui.js";

export const DEFAULT_IMG = "https://res.cloudinary.com/ditlmzgrh/image/upload/v1757229915/image_71_jntmsv.jpg";
export const DEFAULT_PLAN_IMG = "https://res.cloudinary.com/ditlmzgrh/image/upload/v1757513125/prancha_g1v30x.png";
export const APP_HREF = "/#download";

// Fallback idêntico ao da Home do app quando /treinos não retorna nada
export const EXERCISE_FALLBACK = [
  { id: "f1", title: "Agachamento", calories: "180 - 250 Kcal", minutes: "15 min", category: "Musculação", imageUrl: "https://res.cloudinary.com/ditlmzgrh/image/upload/v1757229915/image_71_jntmsv.jpg" },
  { id: "f2", title: "Supino", calories: "150 - 200 Kcal", minutes: "12 min", category: "Musculação", imageUrl: "https://res.cloudinary.com/ditlmzgrh/image/upload/v1757229915/image_txncpp.jpg" },
  { id: "f3", title: "Remada curvada", calories: "160 - 220 Kcal", minutes: "12 min", category: "Musculação", imageUrl: "https://res.cloudinary.com/ditlmzgrh/image/upload/v1757229918/image_75_drh4vh.jpg" },
  { id: "f4", title: "Levantamento Terra", calories: "160 - 220 Kcal", minutes: "15 min", category: "Musculação", imageUrl: "https://res.cloudinary.com/ditlmzgrh/image/upload/v1757229918/image111_gu6iim.jpg" },
  { id: "f5", title: "Puxada na Barra", calories: "140 - 200 Kcal", minutes: "12 min", category: "Musculação", imageUrl: "https://res.cloudinary.com/ditlmzgrh/image/upload/v1757229918/image_73_co9eqf.jpg" },
];

export const SPECIALTIES = [
  ["", "Todos"],
  ["musculacao", "Musculação"],
  ["funcional", "Funcional"],
  ["cardio", "Cardio"],
  ["yoga", "Yoga"],
];

// O backend manda a especialidade como slug ("musculacao"): mostra o nome bonito
const SPEC_LABEL = Object.fromEntries(SPECIALTIES.filter(([v]) => v));
export const specLabel = (v) => SPEC_LABEL[String(v || "").toLowerCase()] || v || "Fitness";

export const mapTraining = (t) => ({ ...t, category: specLabel(t.category), imageUrl: safeUrl(t.imageUrl || "") });

const meta = (t) => [t.minutes, t.calories, t.level].filter(Boolean);

// Card horizontal (treinos do dia)
export const planCard = (t, i) => `
  <button class="plan-card rise" style="--d:${i * 0.05}s" data-i="${i}">
    <img src="${esc(t.imageUrl || DEFAULT_PLAN_IMG)}" alt="" loading="lazy" />
    <div><p class="eyebrow">${esc(t.category)}</p><h4>${esc(t.title)}</h4><p>${esc(meta(t).join(" · "))}</p></div>
  </button>`;

// Card com foto (catálogo / populares)
export const exerciseCard = (t, i) => `
  <button class="ex rise" style="--d:${Math.min(i, 12) * 0.04}s" data-i="${i}" aria-label="${esc(t.title)}">
    <img src="${esc(t.imageUrl || DEFAULT_IMG)}" alt="" loading="lazy" />
    <span class="ex-play">${icon("play")}</span>
    ${t.level ? `<span class="ex-level">${esc(t.level)}</span>` : ""}
    <div class="ex-info"><p class="ex-cat">${esc(t.category)}</p><h4>${esc(t.title)}</h4><div class="ex-meta">${[t.minutes, t.calories]
      .filter(Boolean)
      .map((m) => `<span>${esc(m)}</span>`)
      .join("")}</div></div>
  </button>`;

export function trainingSheet(t) {
  const exercises = Array.isArray(t.exercises) ? t.exercises : [];
  openSheet({
    img: t.imageUrl || DEFAULT_IMG,
    cat: t.category || "Treino",
    title: t.title,
    meta: meta(t),
    desc: t.description && !/^\d+\s*min/.test(t.description) ? t.description : `Treino de ${t.title} focado em queima de calorias.`,
    extra: exercises.length
      ? `<h4 class="sheet-sub">Exercícios (${exercises.length})</h4><ol class="ex-list">${exercises
          .map((e) => `<li><b>${esc(e.name)}</b>${e.detail ? `<span>${esc(e.detail)}</span>` : ""}</li>`)
          .join("")}</ol>`
      : "",
    actions: [{ label: "Começar no app", href: APP_HREF }],
  });
}

// Liga cliques de uma lista de cards ao detalhe
export const bindTrainingCards = (root, list, signal) =>
  root.addEventListener(
    "click",
    (e) => {
      const b = e.target.closest("[data-i]");
      if (b && root.contains(b)) trainingSheet(list[Number(b.dataset.i)]);
    },
    { signal }
  );

/* ---------- Agendamentos ---------- */
export const withDates = (list) =>
  list
    .map((a) => ({ ...a, _date: localDate(a.date) }))
    .filter((a) => a._date && !isNaN(a._date));

export const isUpcoming = (a) => a._date >= startOfToday() && !["cancelado", "concluido", "recusado"].includes(a.status);

export const canCancel = (a) => isUpcoming(a) && ["pendente", "confirmado"].includes(a.status) && !!a.id;

export const apptRow = (a, { actions = false } = {}) => `
  <li class="appt">
    <div class="appt-date"><b>${a._date.getDate()}</b><small>${esc(fmtDate(a._date, { month: "short" }).replace(".", ""))}</small></div>
    ${a.trainerPhoto ? `<img class="appt-avatar" src="${esc(safeUrl(a.trainerPhoto))}" alt="" loading="lazy" referrerpolicy="no-referrer" />` : ""}
    <div class="appt-info">
      <h4>${esc(a.trainer)}</h4>
      <p>${icon("clock")}${esc([a.start, a.end].filter(Boolean).join(" – ") || "Horário a confirmar")} · ${esc(fmtDate(a._date, { weekday: "long" }))}</p>
    </div>
    ${statusPill(a.status)}
    ${actions && canCancel(a) ? `<button class="btn-link danger" data-cancel="${esc(a.id)}">Cancelar</button>` : ""}
  </li>`;
