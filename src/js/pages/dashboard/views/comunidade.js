/* MOVT web — Comunidade: perfil, feed, meus posts e comunidades
 *
 * Ações na web: curtir posts do feed e entrar em comunidades. Publicar
 * (foto/câmera) continua no app.
 */
import { $ } from "../../../utils/dom.js";
import { state } from "../state.js";
import { act, api, invalidate } from "../store.js";
import { confirmDialog, countTo, emptyState, errorState, esc, fmtDate, fmtInt, icon, localDate, openSheet, safeUrl, skeleton, tabs, timeAgo, toast } from "../ui.js";
import { APP_HREF } from "./shared.js";

const initials = (name) => (name || "M").trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
const avatar = (photo, name, cls = "") =>
  photo ? `<img class="${cls}" src="${esc(safeUrl(photo))}" alt="" loading="lazy" referrerpolicy="no-referrer" />` : `<span class="ph ${cls}">${esc(initials(name))}</span>`;

const TABS = ["feed", "posts", "comunidades"];

export default {
  title: "Comunidade",
  eyebrow: "Seu perfil, o feed e as comunidades do MOVT",
  render(el, { params, signal, setParams, navigate }) {
    const alive = () => !signal.aborted;
    const st = { tab: TABS.includes(params.get("aba")) ? params.get("aba") : "feed", filter: params.get("filtro") === "minhas" ? "minhas" : "todas" };
    let feed = null;
    let posts = null;
    let comms = null;

    el.innerHTML = `
      <section class="profile rise" id="profile">
        <div class="profile-banner" id="banner"></div>
        <div class="profile-body">
          <div class="profile-avatar" id="p-avatar">${esc(initials(state.user?.name))}</div>
          <div class="profile-id">
            <h2 id="p-name">${esc(state.user?.name || "Seu perfil")}</h2>
            <p class="handle" id="p-handle"></p>
            <p class="bio" id="p-bio"></p>
            <div class="profile-meta" id="p-meta"></div>
          </div>
          <div class="profile-stats">
            <div><b data-stat="posts">—</b><span>Posts</span></div>
            <div><b data-stat="followers">—</b><span>Seguidores</span></div>
            <div><b data-stat="following">—</b><span>Seguindo</span></div>
          </div>
        </div>
      </section>
      <div class="sec-head">
        <div id="tabs"></div>
        <a class="see-more" href="${APP_HREF}">${icon("phone")}Publicar pelo app</a>
      </div>
      <div id="panel"></div>`;

    const panel = $("#panel", el);

    /* ---------- Perfil ---------- */
    api.profile().then((p) => {
      if (!alive()) return;
      if (p.banner) $("#banner", el).style.backgroundImage = `url("${safeUrl(p.banner)}")`;
      if (p.photo) {
        $("#p-avatar", el).innerHTML = `<img src="${esc(safeUrl(p.photo))}" alt="" referrerpolicy="no-referrer" />`;
        $("#p-avatar img", el).onerror = (e) => (e.target.parentElement.textContent = initials(p.name));
      }
      if (p.name) $("#p-name", el).textContent = p.name;
      $("#p-handle", el).textContent = p.username ? `@${p.username}` : "";
      $("#p-bio", el).textContent = p.bio || "";
      $("#p-meta", el).innerHTML = [p.jobTitle && `<span>${icon("star")}${esc(p.jobTitle)}</span>`, p.location && `<span>${icon("pin")}${esc(p.location)}</span>`].filter(Boolean).join("");
    }).catch(() => {});
    api.stats().then((s) => {
      if (!alive()) return;
      ["posts", "followers", "following"].forEach((k) => countTo($(`[data-stat="${k}"]`, el), s?.[k]));
    }).catch(() => {});

    /* ---------- Abas ---------- */
    const renderTabs = () => {
      $("#tabs", el).innerHTML = tabs([["feed", "Feed"], ["posts", "Meus posts", posts?.length ?? null], ["comunidades", "Comunidades", comms?.length ?? null]], st.tab, "aba");
    };
    $("#tabs", el).addEventListener("click", (e) => {
      const b = e.target.closest("[data-aba]");
      if (!b || b.dataset.aba === st.tab) return;
      st.tab = b.dataset.aba;
      setParams({ aba: st.tab === "feed" ? null : st.tab, filtro: null });
      show();
    }, { signal });

    const failed = (msg, retry) => {
      if (!alive() || !panel) return;
      panel.innerHTML = errorState(msg);
      $("[data-retry]", panel)?.addEventListener("click", retry, { signal });
    };

    /* ---------- Feed ---------- */
    const postCard = (p, i) => `
      <article class="fpost rise" style="--d:${Math.min(i, 8) * 0.04}s">
        <div class="fpost-head">
          ${avatar(p.author.photo, p.author.name)}
          <div><b>${esc(p.author.name || p.author.username || "Usuário MOVT")}${p.author.verified ? icon("verified") : ""}</b><small>${p.author.username ? `@${esc(p.author.username)} · ` : ""}${esc(timeAgo(p.createdAt))}</small></div>
        </div>
        ${p.image ? `<div class="fpost-img"><img src="${esc(safeUrl(p.image))}" alt="" loading="lazy" /></div>` : ""}
        <div class="fpost-body">
          <div class="fpost-actions">
            <button class="like${p.liked ? " on" : ""}" data-like="${esc(p.id)}" aria-pressed="${p.liked}" aria-label="${p.liked ? "Descurtir" : "Curtir"}">${icon("heart")}<span>${fmtInt(p.likes)}</span></button>
            <span>${icon("comment")}${fmtInt(p.comments)}</span>
          </div>
          ${p.caption ? `<p class="fpost-caption"><b>${esc(p.author.username || p.author.name)}</b>${esc(p.caption)}</p>` : ""}
        </div>
      </article>`;

    const renderFeed = () => {
      panel.innerHTML = feed.length
        ? `<div class="feed">${feed.map(postCard).join("")}</div>`
        : emptyState({ ico: "users", title: "Seu feed está vazio", text: "Siga pessoas e personais pelo app para ver as publicações aqui." });
    };

    panel.addEventListener("click", async (e) => {
      const b = e.target.closest("[data-like]");
      if (!b || b.disabled) return;
      const p = feed.find((x) => x.id === b.dataset.like);
      if (!p) return;
      // Otimista: muda na hora e desfaz se a API recusar
      const apply = (liked) => {
        p.likes = Math.max(0, p.likes + (liked === p.liked ? 0 : liked ? 1 : -1));
        p.liked = liked;
        b.classList.toggle("on", liked);
        b.classList.toggle("pop", liked);
        b.setAttribute("aria-pressed", liked);
        b.setAttribute("aria-label", liked ? "Descurtir" : "Curtir");
        $("span", b).textContent = fmtInt(p.likes);
      };
      const before = p.liked;
      apply(!before);
      b.disabled = true;
      try {
        const r = await act("/feed/like", { id: p.id });
        if (alive() && r.liked !== p.liked) apply(r.liked);
      } catch (err) {
        if (!alive()) return;
        apply(before);
        toast(err.message || "Não foi possível curtir agora.", { type: "error" });
      } finally {
        b.disabled = false;
      }
    }, { signal });

    /* ---------- Meus posts ---------- */
    const renderPosts = () => {
      if (!posts.length) {
        panel.innerHTML = emptyState({ ico: "users", title: "Você ainda não publicou", text: "Compartilhe seus treinos pelo app MOVT: eles aparecem aqui.", action: `<a class="btn btn-sm" href="${APP_HREF}">Publicar pelo app</a>` });
        return;
      }
      panel.innerHTML = `<div class="posts">${posts
        .map(
          (p, i) => `<button class="tile" data-post="${i}" aria-label="Abrir publicação">
            ${p.image ? `<img src="${esc(safeUrl(p.image))}" alt="" loading="lazy" />` : `<span class="tile-cap">${esc(p.caption.slice(0, 90))}</span>`}
            <span class="tile-over"><span>${icon("heart")}${fmtInt(p.likes)}</span><span>${icon("comment")}${fmtInt(p.comments)}</span></span>
          </button>`
        )
        .join("")}</div>`;
    };
    panel.addEventListener("click", (e) => {
      const t = e.target.closest("[data-post]");
      if (!t || !posts) return;
      const p = posts[Number(t.dataset.post)];
      openSheet({
        img: p.image ? safeUrl(p.image) : "",
        cat: "Sua publicação",
        title: p.createdAt ? fmtDate(new Date(p.createdAt), { day: "numeric", month: "long", year: "numeric" }) : "Publicação",
        meta: [`${fmtInt(p.likes)} curtidas`, `${fmtInt(p.comments)} comentários`],
        desc: p.caption,
        actions: [{ label: "Abrir no app", href: APP_HREF }],
      });
    }, { signal });

    /* ---------- Comunidades ---------- */
    const commCard = (c, i) => {
      const pct = c.max ? Math.min(100, (c.participants / c.max) * 100) : 0;
      const full = c.max && c.participants >= c.max;
      const date = localDate(c.eventDate);
      return `<article class="comm rise" style="--d:${Math.min(i, 8) * 0.04}s">
        <div class="comm-img">${c.image ? `<img src="${esc(safeUrl(c.image))}" alt="" loading="lazy" />` : ""}${c.type ? `<span class="comm-tag">${esc(c.type)}</span>` : ""}</div>
        <div class="comm-body">
          <h3>${esc(c.name)}</h3>
          ${c.description ? `<p>${esc(c.description)}</p>` : ""}
          <div class="comm-facts">
            ${c.category ? `<span>${icon("star")}${esc(c.category)}</span>` : ""}
            ${date ? `<span>${icon("calendar")}${esc(fmtDate(date, { day: "numeric", month: "short" }))}</span>` : ""}
            ${c.location ? `<span>${icon("pin")}${esc(c.location)}</span>` : ""}
          </div>
          <div class="comm-cap">${icon("users")} ${fmtInt(c.participants)}${c.max ? ` de ${fmtInt(c.max)} participantes` : " participantes"}${c.max ? `<div class="bar"><i style="width:${pct}%"></i></div>` : ""}</div>
          ${c.isMember
            ? `<button class="btn joined" disabled>${icon("check")}Você participa</button>`
            : full
              ? `<button class="btn btn-ghost" disabled>Vagas esgotadas</button>`
              : `<button class="btn" data-join="${esc(c.id)}">Participar</button>`}
        </div>
      </article>`;
    };

    const renderComms = () => {
      const list = st.filter === "minhas" ? comms.filter((c) => c.isMember) : comms;
      const filters = `<div class="chips" style="margin-bottom:16px">
        <button class="chip${st.filter === "todas" ? " active" : ""}" data-filter="todas">Todas</button>
        <button class="chip${st.filter === "minhas" ? " active" : ""}" data-filter="minhas">Participando (${comms.filter((c) => c.isMember).length})</button>
      </div>`;
      panel.innerHTML =
        filters +
        (list.length
          ? `<div class="comms">${list.map(commCard).join("")}</div>`
          : emptyState({ ico: "users", title: st.filter === "minhas" ? "Você ainda não participa de nenhuma comunidade" : "Nenhuma comunidade disponível", text: st.filter === "minhas" ? "Explore a aba Todas e entre em uma." : "" }));
    };

    panel.addEventListener("click", async (e) => {
      const f = e.target.closest("[data-filter]");
      if (f) {
        st.filter = f.dataset.filter;
        setParams({ filtro: st.filter === "minhas" ? "minhas" : null });
        return renderComms();
      }
      const b = e.target.closest("[data-join]");
      if (!b) return;
      const c = comms.find((x) => x.id === b.dataset.join);
      if (!c) return;

      // No Free, entrar consome o limite mensal: avisa antes
      const lim = await api.plan().then((p) => p.limits?.comunidades).catch(() => null);
      if (!alive()) return;
      if (lim?.limit) {
        const left = Math.max(0, lim.limit - lim.used);
        const ok = await confirmDialog({
          title: `Participar de ${c.name}?`,
          text: left
            ? `No plano Free você pode entrar em ${lim.limit} comunidades por mês. ${left === 1 ? "Esta é a última entrada disponível neste mês." : `Esta usa 1 das ${left} entradas restantes.`}`
            : `Você já usou as ${lim.limit} entradas do mês no plano Free. Faça upgrade para participar de comunidades sem limite.`,
          ok: left ? "Participar" : "Ver planos",
        });
        if (!ok || !alive()) return;
        if (!left) return navigate("/dashboard/plano");
      }

      b.disabled = true;
      b.textContent = "Entrando…";
      try {
        await act("/me/communities/join", { id: c.id });
        c.isMember = true;
        c.participants += 1;
        invalidate("communities", "plan");
        toast(`Você entrou em ${c.name}!`);
        if (alive()) renderComms();
      } catch (err) {
        if (!alive()) return;
        b.disabled = false;
        b.textContent = "Participar";
        toast(err.message || "Não foi possível entrar agora.", err.status === 402 ? { type: "error", action: { href: "/dashboard/plano", label: "Ver planos" } } : { type: "error" });
      }
    }, { signal });

    /* ---------- Troca de aba ---------- */
    function show() {
      renderTabs();
      if (st.tab === "feed") {
        if (feed) return renderFeed();
        panel.innerHTML = `<div class="feed">${skeleton(3, "sk-post")}</div>`;
        api.feed().then((d) => { if (!alive()) return; feed = d; if (st.tab === "feed") renderFeed(); }).catch(() => failed("Não foi possível carregar o feed agora.", show));
      } else if (st.tab === "posts") {
        if (posts) return renderPosts();
        panel.innerHTML = `<div class="posts">${skeleton(6, "sk-tile")}</div>`;
        api.posts().then((d) => { if (!alive()) return; posts = d; renderTabs(); if (st.tab === "posts") renderPosts(); }).catch(() => failed("Não foi possível carregar suas publicações agora.", show));
      } else {
        if (comms) return renderComms();
        panel.innerHTML = `<div class="comms">${skeleton(3, "sk-comm")}</div>`;
        api.communities().then((d) => { if (!alive()) return; comms = d; renderTabs(); if (st.tab === "comunidades") renderComms(); }).catch(() => failed("Não foi possível carregar as comunidades agora.", show));
      }
    }

    // Contadores das abas sem esperar o clique
    api.posts().then((d) => { if (alive()) { posts = d; renderTabs(); } }).catch(() => {});
    api.communities().then((d) => { if (alive()) { comms = d; renderTabs(); } }).catch(() => {});
    show();
  },
};
