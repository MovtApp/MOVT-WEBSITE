/* MOVT web — menu mobile do header (landing e auth) */
export function initMobileMenu() {
  const burger = document.querySelector(".nav-burger");
  const menu = document.querySelector(".nav-mobile");
  if (!burger || !menu) return;
  const toggle = (open) => {
    burger.setAttribute("aria-expanded", open);
    menu.hidden = !open;
  };
  burger.addEventListener("click", () => toggle(menu.hidden));
  menu.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => toggle(false)));
}
