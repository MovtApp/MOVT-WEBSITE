/* MOVT web — Treinos: catálogo completo e treinos do dia, com busca e filtros
 *
 * Filtros ficam na URL (?aba=catalogo&tipo=yoga&nivel=Iniciante&q=agacha):
 * dá para compartilhar o link ou voltar e encontrar a lista como estava.
 */
import { $, $$ } from "../../../utils/dom.js";
import { api } from "../store.js";
import { emptyState, errorState, esc, icon, kpi, normalize, skeleton, tabs } from "../ui.js";
import { APP_HREF, EXERCISE_FALLBACK, exerciseCard, mapTraining, SPECIALTIES, trainingSheet } from "./shared.js";

const minutesOf = (t) => Number(String(t.minutes || "").match(/\d+/)?.[0]) || 0;

export default {
  title: "Treinos",
  eyebrow: "Catálogo MOVT e treinos montados para você",
  render(el, { params, signal, setParams }) {
    const alive = () => !signal.aborted;
    const st = {
      tab: params.get("aba") === "hoje" ? "hoje" : "catalogo",
      spec: SPECIALTIES.some(([v]) => v && v === params.get("tipo")) ? params.get("tipo") : "",
      level: params.get("nivel") || "",
      q: (params.get("q") || "").slice(0, 60),
    };

    el.innerHTML = `
      <div class="kpis" id="kpis">${skeleton(4, "sk-kpi")}</div>
      <div class="sec-head">
        <div id="tabs"></div>
        <a class="see-more" href="${APP_HREF}">${icon("phone")}Treinar pelo app</a>
      </div>
      <div class="toolbar" id="toolbar">
        <label class="search">${icon("search")}<input type="search" id="q" placeholder="Buscar treino, ex.: agachamento" value="${esc(st.q)}" aria-label="Buscar treino" maxlength="60" /></label>
        <select class="select" id="level" aria-label="Filtrar por nível"><option value="">Todos os níveis</option></select>
        <div class="chips" id="chips">${SPECIALTIES.map(([v, l]) => `<button class="chip${v === st.spec ? " active" : ""}" data-spec="${v}">${l}</button>`).join("")}</div>
        <span class="result-count" id="count" aria-live="polite"></span>
      </div>
      <div class="cards" id="list">${skeleton(8, "sk-card")}</div>`;

    const list = $("#list", el);
    let catalog = [];
    let daily = [];
    let shown = [];

    const renderTabs = () => {
      $("#tabs", el).innerHTML = tabs([["catalogo", "Catálogo", catalog.length || null], ["hoje", "Para hoje", daily.length || null]], st.tab, "aba");
      $("#toolbar", el).hidden = st.tab !== "catalogo";
    };

    const filtered = () => {
      const q = normalize(st.q);
      return catalog.filter(
        (t) =>
          (!st.level || normalize(t.level) === normalize(st.level)) &&
          (!q || normalize(`${t.title} ${t.category} ${t.description}`).includes(q))
      );
    };

    const renderList = () => {
      shown = st.tab === "hoje" ? daily : filtered();
      $("#count", el).textContent = st.tab === "catalogo" ? `${shown.length} ${shown.length === 1 ? "treino" : "treinos"}` : "";
      if (!shown.length) {
        list.innerHTML =
          st.tab === "hoje"
            ? emptyState({ ico: "dumbbell", title: "Nenhum treino para hoje", text: "Seu personal pode montar um plano para você pelo app. Enquanto isso, explore o catálogo.", action: `<button class="btn btn-sm" data-goto="catalogo">Ver catálogo</button>` })
            : emptyState({ ico: "search", title: "Nenhum treino encontrado", text: "Tente outra palavra ou limpe os filtros.", action: `<button class="btn btn-sm btn-ghost" data-clear>Limpar filtros</button>` });
        return;
      }
      list.innerHTML = shown.map(exerciseCard).join("");
    };

    // Um ouvinte só: a lista é redesenhada a cada filtro
    list.addEventListener("click", (e) => {
      const card = e.target.closest("[data-i]");
      if (card) return trainingSheet(shown[Number(card.dataset.i)]);
      if (e.target.closest("[data-clear]")) {
        st.q = "";
        st.level = "";
        $("#q", el).value = "";
        $("#level", el).value = "";
        setParams({ q: null, nivel: null });
        renderList();
      }
      if (e.target.closest("[data-goto]")) selectTab("catalogo");
    }, { signal });

    const renderKpis = (plan) => {
      const avg = catalog.length ? Math.round(catalog.reduce((s, t) => s + minutesOf(t), 0) / catalog.length) : 0;
      const week = plan?.limits?.treinos;
      $("#kpis", el).innerHTML = [
        kpi({ label: "No catálogo", value: catalog.length, hint: "treinos disponíveis", ico: "dumbbell" }),
        kpi({ label: "Para hoje", value: daily.length, hint: daily.length ? "montados para você" : "nenhum por enquanto", ico: "calendar", tone: "blue" }),
        kpi({
          label: "Treinos na semana",
          value: week ? `${week.used}${week.limit ? `<small class="of"> / ${week.limit}</small>` : ""}` : "—",
          hint: week ? (week.limit ? "limite do plano Free" : "ilimitado no seu plano") : "",
          ico: "bolt",
          tone: "orange",
        }),
        kpi({ label: "Duração média", value: avg ? `${avg} min` : "—", hint: "por treino", ico: "clock", tone: "purple" }),
      ].join("");
    };

    const selectTab = (tab) => {
      st.tab = tab;
      setParams({ aba: tab === "catalogo" ? null : tab });
      renderTabs();
      renderList();
    };
    $("#tabs", el).addEventListener("click", (e) => {
      const b = e.target.closest("[data-aba]");
      if (b) selectTab(b.dataset.aba);
    }, { signal });

    let t0;
    $("#q", el).addEventListener("input", (e) => {
      clearTimeout(t0);
      t0 = setTimeout(() => {
        st.q = e.target.value.trim().slice(0, 60);
        setParams({ q: st.q });
        renderList();
      }, 180);
    }, { signal });

    $("#level", el).addEventListener("change", (e) => {
      st.level = e.target.value;
      setParams({ nivel: st.level });
      renderList();
    }, { signal });

    const loadCatalog = () => {
      list.innerHTML = skeleton(8, "sk-card");
      return api.trainings({ specialty: st.spec }).then((data) => {
        if (!alive()) return;
        catalog = data.map(mapTraining);
        if (!catalog.length && !st.spec) catalog = EXERCISE_FALLBACK;
      });
    };

    $("#chips", el).addEventListener("click", (e) => {
      const c = e.target.closest(".chip");
      if (!c) return;
      st.spec = c.dataset.spec;
      $$("#chips .chip", el).forEach((x) => x.classList.toggle("active", x === c));
      setParams({ tipo: st.spec });
      loadCatalog().then(() => alive() && (renderTabs(), renderList())).catch(fail);
    }, { signal });

    const fail = () => {
      if (!alive()) return;
      list.innerHTML = errorState("Não foi possível carregar os treinos agora.");
      $("[data-retry]", list)?.addEventListener("click", start, { signal });
    };

    function start() {
      Promise.all([
        loadCatalog(),
        api.trainings({ daily: true }).then((d) => (daily = d.map(mapTraining))).catch(() => (daily = [])),
      ])
        .then(() => {
          if (!alive()) return;
          renderTabs();
          renderList();
          api.plan().then((p) => alive() && renderKpis(p)).catch(() => alive() && renderKpis(null));
        })
        .catch(fail);
    }

    // Níveis vêm do backend (mesma lista do app)
    api.trainingFilters().then(({ levels = [] }) => {
      if (!alive()) return;
      const sel = $("#level", el);
      sel.insertAdjacentHTML("beforeend", levels.map((l) => `<option value="${esc(l)}"${normalize(l) === normalize(st.level) ? " selected" : ""}>${esc(l)}</option>`).join(""));
    }).catch(() => {});

    renderTabs();
    start();
  },
};
