/* MOVT web — Meu plano: assinatura atual, uso dos limites e comparação de planos
 *
 * Assinar abre o checkout da Stripe (URL validada pelo BFF); trocar ou
 * cancelar acontece no portal de assinatura da Stripe.
 */
import { $, $$ } from "../../../utils/dom.js";
import { state } from "../state.js";
import { act, api, invalidate } from "../store.js";
import { capFirst, errorState, esc, fmtDate, fmtMoney, icon, localDate, planLabel, sectionHead, skeleton, toast } from "../ui.js";

// Mesmos benefícios mostrados no app (planScreen.tsx)
const FEATURES = {
  free: [
    ["2 treinos por semana", true],
    ["2 agendamentos e 2 comunidades por mês", true],
    ["Perfil e acompanhamento básico", true],
    ["Planos de dieta limitados", false],
    ["Conteúdos exclusivos", false],
  ],
  premium: [
    ["Treinos ilimitados", true],
    ["Agendamentos e comunidades ilimitados", true],
    ["Até 8 dietas e desafios por mês", true],
    ["Conteúdos e rotinas exclusivas", true],
    ["Suporte prioritário", true],
  ],
  familia: [
    ["Tudo do Premium para cada pessoa", true],
    ["De 2 a 10 contas no mesmo plano", true],
    ["Dietas e desafios ilimitados", true],
    ["Configurações de grupo", true],
    ["Suporte prioritário 24/7", true],
  ],
};

const SUB_STATUS = {
  active: ["ok", "Ativa"],
  trialing: ["ok", "Em período de teste"],
  past_due: ["warn", "Pagamento pendente"],
  unpaid: ["warn", "Pagamento pendente"],
  incomplete: ["warn", "Aguardando pagamento"],
  canceled: ["off", "Cancelada"],
  incomplete_expired: ["off", "Expirada"],
};

const USAGE = [
  ["treinos", "Treinos", "week"],
  ["agendamentos", "Agendamentos", "month"],
  ["comunidades", "Comunidades", "month"],
  ["dietas", "Dietas", "month"],
  ["desafios", "Desafios", "month"],
];

const nextReset = (kind) => {
  const d = new Date();
  if (kind === "week") d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); // próxima segunda
  else d.setMonth(d.getMonth() + 1, 1);
  return fmtDate(d, { day: "numeric", month: "short" });
};

const brand = (b) => ({ visa: "Visa", mastercard: "Mastercard", amex: "Amex", elo: "Elo", hipercard: "Hipercard" }[b] || "Cartão");

