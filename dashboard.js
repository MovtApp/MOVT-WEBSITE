/* MOVT web — dashboard */
(() => {
  const { session, request } = window.MOVT;
  if (!session.id) return; // o <head> já redirecionou

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (v) =>
    String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // Fallback idêntico ao da Home do app quando /treinos não retorna nada
  const EXERCISE_FALLBACK = [
    { id: "1", title: "Agachamento", calories: "180 - 250 Kcal", minutes: "15 min", imageUrl: "https://res.cloudinary.com/ditlmzgrh/image/upload/v1757229915/image_71_jntmsv.jpg" },
    { id: "2", title: "Supino", calories: "150 - 200 Kcal", minutes: "12 min", imageUrl: "https://res.cloudinary.com/ditlmzgrh/image/upload/v1757229915/image_txncpp.jpg" },
    { id: "3", title: "Remada curvada", calories: "160 - 220 Kcal", minutes: "12 min", imageUrl: "https://res.cloudinary.com/ditlmzgrh/image/upload/v1757229918/image_75_drh4vh.jpg" },
    { id: "4", title: "Levantamento Terra", calories: "160 - 220 Kcal", minutes: "15 min", imageUrl: "https://res.cloudinary.com/ditlmzgrh/image/upload/v1757229918/image111_gu6iim.jpg" },
    { id: "5", title: "Puxada na Barra", calories: "140 - 200 Kcal", minutes: "12 min", imageUrl: "https://res.cloudinary.com/ditlmzgrh/image/upload/v1757229918/image_73_co9eqf.jpg" },
  ];
  const DEFAULT_IMG = "https://res.cloudinary.com/ditlmzgrh/image/upload/v1757229915/image_71_jntmsv.jpg";
  const DEFAULT_PLAN_IMG = "https://res.cloudinary.com/ditlmzgrh/image/upload/v1757513125/prancha_g1v30x.png";

  /* ---------- Sessão inválida → login ---------- */
  const handleAuthError = (err) => {
    if (err && (err.status === 401 || err.status === 403)) {
      session.clear();
      location.replace("auth.html");
      return true;
    }
    return false;
  };

  /* ---------- Usuário ---------- */
  const renderUser = (u) => {
    const name = (u?.name || u?.nome || "").trim();
    $("#user-first").textContent = name ? name.split(/\s+/)[0] : "atleta";
    $("#um-name").textContent = name || "Usuário MOVT";
    $("#um-email").textContent = u?.email || "";
    const initials = name ? name.split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase() : "M";
    const av = $("#avatar-btn");
    if (u?.photo) {
      av.innerHTML = `<img src="${esc(u.photo)}" alt="" />`;
      av.querySelector("img").onerror = () => (av.innerHTML = `<span>${esc(initials)}</span>`);
    } else {
      av.innerHTML = `<span>${esc(initials)}</span>`;
    }
    renderPlanBadge(u?.plan);
    $("#verify-banner").hidden = u?.isVerified !== false;
  };
  const planLabel = (p) => ({ free: "Free", premium: "Premium", familia: "Família" }[p] || p || "Free");
  const renderPlanBadge = (plan) => {
    const b = $("#plan-badge");
    b.textContent = planLabel(plan);
    b.hidden = false;
  };

  /* ---------- Data / semana ---------- */
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  $("#today-label").textContent = today.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

  let weekOffset = 0;
  let selected = new Date(today);
  let apptDays = new Set();
  const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

  const renderWeek = () => {
    const start = new Date(today);
    start.setDate(today.getDate() - 3 + weekOffset * 7);
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
    const mid = days[3];
    $("#month-label").textContent = mid.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }).replace(" de ", " de ");
    $("#week").innerHTML = days
      .map((d) => {
        const cls = [
          "day",
          dayKey(d) === dayKey(today) && "today",
          dayKey(d) === dayKey(selected) && "selected",
          apptDays.has(dayKey(d)) && "has-appt",
        ].filter(Boolean).join(" ");
        const wd = d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
        return `<button class="${cls}" data-key="${d.toISOString()}"><small>${wd}</small><b>${d.getDate()}</b><span class="dot"></span></button>`;
      })
      .join("");
    $$("#week .day").forEach((b) =>
      b.addEventListener("click", () => {
        selected = new Date(b.dataset.key);
        renderWeek();
      })
    );
  };
  $$("[data-week]").forEach((b) =>
    b.addEventListener("click", () => {
      weekOffset += Number(b.dataset.week);
      renderWeek();
    })
  );
  renderWeek();

  /* ---------- Radar (mesmos eixos do MiniRadarChart do app) ---------- */
  const renderRadar = (values) => {
    const labels = ["Força", "Cardio", "Mobilidade", "Resistência", "Sono", "Nutrição"];
    const cx = 120, cy = 120, R = 82, n = labels.length;
    const pt = (i, r) => {
      const a = (Math.PI * 2 * i) / n - Math.PI / 2;
      return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
    };
    let svg = "";
    for (const f of [0.25, 0.5, 0.75, 1]) {
      svg += `<polygon class="ring" points="${labels.map((_, i) => pt(i, R * f).join(",")).join(" ")}"/>`;
    }
    labels.forEach((l, i) => {
      const [x, y] = pt(i, R);
      const [tx, ty] = pt(i, R + 18);
      svg += `<line class="axis" x1="${cx}" y1="${cy}" x2="${x}" y2="${y}"/>`;
      svg += `<text x="${tx}" y="${ty + 3}" text-anchor="middle">${l}</text>`;
    });
    const poly = values.map((v, i) => pt(i, R * v));
    svg += `<polygon class="area" points="${poly.map((p) => p.join(",")).join(" ")}"/>`;
    svg += poly.map(([x, y]) => `<circle class="pt" cx="${x}" cy="${y}" r="3"/>`).join("");
    $("#radar").innerHTML = svg;
  };
  renderRadar([0.72, 0.58, 0.45, 0.66, 0.8, 0.52]);

  /* ---------- Treinos ---------- */
  const mapTraining = (t) => ({
    id: String(t.id ?? t.id_treino ?? Math.random()),
    title: t.title || t.nome || "Treino",
    description: t.description || t.descricao || "",
    calories: t.calories || t.calorias || "",
    minutes: t.minutes || t.duracao || "",
    sets: t.sets || "3 séries",
    category: t.category || t.categoria || "Fitness",
    imageUrl: t.image_url || t.imageUrl || t.imageurl || "",
  });

  const openSheet = (t, kind) => {
    $("#sheet-img").src = t.imageUrl || (kind === "plan" ? DEFAULT_PLAN_IMG : DEFAULT_IMG);
    $("#sheet-cat").textContent = kind === "plan" ? t.category : "Treino";
    $("#sheet-title").textContent = t.title;
    $("#sheet-meta").innerHTML = [t.minutes, t.calories, kind === "plan" ? t.sets : "Intermediário"]
      .filter(Boolean)
      .map((m) => `<span>${esc(m)}</span>`)
      .join("");
    $("#sheet-desc").textContent =
      t.description && !/^\d+\s*min/.test(t.description) ? t.description : `Treino de ${t.title} focado em queima de calorias.`;
    $("#sheet").showModal();
  };
  $("#sheet").addEventListener("click", (e) => {
    if (e.target.id === "sheet" || e.target.closest("[data-close]")) $("#sheet").close();
  });

  const renderDaily = (list) => {
    const el = $("#daily");
    if (!list.length) {
      el.innerHTML = `<div class="panel empty" style="grid-column:1/-1">
        <svg viewBox="0 0 24 24"><path d="M6.5 6.5v11M17.5 6.5v11M3 9.5v5M21 9.5v5M6.5 12h11"/></svg>
        Nenhum treino do dia por enquanto. Seu personal pode montar um plano para você no app.</div>`;
      return;
    }
    el.innerHTML = list
      .map(
        (t, i) => `<button class="plan-card rise" style="--d:${i * 0.06}s" data-i="${i}">
          <img src="${esc(t.imageUrl || DEFAULT_PLAN_IMG)}" alt="" loading="lazy" />
          <div><p class="eyebrow">${esc(t.category)}</p><h4>${esc(t.title)}</h4><p>${esc([t.sets, t.calories].filter(Boolean).join(" · "))}</p></div>
        </button>`
      )
      .join("");
    $$(".plan-card", el).forEach((b) => b.addEventListener("click", () => openSheet(list[b.dataset.i], "plan")));
  };

  const renderPopular = (list) => {
    const el = $("#popular");
    el.innerHTML = list
      .map(
        (t, i) => `<button class="ex rise" style="--d:${i * 0.05}s" data-i="${i}">
          <img src="${esc(t.imageUrl || DEFAULT_IMG)}" alt="" loading="lazy" />
          <span class="ex-play"><svg viewBox="0 0 24 24"><path d="M6 4l14 8-14 8z"/></svg></span>
          <div class="ex-info"><h4>${esc(t.title)}</h4><div class="ex-meta">${[t.minutes, t.calories]
            .filter(Boolean)
            .map((m) => `<span>${esc(m)}</span>`)
            .join("")}</div></div>
        </button>`
      )
      .join("");
    $$(".ex", el).forEach((b) => b.addEventListener("click", () => openSheet(list[b.dataset.i], "exercise")));
  };

  const loadPopular = async (specialty) => {
    $("#popular").innerHTML = `<div class="skeleton" style="aspect-ratio:3/4"></div>`.repeat(4);
    try {
      const resp = await request("/treinos", { params: { specialty: specialty || undefined } });
      const list = (resp?.data || []).map(mapTraining);
      renderPopular(list.length ? list : EXERCISE_FALLBACK);
    } catch (err) {
      if (handleAuthError(err)) return;
      renderPopular(EXERCISE_FALLBACK);
    }
  };
  $$("#chips .chip").forEach((c) =>
    c.addEventListener("click", () => {
      $$("#chips .chip").forEach((x) => x.classList.toggle("active", x === c));
      loadPopular(c.dataset.spec);
    })
  );

  const loadDaily = async () => {
    try {
      const resp = await request("/treinos", { params: { isDaily: true } });
      renderDaily((resp?.data || []).map(mapTraining).slice(0, 6));
    } catch (err) {
      if (handleAuthError(err)) return;
      renderDaily([]);
    }
  };

  /* ---------- Agendamentos ---------- */
  const loadAppointments = async () => {
    const el = $("#appts");
    try {
      const resp = await request("/appointments", { params: { role: "client" } });
      const now = new Date();
      const list = (Array.isArray(resp?.data) ? resp.data : [])
        .filter((a) => a.status !== "cancelado")
        .map((a) => ({ ...a, _date: new Date(a.data_agendamento || a.data) }))
        .filter((a) => !isNaN(a._date));

      apptDays = new Set(list.map((a) => dayKey(a._date)));
      renderWeek();

      const upcoming = list.filter((a) => a._date >= new Date(now.toDateString())).sort((a, b) => a._date - b._date).slice(0, 4);
      if (!upcoming.length) {
        el.innerHTML = `<li class="empty">
          <svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>
          Você não tem sessões agendadas.<br/>Encontre um personal trainer pelo app.</li>`;
        return;
      }
      el.innerHTML = upcoming
        .map((a) => {
          const who = a.nome_trainer || a.trainer_nome || a.personal_nome || a.nome_personal || a.trainer?.nome || a.nome_pj || "Personal trainer";
          const hour = a.horario || a.hora_inicio || a.hora || a._date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
          const place = a.local || a.nome_academia || a.academia?.nome || a.modalidade || "";
          const st = String(a.status || "pendente").toLowerCase();
          return `<li class="appt">
            <div class="appt-date"><b>${a._date.getDate()}</b><small>${a._date.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}</small></div>
            <div class="appt-info"><h4>${esc(who)}</h4><p>${esc([String(hour).slice(0, 5), place].filter(Boolean).join(" · "))}</p></div>
            <span class="status ${esc(st.normalize("NFD").replace(/[̀-ͯ]/g, ""))}">${esc(st)}</span>
          </li>`;
        })
        .join("");
    } catch (err) {
      if (handleAuthError(err)) return;
      el.innerHTML = `<li class="empty">Não foi possível carregar seus agendamentos agora.</li>`;
    }
  };

  /* ---------- Plano ---------- */
  const renderPlan = (plan, limits) => {
    $("#plan-name").textContent = planLabel(plan);
    renderPlanBadge(plan);
    $("#plan-cta").hidden = plan === "premium" || plan === "familia";
    const rows = [];
    if (limits?.agendamentos) rows.push(["Agendamentos", limits.agendamentos]);
    if (limits?.comunidades) rows.push(["Comunidades", limits.comunidades]);
    $("#limits").innerHTML =
      rows
        .map(([label, { used = 0, limit }]) => {
          const pct = limit ? Math.min(100, (used / limit) * 100) : 100;
          return `<div class="limit"><p>${label}<b>${used}${limit ? ` / ${limit}` : " · ilimitado"}</b></p><div class="bar"><i data-w="${pct}"></i></div></div>`;
        })
        .join("") +
      (limits?.dietas
        ? `<div class="limit"><p>Dietas<b>${limits.dietas.canCreate ? "Liberado" : "Bloqueado"}</b></p></div>`
        : "");
    requestAnimationFrame(() => $$("#limits .bar i").forEach((i) => (i.style.width = i.dataset.w + "%")));
  };
  const loadPlan = async () => {
    try {
      const resp = await request("/user/plan-status");
      session.update({ plan: resp.plan });
      renderPlan(resp.plan, resp.limits);
    } catch (err) {
      if (handleAuthError(err)) return;
      renderPlan(session.user?.plan || "free", null);
    }
  };

  /* ---------- Estatísticas sociais ---------- */
  const countTo = (el, target) => {
    const t0 = performance.now();
    const step = (now) => {
      const p = Math.min((now - t0) / 1000, 1);
      el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3))).toLocaleString("pt-BR");
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  const loadStats = async (userId) => {
    if (!userId) return;
    try {
      const s = await request(`/user/${encodeURIComponent(userId)}/stats`);
      const data = s?.data || s || {};
      ["posts", "followers", "following"].forEach((k) => countTo($(`[data-stat="${k}"]`), Number(data[k]) || 0));
    } catch (err) {
      handleAuthError(err);
    }
  };

  /* ---------- Sessão + carregamento ---------- */
  const init = async () => {
    renderUser(session.user);
    let user = session.user;
    try {
      const resp = await request("/user/session-status");
      if (resp?.user) {
        user = session.update({
          ...resp.user,
          name: resp.user.nome || resp.user.name || user?.name,
          supabaseUserId: resp.user.supabase_uid || user?.supabaseUserId,
          plan: resp.user.plan || user?.plan || "free",
          role: (resp.user.role || user?.role || "").trim().toLowerCase(),
        });
        renderUser(user);
      }
    } catch (err) {
      if (handleAuthError(err)) return;
      // offline: segue com o usuário salvo
    }
    loadDaily();
    loadPopular("");
    loadAppointments();
    loadPlan();
    loadStats(user?.id);
  };
  init();

  /* ---------- UI: menu do usuário, sidebar mobile, logout, scroll-spy ---------- */
  const avatarBtn = $("#avatar-btn");
  const userMenu = $("#user-menu");
  avatarBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    userMenu.hidden = !userMenu.hidden;
    avatarBtn.setAttribute("aria-expanded", !userMenu.hidden);
  });
  document.addEventListener("click", (e) => {
    if (!userMenu.hidden && !userMenu.contains(e.target)) {
      userMenu.hidden = true;
      avatarBtn.setAttribute("aria-expanded", false);
    }
  });

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
  addEventListener("keydown", (e) => e.key === "Escape" && setSide(false));

  $$("[data-logout]").forEach((b) => b.addEventListener("click", () => window.MOVT.logout()));

  const navLinks = $$(".side-nav a");
  const targets = navLinks.map((a) => document.getElementById(a.hash.slice(1)));
  const spy = () => {
    let current = navLinks[0];
    targets.forEach((t, i) => {
      if (t && t.getBoundingClientRect().top < innerHeight * 0.4) current = navLinks[i];
    });
    navLinks.forEach((a) => a.classList.toggle("active", a === current));
  };
  addEventListener("scroll", spy, { passive: true });
})();
