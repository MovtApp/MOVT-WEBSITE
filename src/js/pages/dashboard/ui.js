/* MOVT web — componentes compartilhados das telas do painel
 *
 * Tudo que vem da API é escapado com esc() antes de entrar em innerHTML.
 */
import { $, esc, safeUrl } from "../../utils/dom.js";

export { esc, safeUrl };

/* ---------- Ícones (traço, herdam a cor do texto) ---------- */
const P = {
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  dumbbell: '<path d="M6.5 6.5v11M17.5 6.5v11M3 9.5v5M21 9.5v5M6.5 12h11"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
  star: '<path d="M12 2l2.9 6.9 7.1.6-5.4 4.7 1.6 7L12 17.5 5.8 21.2l1.6-7L2 9.5l7.1-.6z"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14.2A6.5 6.5 0 0 1 21.5 20"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  flame: '<path d="M12 2c1 4 5 5.5 5 11a5 5 0 0 1-10 0c0-2.5 1.2-4 2.5-5 0 2 1 3 2 3 0-3-1-6 .5-9z"/>',
  steps: '<path d="M7 20c-2 0-3-1.5-3-3.5S5.5 12 7 12s2 1.5 2 3.5S9 20 7 20zM17 13c-2 0-3-1.5-3-3.5S15.5 5 17 5s2 1.5 2 3.5S19 13 17 13z"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>',
  drop: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/>',
  comment: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  card: '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19M6 15h4"/>',
  pin: '<path d="M12 21s7-6.3 7-11.5A7 7 0 0 0 5 9.5C5 14.7 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  alert: '<path d="M12 3l9.5 17h-19z"/><path d="M12 10v4M12 17.5v.01"/>',
  phone: '<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
  bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  chevL: '<path d="M15 6l-6 6 6 6"/>',
  chevR: '<path d="M9 6l6 6-6 6"/>',
  play: '<path d="M7 4.5l12 7.5-12 7.5z"/>',
  verified: '<path d="M12 2.5l2.4 1.8 3-.2.9 2.9 2.4 1.8-1 2.8 1 2.8-2.4 1.8-.9 2.9-3-.2L12 21.5l-2.4-1.8-3 .2-.9-2.9-2.4-1.8 1-2.8-1-2.8 2.4-1.8.9-2.9 3 .2z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
};
export const icon = (name, cls = "") => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[name] || ""}</svg>`;

/* ---------- Formatação ---------- */
export const PLAN_LABEL = { free: "Free", premium: "Premium", familia: "Família" };
export const planLabel = (p) => PLAN_LABEL[p] || "Free";
export const fmtInt = (n) => (Number(n) || 0).toLocaleString("pt-BR");
export const fmtMoney = (v, currency = "brl") =>
  (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: String(currency || "brl").toUpperCase() });
// "AAAA-MM-DD" → Date no fuso local (sem "voltar" um dia)
export const localDate = (iso) => (iso ? new Date(`${String(iso).slice(0, 10)}T00:00:00`) : null);
export const fmtDate = (d, opts = { day: "numeric", month: "long" }) => (d && !isNaN(d) ? d.toLocaleDateString("pt-BR", opts) : "");
export const capFirst = (s) => (s ? s[0].toUpperCase() + s.slice(1) : "");
export const sameDay =(a, b) => a && b && a.toDateString() === b.toDateString();
export const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};
export const normalize = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
export const timeAgo = (iso) => {
  const t = new Date(iso).getTime();
  if (!t) return "";
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return "agora";
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  if (s < 86400) return `${Math.floor(s / 3600)} h`;
  if (s < 604800) return `${Math.floor(s / 86400)} d`;
  return fmtDate(new Date(t), { day: "numeric", month: "short" });
};

/* ---------- Blocos de layout ---------- */
// Cabeçalho de seção com link "Ver mais" para a tela completa
export const sectionHead = (title, more, extra = "") => `
  <div class="sec-head">
    <h2 class="sec-title">${esc(title)}</h2>
    <div class="sec-actions">${extra}${more ? seeMore(more.href, more.label) : ""}</div>
  </div>`;

export const seeMore = (href, label = "Ver mais") =>
  `<a class="see-more" href="${esc(href)}" data-link>${esc(label)}${icon("arrow")}</a>`;

export const skeleton = (n = 3, cls = "") => `<div class="skeleton ${cls}"></div>`.repeat(n);

export const emptyState = ({ ico = "alert", title, text = "", action = "" }) => `
  <div class="state">
    <span class="state-ico">${icon(ico)}</span>
    <h3>${esc(title)}</h3>
    ${text ? `<p>${esc(text)}</p>` : ""}
    ${action}
  </div>`;

// Erro com "Tentar de novo": quem chama liga o botão [data-retry]
export const errorState = (msg = "Não foi possível carregar agora.") =>
  emptyState({ ico: "alert", title: msg, text: "Verifique sua conexão e tente novamente.", action: `<button class="btn btn-sm btn-ghost" data-retry>Tentar de novo</button>` });

export const kpi = ({ label, value, hint = "", ico = "bolt", tone = "lime" }) => `
  <div class="kpi kpi-${tone}">
    <span class="kpi-ico">${icon(ico)}</span>
    <p>${esc(label)}</p>
    <b>${value}</b>
    ${hint ? `<small>${esc(hint)}</small>` : ""}
  </div>`;

export const tabs = (items, active, name = "tab") => `
  <div class="tabs" role="tablist">
    ${items.map(([id, label, count]) => `<button class="tab${id === active ? " active" : ""}" role="tab" aria-selected="${id === active}" data-${name}="${esc(id)}">${esc(label)}${count != null ? `<span class="tab-count">${esc(count)}</span>` : ""}</button>`).join("")}
  </div>`;

export const statusPill = (status) => {
  const st = String(status || "pendente").toLowerCase();
  return `<span class="status ${esc(normalize(st))}">${esc(st)}</span>`;
};

// Conta de 0 até o valor (respeita quem prefere menos movimento)
export const countTo = (el, target) => {
  if (!el) return;
  const n = Number(target) || 0;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return (el.textContent = fmtInt(n));
  const t0 = performance.now();
  const step = (now) => {
    const p = Math.min((now - t0) / 900, 1);
    el.textContent = fmtInt(Math.round(n * (1 - Math.pow(1 - p, 3))));
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
};

/* ---------- Toasts ---------- */
export function toast(message, { type = "ok", action } = {}) {
  const box = $("#toasts");
  const el = document.createElement("div");
  el.className = `toast toast-${type}`;
  el.innerHTML = `${icon(type === "error" ? "alert" : "check")}<span>${esc(message)}</span>${
    action ? `<a href="${esc(action.href)}" data-link>${esc(action.label)}</a>` : ""
  }`;
  box.append(el);
  const close = () => {
    el.classList.add("out");
    setTimeout(() => el.remove(), 300);
  };
  el.addEventListener("click", close);
  setTimeout(close, type === "error" ? 6000 : 4000);
}

/* ---------- Confirmação ---------- */
export function confirmDialog({ title, text, ok = "Confirmar", danger = false }) {
  const d = $("#confirm");
  $("#confirm-title").textContent = title;
  $("#confirm-text").textContent = text;
  const okBtn = $("#confirm-ok");
  okBtn.textContent = ok;
  okBtn.classList.toggle("btn-danger", danger);
  return new Promise((resolve) => {
    const done = (v) => {
      d.removeEventListener("click", onClick);
      d.removeEventListener("cancel", onCancel);
      d.close();
      resolve(v);
    };
    const onClick = (e) => {
      const b = e.target.closest("[data-confirm]");
      if (b) done(b.dataset.confirm === "yes");
      else if (e.target === d) done(false);
    };
    const onCancel = (e) => {
      e.preventDefault();
      done(false);
    };
    d.addEventListener("click", onClick);
    d.addEventListener("cancel", onCancel);
    d.showModal();
    okBtn.focus();
  });
}

/* ---------- Painel de detalhe ---------- */
const sheet = () => $("#sheet");
export function openSheet({ img = "", cat = "", title, meta = [], desc = "", extra = "", actions = [] }) {
  const s = sheet();
  const im = $("#sheet-img");
  im.parentElement.hidden = !img;
  if (img) im.src = img;
  $("#sheet-cat").textContent = cat;
  $("#sheet-title").textContent = title;
  $("#sheet-meta").innerHTML = meta.filter(Boolean).map((m) => `<span>${esc(m)}</span>`).join("");
  $("#sheet-desc").textContent = desc;
  $("#sheet-extra").innerHTML = extra;
  const box = $("#sheet-actions");
  box.innerHTML = "";
  for (const a of [...actions, { label: "Fechar", ghost: true, close: true }]) {
    const el = document.createElement(a.href ? "a" : "button");
    el.className = `btn${a.ghost ? " btn-ghost" : ""}`;
    el.textContent = a.label;
    if (a.href) {
      el.href = a.href;
      if (a.href.startsWith("/dashboard")) el.dataset.link = "";
    }
    el.addEventListener("click", (e) => {
      if (a.onClick) a.onClick(e, el);
      if (a.close || a.href) s.close();
    });
    box.append(el);
  }
  s.showModal();
}
export const closeSheet = () => sheet().open && sheet().close();

export function initSheet() {
  const s = sheet();
  s.addEventListener("click", (e) => e.target === s && s.close());
}