export default {
  title: "Meu plano",
  eyebrow: "Assinatura, limites de uso e planos disponíveis",
  render(el, { params, signal, setParams }) {
    const alive = () => !signal.aborted;
    let familySeats = 2;

    el.innerHTML = `
      <section class="plan-hero rise" id="hero">${skeleton(1, "sk-hero")}</section>
      <section class="panel block rise" style="--d:.05s">
        ${sectionHead("Uso do seu plano")}
        <div class="usage" id="usage">${skeleton(3, "sk-usage")}</div>
      </section>
      <section class="block rise" id="planos" style="--d:.1s">
        ${sectionHead("Planos MOVT")}
        <div class="plans" id="plans">${skeleton(3, "sk-plan")}</div>
        <p class="fine">Pagamento processado com segurança pela Stripe. Você pode trocar de plano ou cancelar quando quiser pelo portal de assinatura, sem falar com ninguém.</p>
      </section>`;

    // Volta do checkout da Stripe
    if (params.get("checkout") === "retorno") {
      if (params.get("session_id")) {
        toast("Pagamento recebido! Seu plano é atualizado em instantes.");
        invalidate("plan", "billing");
      } else {
        toast("Assinatura não concluída. Você pode tentar de novo quando quiser.", { type: "error" });
      }
      setParams({ checkout: null, session_id: null });
    }

    /* ---------- Ações de pagamento ---------- */
    const busy = (btn, on, label) => {
      btn.disabled = on;
      btn.classList.toggle("loading", on);
      if (label) btn.textContent = label;
    };
    const goCheckout = async (btn, plan) => {
      const label = btn.textContent;
      busy(btn, true, "Abrindo pagamento…");
      try {
        const { url } = await act("/me/billing/checkout", { priceId: plan.priceId, ...(plan.type === "familia" ? { quantity: familySeats } : {}) });
        location.assign(url); // checkout.stripe.com (validado no BFF)
      } catch (err) {
        if (!alive()) return;
        busy(btn, false, label);
        toast(err.message || "Não foi possível iniciar o pagamento.", { type: "error" });
      }
    };
    const goPortal = async (btn) => {
      const label = btn.textContent;
      busy(btn, true, "Abrindo portal…");
      try {
        const { url } = await act("/me/billing/portal");
        location.assign(url); // billing.stripe.com (validado no BFF)
      } catch (err) {
        if (!alive()) return;
        busy(btn, false, label);
        toast(err.status === 404 ? "Nenhuma assinatura encontrada para esta conta." : err.message || "Não foi possível abrir o portal.", { type: "error" });
      }
    };

    /* ---------- Plano atual ---------- */
    const renderHero = (status, bill) => {
      const plan = status?.plan || state.user?.plan || "free";
      const paid = plan !== "free";
      const sub = bill?.hasSubscription ? SUB_STATUS[bill.status] || ["ok", capFirst(bill.status || "ativa")] : paid ? ["ok", "Ativa"] : ["muted", "Gratuito"];
      const facts = [];
      if (bill?.hasSubscription && bill.nextBillingDate && bill.status !== "canceled")
        facts.push(["calendar", "Próxima cobrança", fmtDate(localDate(bill.nextBillingDate), { day: "numeric", month: "long", year: "numeric" })]);
      if (bill?.hasSubscription && bill.amount != null) facts.push(["star", "Valor", `${fmtMoney(bill.amount, bill.currency)} / mês`]);
      if (bill?.card?.last4) facts.push(["card", "Forma de pagamento", `${brand(bill.card.brand)} •••• ${bill.card.last4}`]);
      if (status?.expiresAt) facts.push(["clock", "Acesso válido até", fmtDate(localDate(status.expiresAt), { day: "numeric", month: "long", year: "numeric" })]);
      if (!paid) {
        facts.push(["dumbbell", "Treinos", "2 por semana"], ["calendar", "Agendamentos", "2 por mês"], ["users", "Comunidades", "2 por mês"]);
      }

      $("#hero", el).innerHTML = `
        <div>
          <p class="eyebrow">Seu plano atual</p>
          <h2 class="grad">${esc(planLabel(plan))}</h2>
          <span class="sub-status ${sub[0]}">${esc(sub[1])}</span>
          <p style="margin-top:14px">${
            paid
              ? "Você tem acesso completo ao MOVT. Gerencie cobrança, cartão ou cancelamento pelo portal de assinatura."
              : "Você está no plano gratuito. Faça upgrade para treinar sem limites e liberar conteúdos exclusivos."
          }</p>
          <div class="btns">
            ${paid
              ? `<button class="btn" data-portal>${icon("card")}Gerenciar assinatura</button><a class="btn btn-ghost" href="#planos" data-scroll>Comparar planos</a>`
              : `<a class="btn" href="#planos" data-scroll>${icon("bolt")}Fazer upgrade</a>`}
          </div>
        </div>
        <div class="plan-facts">${facts
          .map(([ico, label, value]) => `<div class="fact">${icon(ico)}<div><small>${esc(label)}</small><b>${esc(value)}</b></div></div>`)
          .join("")}</div>`;
    };

    /* ---------- Uso ---------- */
    const renderUsage = (status) => {
      const rows = USAGE.filter(([k]) => status?.limits?.[k]);
      if (!rows.length) {
        $("#usage", el).innerHTML = `<p class="hint">Os dados de uso aparecem aqui assim que você começar a usar o MOVT.</p>`;
        return;
      }
      $("#usage", el).innerHTML = rows
        .map(([k, label, period]) => {
          const { used = 0, limit } = status.limits[k];
          const pct = limit ? Math.min(100, (used / limit) * 100) : 100;
          const full = limit && used >= limit;
          return `<div class="usage-item">
            <p>${label}<b>${esc(used)}${limit ? ` / ${esc(limit)}` : ""}</b></p>
            <div class="bar"><i class="${full ? "full" : ""}" data-w="${pct}"></i></div>
            <small>${limit ? `${full ? "Limite atingido · " : ""}renova em ${nextReset(period)}` : "Ilimitado no seu plano"}</small>
          </div>`;
        })
        .join("");
      requestAnimationFrame(() => $$("#usage .bar i", el).forEach((i) => (i.style.width = `${i.dataset.w}%`)));
    };

    /* ---------- Comparação ---------- */
    let catalog = [];
    const renderPlans = (status, bill) => {
      const current = status?.plan || state.user?.plan || "free";
      const byType = Object.fromEntries(catalog.filter((p) => p.priceId).map((p) => [p.type, p]));
      const cards = [
        { type: "free", name: "Free", price: 0, description: "Para começar a treinar com o MOVT." },
        byType.premium ? { ...byType.premium, name: "Premium" } : { type: "premium", name: "Premium", unavailable: true },
        byType.familia ? { ...byType.familia, name: "Família" } : { type: "familia", name: "Família", unavailable: true },
      ];

      $("#plans", el).innerHTML = cards
        .map((p, i) => {
          const isCurrent = p.type === current;
          const per = p.interval === "year" ? "/ ano" : "/ mês";
          let cta;
          if (isCurrent) cta = `<button class="btn btn-ghost" disabled>Seu plano atual</button>`;
          else if (p.type === "free") cta = bill?.hasSubscription ? `<button class="btn btn-ghost" data-portal>Cancelar pelo portal</button>` : "";
          else if (p.unavailable) cta = `<button class="btn btn-ghost" disabled>Indisponível no momento</button>`;
          else if (current !== "free") cta = `<button class="btn btn-ghost" data-portal>Trocar pelo portal</button>`;
          else cta = `<button class="btn" data-buy="${esc(p.type)}">Assinar ${esc(p.name)}</button>`;

          return `<article class="plan-card-x${p.type === "premium" ? " featured" : ""}${isCurrent ? " current" : ""} rise" style="--d:${i * 0.06}s">
            ${isCurrent ? `<span class="plan-ribbon muted">Seu plano</span>` : p.type === "premium" ? `<span class="plan-ribbon">Mais popular</span>` : p.type === "familia" ? `<span class="plan-ribbon">Melhor valor</span>` : ""}
            <h3>${esc(p.name)}</h3>
            <div class="plan-price"><b>${p.unavailable ? "—" : esc(fmtMoney(p.price, p.currency))}</b><span>${p.type === "free" ? "para sempre" : p.type === "familia" ? `por pessoa ${per}` : per}</span></div>
            <p>${esc(p.description || "")}</p>
            ${p.type === "familia" && !p.unavailable && !isCurrent && current === "free"
              ? `<div class="seats"><span>Pessoas no plano</span><span class="stepper"><button data-seat="-1" aria-label="Menos uma pessoa">−</button><output id="seats">${familySeats}</output><button data-seat="1" aria-label="Mais uma pessoa">+</button></span></div>
                 <p class="fine" id="seats-total" style="margin:-8px 0 14px">Total: ${esc(fmtMoney(p.price * familySeats, p.currency))} ${per}</p>`
              : ""}
            <ul class="feat">${FEATURES[p.type].map(([t, yes]) => `<li class="${yes ? "" : "no"}">${icon(yes ? "check" : "x")}${esc(t)}</li>`).join("")}</ul>
            ${cta}
          </article>`;
        })
        .join("");

      $("#plans", el).onclick = (e) => {
        const seat = e.target.closest("[data-seat]");
        if (seat) {
          familySeats = Math.min(10, Math.max(2, familySeats + Number(seat.dataset.seat)));
          $("#seats", el).textContent = familySeats;
          const fam = byType.familia;
          $("#seats-total", el).textContent = `Total: ${fmtMoney(fam.price * familySeats, fam.currency)} ${fam.interval === "year" ? "/ ano" : "/ mês"}`;
          return;
        }
        const buy = e.target.closest("[data-buy]");
        if (buy) goCheckout(buy, byType[buy.dataset.buy]);
      };
    };

    // Botões de portal e rolagem até os planos (em qualquer parte da tela)
    el.addEventListener("click", (e) => {
      const portalBtn = e.target.closest("[data-portal]");
      if (portalBtn) return goPortal(portalBtn);
      if (e.target.closest("[data-scroll]")) {
        e.preventDefault();
        $("#planos", el).scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, { signal });

    /* ---------- Carregamento ---------- */
    const start = () => {
      Promise.allSettled([api.plan(), api.billing(), api.plans()]).then(([s, b, c]) => {
        if (!alive()) return;
        const status = s.status === "fulfilled" ? s.value : null;
        const bill = b.status === "fulfilled" ? b.value : null;
        catalog = c.status === "fulfilled" ? c.value : [];
        if (!status && !bill && !catalog.length) {
          $("#hero", el).innerHTML = errorState("Não foi possível carregar seu plano agora.");
          $("[data-retry]", el)?.addEventListener("click", start, { signal });
          return;
        }
        if (status) state.onPlan(status.plan);
        renderHero(status, bill);
        renderUsage(status);
        renderPlans(status, bill);
      });
    };
    start();
  },
};
