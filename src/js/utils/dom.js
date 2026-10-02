/* MOVT web — helpers de DOM e sanitização */
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

// Escapa texto para interpolação em templates HTML (innerHTML)
export const esc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Aceita só URLs http(s) para imagens vindas da API; qualquer outra coisa vira o fallback
export const safeUrl = (v, fallback = "") => {
  try {
    const u = new URL(String(v), location.origin);
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : fallback;
  } catch {
    return fallback;
  }
};
