/* MOVT web — Comunidade (provisória: a tela completa entra na próxima fase) */
import { emptyState } from "../ui.js";

export default {
  title: "Comunidade",
  eyebrow: "Seu perfil, feed e comunidades",
  render(el) {
    el.innerHTML = emptyState({ ico: "users", title: "Em breve", text: "Esta tela está sendo preparada." });
  },
};