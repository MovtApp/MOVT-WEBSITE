/* MOVT landing — interações */
import { ROUTES } from "../core/config.js";
import { session } from "../core/session.js";
import { initMobileMenu } from "../components/mobile-menu.js";

(() => {
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Depoimentos: marquee horizontal ---------- */
  const marquee = document.querySelector(".marquee");
  const mTrack = marquee?.querySelector(".marquee-track");
  let mOffset = 0, mSetW = 0, mHover = false;
  if (mTrack) {
    const original = [...mTrack.children];
    for (let i = 0; i < 5; i++) original.forEach((n) => mTrack.appendChild(n.cloneNode(true)));
    marquee.addEventListener("mouseenter", () => (mHover = true));
    marquee.addEventListener("mouseleave", () => (mHover = false));
    var mCount = original.length;
  }
  const measureMarquee = () => {
    if (!mTrack) return;
    const kids = mTrack.children;
    mSetW = kids[mCount].offsetLeft - kids[0].offsetLeft;
  };

  /* ---------- Loop de animação ---------- */
  let last = performance.now();
  const tick = (now) => {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (!reduceMotion) {
      if (mSetW) {
        mOffset = (mOffset + (mHover ? 12 : 40) * dt) % mSetW;
        mTrack.style.transform = `translate3d(${-mOffset}px, 0, 0)`;
      }
    }
    requestAnimationFrame(tick);
  };



  /* ---------- Treino com GPS: vídeo em loop só quando visível (respeita movimento reduzido e economia de dados) ---------- */
  const routeVideo = document.querySelector(".route-video");
  if (routeVideo) {
    const soundBtn = document.querySelector(".vid-sound");
    soundBtn?.addEventListener("click", () => {
      routeVideo.muted = !routeVideo.muted;
      const on = !routeVideo.muted;
      soundBtn.setAttribute("aria-pressed", String(on));
      soundBtn.setAttribute("aria-label", on ? "Desativar o som do vídeo" : "Ativar o som do vídeo");
      if (on) routeVideo.play().catch(() => {});
    });
    const saveData = navigator.connection?.saveData === true;
    if (!reduceMotion && !saveData) {
      const vio = new IntersectionObserver(
        ([en]) => {
          if (en.isIntersecting) {
            routeVideo.preload = "auto";
            routeVideo.play().catch(() => {});
          } else {
            routeVideo.pause();
          }
        },
        { threshold: 0.25 },
      );
      vio.observe(routeVideo);
    }
  }

  /* ---------- Nav: scroll-spy com pílula deslizante ---------- */
  const links = [...document.querySelectorAll(".nav-links a")];
  const pill = document.querySelector(".nav-pill");
  const sections = links.map((a) => document.getElementById(a.dataset.spy));
  const setActive = (a) => {
    links.forEach((l) => l.classList.toggle("active", l === a));
    if (!a) { pill.style.opacity = 0; return; }
    pill.style.opacity = 1;
    pill.style.left = a.offsetLeft + "px";
    pill.style.width = a.offsetWidth + "px";
  };
  const spy = () => {
    const y = innerHeight * 0.35;
    let current = null;
    sections.forEach((s, i) => {
      const r = s.getBoundingClientRect();
      if (r.top <= y && r.bottom > y) current = links[i];
    });
    setActive(current);
  };

  /* ---------- Reveal ao entrar na tela + contadores ---------- */
  const fmt = (n, dec) =>
    n.toLocaleString("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
  const countUp = (el) => {
    const target = parseFloat(el.dataset.count);
    const dec = Number(el.dataset.decimals || 0);
    const prefix = el.dataset.prefix || "";
    if (reduceMotion) return;
    const dur = 1600, t0 = performance.now();
    const step = (now) => {
      const p = Math.min((now - t0) / dur, 1);
      const e = 1 - Math.pow(1 - p, 4);
      el.textContent = prefix + fmt(target * e, dec);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  const io = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        if (!en.isIntersecting) continue;
        en.target.classList.add("in");
        en.target.querySelectorAll("[data-count]").forEach(countUp);
        io.unobserve(en.target);
      }
    },
    { threshold: 0.15, rootMargin: "0px 0px -60px 0px" }
  );
  document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

  /* ---------- FAQ: abre/fecha com animação de altura, um por vez ---------- */
  const faqItems = [...document.querySelectorAll(".faq-item")];
  const animateDetails = (d, open) => {
    const body = d.querySelector(".faq-body");
    if (open) {
      d.open = true;
      const h = body.scrollHeight;
      body.animate([{ height: "0px", opacity: 0 }, { height: h + "px", opacity: 1 }], { duration: 450, easing: "cubic-bezier(.22,1,.36,1)" });
    } else {
      const h = body.scrollHeight;
      const a = body.animate([{ height: h + "px", opacity: 1 }, { height: "0px", opacity: 0 }], { duration: 350, easing: "cubic-bezier(.22,1,.36,1)" });
      d.classList.add("closing");
      a.onfinish = () => { d.open = false; d.classList.remove("closing"); };
    }
  };
  faqItems.forEach((d) => {
    d.querySelector("summary").addEventListener("click", (e) => {
      e.preventDefault();
      const willOpen = !d.open;
      faqItems.forEach((o) => o !== d && o.open && animateDetails(o, false));
      animateDetails(d, willOpen);
    });
  });

  /* ---------- Carrossel do blog ---------- */
  const car = document.querySelector(".carousel");
  if (car) {
    const track = car.querySelector(".carousel-track");
    const viewport = car.querySelector(".carousel-viewport");
    const prev = car.querySelector(".prev");
    const next = car.querySelector(".next");
    let index = 0;
    const metrics = () => {
      const cards = track.children;
      const step = cards[1].offsetLeft - cards[0].offsetLeft;
      const pad = parseFloat(getComputedStyle(viewport).paddingLeft) * 2;
      const visible = viewport.clientWidth - pad;
      const max = Math.max(0, Math.ceil((track.scrollWidth - visible) / step));
      return { step, max };
    };
    const update = () => {
      const { step, max } = metrics();
      index = Math.min(index, max);
      track.style.transform = `translate3d(${-index * step}px,0,0)`;
      prev.disabled = index === 0;
      next.disabled = index >= max;
    };
    prev.addEventListener("click", () => { index--; update(); });
    next.addEventListener("click", () => { index++; update(); });

    // Arrastar / swipe
    let sx = null;
    viewport.addEventListener("pointerdown", (e) => (sx = e.clientX));
    addEventListener("pointerup", (e) => {
      if (sx === null) return;
      const dx = e.clientX - sx;
      sx = null;
      if (Math.abs(dx) > 40) { index += dx < 0 ? 1 : -1; index = Math.max(0, index); update(); }
    });
    addEventListener("resize", update);
    update();
  }

  initMobileMenu();

  /* ---------- Botões "Entrar" viram "Dashboard" quando já há sessão ---------- */
  if (session.hinted) {
    document.querySelectorAll("[data-auth-link]").forEach((a) => {
      a.textContent = "Dashboard";
      a.href = ROUTES.dashboard;
    });
  }

  /* ---------- Init ---------- */
  const onScroll = () => { spy(); };
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", () => { measureMarquee(); onScroll(); });
  addEventListener("load", () => { measureMarquee(); });
  measureMarquee();
  onScroll();
  requestAnimationFrame(tick);
})();
