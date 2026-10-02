/* MOVT web — páginas jurídicas (termos e privacidade) */
import { ROUTES } from "../core/config.js";
import { session } from "../core/session.js";
import { initMobileMenu } from "../components/mobile-menu.js";

initMobileMenu();

if (session.hinted) {
  document.querySelectorAll("[data-auth-link]").forEach((a) => {
    a.textContent = "Dashboard";
    a.href = ROUTES.dashboard;
  });
}
