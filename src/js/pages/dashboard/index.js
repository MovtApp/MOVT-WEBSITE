/* MOVT web — painel do usuário (entrada)
 *
 * Valida a sessão, preenche o topo (usuário/plano), liga sidebar, menu e logout
 * e entrega o conteúdo ao roteador: cada item do sidebar é uma tela própria.
 */
import { getSession, logout } from "../../core/auth.js";
import { ROUTES } from "../../core/config.js";
import { session } from "../../core/session.js";
import { $, $$, esc, safeUrl } from "../../utils/dom.js";
import { startRouter } from "./router.js";
import { state } from "./state.js";
import { capFirst, initSheet, planLabel } from "./ui.js";
import agenda from "./views/agenda.js";
import comunidade from "./views/comunidade.js";
import inicio from "./views/inicio.js";
import plano from "./views/plano.js";
import treinos from "./views/treinos.js";

(async () => {
  if (!session.hinted) return; // public/scripts/auth-guard.js já redirecionou

  /* ---------- Topo: título da tela ---------- */
  const today = capFirst(new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" }));
  const firstName = () => (state.user?.name || "").trim().split(/\s+/)[0] || "atleta";
  const setTitle = ({ name, view }) => {
    const h = $("#top-title");
    if (name === "inicio") {
      $("#top-eyebrow").textContent = today;
      h.innerHTML = `Olá, <span class="grad" id="user-first">${esc(firstName())}</span> 👋`;
    } else {
      $("#top-eyebrow").textContent = view.eyebrow || "";
      h.textContent = view.title;
    }
  };

  /* ---------- Usuário ---------- */
  const renderPlanBadge = (plan) => {
    const b = $("#plan-badge");
    b.textContent = planLabel(plan);
    b.hidden = false;
  };
  state.onPlan = renderPlanBadge;

  const renderUser = (u) => {
    const name = (u?.name || "").trim();
    const first = $("#user-first");
    if (first) first.textContent = firstName();
    $("#um-name").textContent = name || "Usuário MOVT";
    $("#um-email").textContent = u?.email || "";
    const initials = name ? name.split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase() : "M";
    const av = $("#avatar-btn");
    if (u?.photo) {
      av.innerHTML = `<img src="${esc(safeUrl(u.photo))}" alt="" referrerpolicy="no-referrer" />`;
      av.querySelector("img").onerror = () => (av.innerHTML = `<span>${esc(initials)}</span>`);
    } else {
      av.innerHTML = `<span>${esc(initials)}</span>`;
    }
    renderPlanBadge(u?.plan);
    $("#verify-banner").hidden = u?.isVerified !== false;
  };

  /* ---------- Menu do usuário ---------- */
  const avatarBtn = $("#avatar-btn");
  const userMenu = $("#user-menu");
  const setMenu = (open) => {
    userMenu.hidden = !open;
    avatarBtn.setAttribute("aria-expanded", open);
  };
  avatarBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    setMenu(userMenu.hidden);
  });
  document.addEventListener("click", (e) => {
    if (!userMenu.hidden && (!userMenu.contains(e.target) || e.target.closest("a"))) setMenu(false);
  });

  /* ---------- Sidebar (gaveta no celular) ---------- */
  const side = $("#side");
  const scrim = $(".side-scrim");
  const burger = $(".top-burger");
  const setSide = (open) => {
    side.classList.toggle("open", open);
    scrim.hidden = !open;
    burger.setAttribute("aria-expanded", open);
  };
  burger.addEventListener("click", () => setSide(!side.classList.contains("open")));
  scrim.addEventListener("click", () => setSide(false));
  $$(".side-nav a").forEach((a) => a.addEventListener("click", () => setSide(false)));
  addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    setSide(false);
    setMenu(false);
  });

  $$("[data-logout]").forEach((b) => b.addEventListener("click", logout));
  initSheet();

  /* ---------- Sessão → telas ---------- */
  // Dados pessoais só em memória: nada fica salvo no navegador
  try {
    const resp = await getSession();
    if (!resp?.authenticated) return location.replace(ROUTES.auth);
    state.user = resp.user;
  } catch (err) {
    if (err?.status === 401) return location.replace(ROUTES.auth);
    state.user = null; // backend fora do ar: o painel abre com dados genéricos
  }
  renderUser(state.user);

  startRouter({ "": inicio, treinos, agenda, plano, comunidade }, { onChange: setTitle });
})();
