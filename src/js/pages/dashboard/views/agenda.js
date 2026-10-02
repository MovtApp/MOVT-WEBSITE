/* MOVT web — Agenda: calendário do mês + sessões (próximas, histórico, canceladas)
 *
 * Ação disponível na web: cancelar uma sessão pendente/confirmada (com
 * confirmação). Agendar exige escolher personal e horário: fica no app.
 */
import { $ } from "../../../utils/dom.js";
import { act, api, invalidate } from "../store.js";
import { capFirst, confirmDialog, emptyState, errorState, esc, fmtDate, icon, kpi, sameDay, skeleton, startOfToday, tabs, toast } from "../ui.js";
import { APP_HREF, apptRow, isUpcoming, withDates } from "./shared.js";

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parseYmd = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(s || "") ? new Date(`${s}T00:00:00`) : null);
const WEEKDAYS = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];

export default {
  title: "Agenda",
  eyebrow: "Suas sessões com personal trainers",
  render(el, { params, signal, setParams }) {
    const alive = () => !signal.aborted;
    const today = startOfToday();
    const st = {
      tab: ["historico", "canceladas"].includes(params.get("aba")) ? params.get("aba") : "proximas",
      day: parseYmd(params.get("dia")),
      month: null,
    };
    st.month = new Date((st.day || today).getFullYear(), (st.day || today).getMonth(), 1);
    let all = [];

    el.innerHTML = `
      <div class="kpis" id="kpis">${skeleton(4, "sk-kpi")}</div>
      <div class="agenda-layout">
        <article class="panel rise" aria-label="Calendário">
          <div class="cal-head">
            <h2 id="cal-title"></h2>
            <div class="week-nav">
              <button aria-label="Mês anterior" data-month="-1">${icon("chevL")}</button>
              <button aria-label="Próximo mês" data-month="1">${icon("chevR")}</button>
            </div>
          </div>
          <div class="cal-grid" id="cal"></div>
          <div class="cal-legend"><span><i></i>Com sessão</span><span><i class="ring"></i>Hoje</span></div>
          <a class="btn btn-sm cal-cta" href="${APP_HREF}">${icon("calendar")}Agendar pelo app</a>
        </article>

        <article class="panel rise" style="--d:.06s">
          <div class="list-head">
            <div id="tabs"></div>
            <div id="day-filter"></div>
          </div>
          <ul class="appts" id="list"><li class="skeleton line"></li><li class="skeleton line"></li><li class="skeleton line"></li></ul>
        </article>
      </div>`;

    const listEl = $("#list", el);

    /* ---------- Separação por aba ---------- */
    const groups = () => {
      const upcoming = all.filter(isUpcoming).sort((a, b) => a._date - b._date || a.start.localeCompare(b.start));
      const cancelled = all.filter((a) => ["cancelado", "recusado"].includes(a.status)).sort((a, b) => b._date - a._date);
      const history = all.filter((a) => !isUpcoming(a) && !cancelled.includes(a)).sort((a, b) => b._date - a._date);
      return { proximas: upcoming, historico: history, canceladas: cancelled };
    };

    const renderKpis = () => {
      const g = groups();
      const thisMonth = all.filter((a) => a._date.getMonth() === today.getMonth() && a._date.getFullYear() === today.getFullYear() && a.status !== "cancelado");
      const next = g.proximas[0];
      $("#kpis", el).innerHTML = [
        kpi({ label: "Próximas sessões", value: g.proximas.length, hint: next ? `próxima: ${fmtDate(next._date, { day: "numeric", month: "short" })}${next.start ? ` às ${next.start}` : ""}` : "nenhuma marcada", ico: "calendar" }),
        kpi({ label: "Confirmadas", value: g.proximas.filter((a) => a.status === "confirmado").length, hint: "pelo personal", ico: "check", tone: "blue" }),
        kpi({ label: "Concluídas", value: all.filter((a) => a.status === "concluido").length, hint: "no total", ico: "star", tone: "purple" }),
        kpi({ label: "Neste mês", value: thisMonth.length, hint: capFirst(fmtDate(today, { month: "long" })), ico: "clock", tone: "orange" }),
      ].join("");
    };

    /* ---------- Calendário ---------- */
    const renderCal = () => {
      $("#cal-title", el).textContent = capFirst(fmtDate(st.month, { month: "long", year: "numeric" }));
      const withSession = new Set(all.filter((a) => a.status !== "cancelado").map((a) => ymd(a._date)));
      const first = new Date(st.month);
      const lead = (first.getDay() + 6) % 7; // semana começa na segunda
      const start = new Date(first.getFullYear(), first.getMonth(), 1 - lead);
      let html = WEEKDAYS.map((w) => `<span class="cal-wd">${w}</span>`).join("");
      for (let i = 0; i < 42; i++) {
        const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
        const cls = [
          "cal-day",
          d.getMonth() !== st.month.getMonth() && "out",
          sameDay(d, today) && "today",
          st.day && sameDay(d, st.day) && "selected",
          withSession.has(ymd(d)) && "has",
        ].filter(Boolean).join(" ");
        html += `<button class="${cls}" data-day="${ymd(d)}" aria-label="${esc(fmtDate(d, { weekday: "long", day: "numeric", month: "long" }))}${withSession.has(ymd(d)) ? ", com sessão" : ""}"${st.day && sameDay(d, st.day) ? ' aria-pressed="true"' : ""}>${d.getDate()}</button>`;
      }
      $("#cal", el).innerHTML = html;
    };

    $("#cal", el).addEventListener("click", (e) => {
      const b = e.target.closest("[data-day]");
      if (!b) return;
      const d = parseYmd(b.dataset.day);
      st.day = st.day && sameDay(st.day, d) ? null : d; // clicar de novo limpa
      if (st.day && st.day.getMonth() !== st.month.getMonth()) st.month = new Date(d.getFullYear(), d.getMonth(), 1);
      // O dia escolhido pode estar em qualquer aba: mostra a aba onde ele tem sessão
      if (st.day) {
        const g = groups();
        const hit = Object.keys(g).find((k) => g[k].some((a) => sameDay(a._date, st.day)));
        if (hit) st.tab = hit;
      }
      setParams({ dia: st.day ? ymd(st.day) : null, aba: st.tab === "proximas" ? null : st.tab });
      renderAll();
    }, { signal });

    el.querySelectorAll("[data-month]").forEach((b) =>
      b.addEventListener("click", () => {
        st.month = new Date(st.month.getFullYear(), st.month.getMonth() + Number(b.dataset.month), 1);
        renderCal();
      }, { signal })
    );

    /* ---------- Lista ---------- */
    const renderList = () => {
      const g = groups();
      $("#tabs", el).innerHTML = tabs([["proximas", "Próximas", g.proximas.length], ["historico", "Histórico", g.historico.length], ["canceladas", "Canceladas", g.canceladas.length]], st.tab, "aba");
      $("#day-filter", el).innerHTML = st.day
        ? `<button class="day-filter" data-clear-day>${icon("calendar")}${esc(fmtDate(st.day, { day: "numeric", month: "long" }))}${icon("x")}</button>`
        : "";

      let items = g[st.tab];
      if (st.day) items = items.filter((a) => sameDay(a._date, st.day));
      if (!items.length) {
        const msg = st.day
          ? { title: "Nenhuma sessão neste dia", text: "Escolha outro dia no calendário ou limpe o filtro." }
          : {
              proximas: { title: "Você não tem sessões marcadas", text: "Encontre um personal trainer e agende pelo app MOVT." },
              historico: { title: "Nenhuma sessão realizada ainda", text: "Suas sessões concluídas aparecem aqui." },
              canceladas: { title: "Nenhuma sessão cancelada", text: "" },
            }[st.tab];
        listEl.innerHTML = `<li>${emptyState({ ico: "calendar", ...msg, action: st.tab === "proximas" && !st.day ? `<a class="btn btn-sm" href="${APP_HREF}">Agendar pelo app</a>` : "" })}</li>`;
        return;
      }
      let lastMonth = "";
      listEl.innerHTML = items
        .map((a) => {
          const m = capFirst(fmtDate(a._date, { month: "long", year: "numeric" }));
          const head = m !== lastMonth ? `<li class="month-group">${esc(m)}</li>` : "";
          lastMonth = m;
          return head + apptRow(a, { actions: true });
        })
        .join("");
    };

    const renderAll = () => {
      renderCal();
      renderList();
    };

    $("#tabs", el).addEventListener("click", (e) => {
      const b = e.target.closest("[data-aba]");
      if (!b) return;
      st.tab = b.dataset.aba;
      setParams({ aba: st.tab === "proximas" ? null : st.tab });
      renderList();
    }, { signal });

    $("#day-filter", el).addEventListener("click", (e) => {
      if (!e.target.closest("[data-clear-day]")) return;
      st.day = null;
      setParams({ dia: null });
      renderAll();
    }, { signal });

    /* ---------- Cancelar ---------- */
    listEl.addEventListener("click", async (e) => {
      const b = e.target.closest("[data-cancel]");
      if (!b) return;
      const a = all.find((x) => x.id === b.dataset.cancel);
      if (!a) return;
      const ok = await confirmDialog({
        title: "Cancelar sessão?",
        text: `Sua sessão com ${a.trainer} em ${fmtDate(a._date, { weekday: "long", day: "numeric", month: "long" })}${a.start ? ` às ${a.start}` : ""} será cancelada e o personal será avisado.`,
        ok: "Cancelar sessão",
        danger: true,
      });
      if (!ok || !alive()) return;
      b.disabled = true;
      b.textContent = "Cancelando…";
      try {
        await act("/me/appointments/cancel", { id: a.id });
        toast("Sessão cancelada.");
        invalidate("appointments", "plan");
        await load({ force: true });
      } catch (err) {
        if (!alive()) return;
        toast(err.message || "Não foi possível cancelar agora.", { type: "error" });
        b.disabled = false;
        b.textContent = "Cancelar";
      }
    }, { signal });

    /* ---------- Carregamento ---------- */
    const load = (opts) =>
      api.appointments(opts).then((data) => {
        if (!alive()) return;
        all = withDates(data);
        renderKpis();
        renderAll();
      });

    const start = () =>
      load().catch(() => {
        if (!alive()) return;
        $("#kpis", el).innerHTML = "";
        listEl.innerHTML = `<li>${errorState("Não foi possível carregar sua agenda agora.")}</li>`;
        $("[data-retry]", listEl)?.addEventListener("click", () => {
          listEl.innerHTML = `<li class="skeleton line"></li>`;
          start();
        }, { signal });
      });

    renderCal();
    start();
  },
};
