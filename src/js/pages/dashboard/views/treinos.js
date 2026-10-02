/* MOVT web — Treinos (provisória: a tela completa entra na próxima fase) */
import { emptyState } from "../ui.js";

export default {
  title: "Treinos",
  eyebrow: "Catálogo e treinos do dia",
  render(el) {
    el.innerHTML = emptyState({ ico: "dumbbell", title: "Em breve", text: "Esta tela está sendo preparada." });
  },
};