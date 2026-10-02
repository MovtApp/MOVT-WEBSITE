/* MOVT web — Início: visão geral com atalho "Ver mais" para cada tela */
import { $, $$ } from "../../../utils/dom.js";
import { state } from "../state.js";
import { api } from "../store.js";
import { capFirst, countTo, emptyState, esc, fmtInt, icon, planLabel, sectionHead, seeMore, skeleton, startOfToday } from "../ui.js";
import { apptRow, bindTrainingCards, EXERCISE_FALLBACK, exerciseCard, isUpcoming, mapTraining, planCard, SPECIALTIES, trainingSheet, withDates } from "./shared.js";

const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

const metric = (key, label, unit, tone, ico) => `
  <div class="metric m-${tone}">
    <i>${icon(ico)}</i>
    <p>${label}</p><b data-metric="${key}">—</b><small>${unit}</small>
  </div>`;

function template() {
  return `
  <section class="grid">
    <article class="panel span-8 rise">
      <div class="panel-head">
        <h2 id="month-label">Semana</h2>
        <div class="sec-actions">
          <div class="week-nav">
            <button aria-label="Semana anterior" data-week="-1">${icon("chevL")}</button>
            <button aria-label="Próxima semana" data-week="1">${icon("chevR")}</button>
          </div>
          ${seeMore("/dashboard/agenda", "Ver agenda")}
        </div>
      </div>
      <div class="week" id="week"></div>

      <h3 class="sub-head">Resumo diário</h3>
      <div class="metrics">
        ${metric("calories", "Calorias", "kcal", "orange", "flame")}
        ${metric("steps", "Passos", "hoje", "blue", "steps")}
        ${metric("sleep", "Sono", "horas", "purple", "moon")}
        ${metric("water", "Água", "litros", "red", "drop")}
      </div>
      <p class="hint">Métricas de saúde vêm do seu smartwatch (Apple Health / Google Fit) e são sincronizadas pelo app MOVT.</p>
    </article>

    <article class="panel span-4 rise" style="--d:.08s">
      <div class="panel-head">
        <h2>Performance</h2>
        <span class="tag">Exemplo</span>
      </div>
      <div class="radar-wrap"><svg class="radar" id="radar" viewBox="0 0 240 240" role="img" aria-label="Gráfico de performance"></svg></div>
      <p class="hint">O radar é preenchido com os dados do seu smartwatch quando você sincroniza pelo app.</p>
    </article>
  </section>

  <section class="block rise">
    ${sectionHead("Treinos do dia", { href: "/dashboard/treinos?aba=hoje", label: "Ver todos" })}
    <div class="daily" id="daily">${skeleton(3)}</div>
  </section>

  <section class="block rise">
    ${sectionHead(
      "Exercícios populares",
      { href: "/dashboard/treinos?aba=catalogo", label: "Ver catálogo" },
      `<div class="chips" id="chips">${SPECIALTIES.map(([v, l]) => `<button class="chip${v ? "" : " active"}" data-spec="${v}">${l}</button>`).join("")}</div>`
    )}
    <div class="hscroll" id="popular"></div>
  </section>

  <section class="grid">
    <article class="panel span-6 rise">
      ${sectionHead("Próximos agendamentos", { href: "/dashboard/agenda", label: "Ver agenda" })}
      <ul class="appts" id="appts"><li class="skeleton line"></li><li class="skeleton line"></li></ul>
    </article>

    <article class="panel span-3 rise" style="--d:.06s">
      ${sectionHead("Meu plano", { href: "/dashboard/plano", label: "Ver plano" })}
      <div class="plan" id="plan">
        <p class="plan-name grad" id="plan-name">—</p>
        <div class="limits" id="limits"></div>
        <a href="/dashboard/plano" data-link class="btn btn-sm plan-cta" id="plan-cta" hidden>Seja Premium</a>
      </div>
    </article>

    <article class="panel span-3 rise" style="--d:.12s">
      ${sectionHead("Comunidade", { href: "/dashboard/comunidade", label: "Ver mais" })}
      <div class="social">
        <div><b data-stat="posts">—</b><span>Posts</span></div>
        <div><b data-stat="followers">—</b><span>Seguidores</span></div>
        <div><b data-stat="following">—</b><span>Seguindo</span></div>
      </div>
      <div class="hive mini" aria-hidden="true">
        <div class="hive-row">
          <img src="/img/avatars/avatar-01.jpg" alt="" />
          <img src="/img/avatars/avatar-02.jpg" alt="" />
          <span class="hive-you">Você</span>
          <img src="/img/avatars/avatar-03.jpg" alt="" />
          <img src="/img/avatars/avatar-04.jpg" alt="" />
        </div>
      </div>
    </article>
  </section>`;
}

