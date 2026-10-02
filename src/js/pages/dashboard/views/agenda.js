/* MOVT web — Agenda (provisória: a tela completa entra na próxima fase) */
import { emptyState } from "../ui.js";

export default {
  title: "Agenda",
  eyebrow: "Suas sessões com personal trainers",
  render(el) {
    el.innerHTML = emptyState({ ico: "calendar", title: "Em breve", text: "Esta tela está sendo preparada." });
  },
};