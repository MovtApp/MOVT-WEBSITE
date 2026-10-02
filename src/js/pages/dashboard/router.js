/* MOVT web — roteador do painel (History API)
 *
 * /dashboard            → Início
 * /dashboard/treinos    → Treinos
 * /dashboard/agenda     → Agenda
 * /dashboard/plano      → Meu plano
 * /dashboard/comunidade → Comunidade
 *
 * Todas as URLs servem o mesmo dashboard.html (rewrite no vercel.json e no
 * vite.config.js); aqui só trocamos o conteúdo de #view. Cada tela recebe um
 * AbortSignal: ao sair dela, ouvintes e requisições pendentes são descartados.
 */
import { $, $$ } from "../../utils/dom.js";

const BASE = "/dashboard";
let views = {};
let current = null;
let hooks = {};

const parse = (href) => {
  const u = new URL(href, location.origin);
  const path = u.pathname.replace(/\/+$/, "").replace(/\.html$/, "");
  const name = path.startsWith(`${BASE}/`) ? path.slice(BASE.length + 1) : "";
  return { name, params: u.searchParams, url: u };
};

const urlFor = (name, params) => {
  const qs = params && String(new URLSearchParams(params));
  return `${BASE}${name ? `/${name}` : ""}${qs ? `?${qs}` : ""}`;
};

function render({ focus = true } = {}) {
  const { name, params } = parse(location.href);
  const view = views[name];
  if (!view) return navigate(BASE, { replace: true }); // rota desconhecida → Início

  current?.ctrl.abort();
  const ctrl = new AbortController();
  current = { name, ctrl };

  const el = $("#view");
  el.className = `view view-${name || "inicio"}`;
  el.innerHTML = "";
  void el.offsetWidth; // reinicia a animação de entrada
  el.classList.add("view-in");

  document.title = `${view.title} — MOVT APP`;
  $$(".side-nav a").forEach((a) => {
    const on = a.dataset.nav === (name || "inicio");
    a.classList.toggle("active", on);
    if (on) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  hooks.onChange?.({ name: name || "inicio", view });

  view.render(el, {
    params,
    signal: ctrl.signal,
    navigate,
    // Atualiza a query sem redesenhar a tela (filtros, abas)
    setParams: (next) => {
      const p = new URLSearchParams(params);
      for (const [k, v] of Object.entries(next)) v == null || v === "" ? p.delete(k) : p.set(k, v);
      history.replaceState(history.state, "", urlFor(name, p));
    },
  });

  if (focus) {
    scrollTo({ top: 0, behavior: "instant" });
    $("#top-title")?.focus({ preventScroll: true });
  }
}

export function navigate(href, { replace = false } = {}) {
  const next = new URL(href, location.origin);
  if (next.href === location.href && !replace) return;
  history[replace ? "replaceState" : "pushState"]({}, "", next.pathname + next.search);
  render();
}

export function startRouter(routeViews, routeHooks = {}) {
  views = routeViews;
  hooks = routeHooks;

  // Links internos do painel (sidebar, "Ver mais", ações) sem recarregar a página
  document.addEventListener("click", (e) => {
    const a = e.target.closest("a[href]");
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target === "_blank") return;
    const u = new URL(a.href, location.origin);
    if (u.origin !== location.origin || !(u.pathname === BASE || u.pathname.startsWith(`${BASE}/`))) return;
    e.preventDefault();
    navigate(u.pathname + u.search);
  });
  addEventListener("popstate", () => render());

  // /dashboard.html (acesso direto ao arquivo) → URL limpa
  if (location.pathname.endsWith(".html")) history.replaceState({}, "", urlFor(parse(location.href).name, parse(location.href).params));
  render({ focus: false });
}