/* ---------- Radar (mesmos eixos do MiniRadarChart do app) ---------- */
function renderRadar(svgEl, values) {
  const labels = ["Força", "Cardio", "Mobilidade", "Resistência", "Sono", "Nutrição"];
  const cx = 120, cy = 120, R = 82, n = labels.length;
  const pt = (i, r) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  };
  let svg = "";
  for (const f of [0.25, 0.5, 0.75, 1]) svg += `<polygon class="ring" points="${labels.map((_, i) => pt(i, R * f).join(",")).join(" ")}"/>`;
  labels.forEach((l, i) => {
    const [x, y] = pt(i, R);
    const [tx, ty] = pt(i, R + 18);
    svg += `<line class="axis" x1="${cx}" y1="${cy}" x2="${x}" y2="${y}"/><text x="${tx}" y="${ty + 3}" text-anchor="middle">${l}</text>`;
  });
  const poly = values.map((v, i) => pt(i, R * v));
  svg += `<polygon class="area" points="${poly.map((p) => p.join(",")).join(" ")}"/>`;
  svg += poly.map(([x, y]) => `<circle class="pt" cx="${x}" cy="${y}" r="3"/>`).join("");
  svgEl.innerHTML = svg;
}

export default {
  title: "Início",
  render(el, { signal }) {
    el.innerHTML = template();
    const alive = () => !signal.aborted;

    /* ---------- Semana ---------- */
    const today = startOfToday();
    let weekOffset = 0;
    let selected = new Date(today);
    let apptDays = new Set();
    const renderWeek = () => {
      const start = new Date(today);
      start.setDate(today.getDate() - 3 + weekOffset * 7);
      const days = Array.from({ length: 7 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
      $("#month-label", el).textContent = capFirst(days[3].toLocaleDateString("pt-BR", { month: "long", year: "numeric" }));
      $("#week", el).innerHTML = days
        .map((d) => {
          const cls = ["day", dayKey(d) === dayKey(today) && "today", dayKey(d) === dayKey(selected) && "selected", apptDays.has(dayKey(d)) && "has-appt"]
            .filter(Boolean)
            .join(" ");
          const wd = d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
          return `<button class="${cls}" data-key="${d.toISOString()}" aria-label="${esc(d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" }))}"><small>${wd}</small><b>${d.getDate()}</b><span class="dot"></span></button>`;
        })
        .join("");
    };
    $("#week", el).addEventListener("click", (e) => {
      const b = e.target.closest(".day");
      if (!b) return;
      selected = new Date(b.dataset.key);
      renderWeek();
    }, { signal });
    $$("[data-week]", el).forEach((b) =>
      b.addEventListener("click", () => {
        weekOffset += Number(b.dataset.week);
        renderWeek();
      }, { signal })
    );
    renderWeek();
    renderRadar($("#radar", el), [0.72, 0.58, 0.45, 0.66, 0.8, 0.52]);

    /* ---------- Resumo diário ---------- */
    api.health().then((h) => {
      if (!alive()) return;
      const set = (k, v) => ($(`[data-metric="${k}"]`, el).textContent = v);
      set("calories", fmtInt(h.calories));
      set("steps", fmtInt(h.steps));
      set("sleep", (Number(h.sleepHours) || 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 }));
      set("water", ((Number(h.water) || 0) / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 }));
    }).catch(() => {});

    /* ---------- Treinos do dia ---------- */
    const daily = $("#daily", el);
    api.trainings({ daily: true }).then((data) => {
      if (!alive()) return;
      const list = data.map(mapTraining).slice(0, 6);
      if (!list.length) {
        daily.innerHTML = emptyState({ ico: "dumbbell", title: "Nenhum treino do dia por enquanto", text: "Seu personal pode montar um plano para você no app." });
        return;
      }
      daily.innerHTML = list.map(planCard).join("");
      bindTrainingCards(daily, list, signal);
    }).catch(() => {
      if (alive()) daily.innerHTML = emptyState({ ico: "dumbbell", title: "Não foi possível carregar os treinos do dia agora." });
    });

    /* ---------- Populares ---------- */
    const popular = $("#popular", el);
    let popularList = [];
    const loadPopular = (specialty) => {
      popular.innerHTML = skeleton(4, "sk-card");
      const more = $(".sec-head .see-more", popular.parentElement);
      more.href = `/dashboard/treinos?aba=catalogo${specialty ? `&tipo=${specialty}` : ""}`;
      api.trainings({ specialty }).then((data) => {
        if (!alive()) return;
        const list = data.map(mapTraining);
        popularList = list.length ? list.slice(0, 10) : EXERCISE_FALLBACK;
        popular.innerHTML = popularList.map(exerciseCard).join("");
      }).catch(() => {
        if (!alive()) return;
        popularList = EXERCISE_FALLBACK;
        popular.innerHTML = popularList.map(exerciseCard).join("");
      });
    };
    // Os cards são recriados a cada filtro: o clique é resolvido na hora
    popular.addEventListener("click", (e) => {
      const b = e.target.closest("[data-i]");
      if (b) trainingSheet(popularList[Number(b.dataset.i)]);
    }, { signal });
    $("#chips", el).addEventListener("click", (e) => {
      const c = e.target.closest(".chip");
      if (!c) return;
      $$("#chips .chip", el).forEach((x) => x.classList.toggle("active", x === c));
      loadPopular(c.dataset.spec);
    }, { signal });
    loadPopular("");

    /* ---------- Agendamentos ---------- */
    const appts = $("#appts", el);
    api.appointments().then((data) => {
      if (!alive()) return;
      const list = withDates(data).filter((a) => a.status !== "cancelado");
      apptDays = new Set(list.map((a) => dayKey(a._date)));
      renderWeek();
      const upcoming = list.filter(isUpcoming).sort((a, b) => a._date - b._date).slice(0, 4);
      appts.innerHTML = upcoming.length
        ? upcoming.map((a) => apptRow(a)).join("")
        : `<li>${emptyState({ ico: "calendar", title: "Você não tem sessões agendadas", text: "Encontre um personal trainer pelo app." })}</li>`;
    }).catch(() => {
      if (alive()) appts.innerHTML = `<li>${emptyState({ ico: "calendar", title: "Não foi possível carregar seus agendamentos agora." })}</li>`;
    });

    /* ---------- Plano ---------- */
    const renderPlan = (plan, limits) => {
      $("#plan-name", el).textContent = planLabel(plan);
      $("#plan-cta", el).hidden = plan === "premium" || plan === "familia";
      const rows = [["Treinos na semana", limits?.treinos], ["Agendamentos", limits?.agendamentos], ["Comunidades", limits?.comunidades]].filter(([, l]) => l);
      $("#limits", el).innerHTML = rows
        .map(([label, { used = 0, limit }]) => {
          const pct = limit ? Math.min(100, (used / limit) * 100) : 100;
          return `<div class="limit"><p>${label}<b>${esc(used)}${limit ? ` / ${esc(limit)}` : " · ilimitado"}</b></p><div class="bar"><i data-w="${Number(pct) || 0}"></i></div></div>`;
        })
        .join("");
      requestAnimationFrame(() => $$("#limits .bar i", el).forEach((i) => (i.style.width = `${i.dataset.w}%`)));
    };
    api.plan().then((p) => {
      if (!alive()) return;
      renderPlan(p.plan, p.limits);
      state.onPlan(p.plan);
    }).catch(() => alive() && renderPlan(state.user?.plan || "free", null));

    /* ---------- Comunidade ---------- */
    api.stats().then((s) => {
      if (!alive()) return;
      ["posts", "followers", "following"].forEach((k) => countTo($(`[data-stat="${k}"]`, el), s?.[k]));
    }).catch(() => {});
  },
};
