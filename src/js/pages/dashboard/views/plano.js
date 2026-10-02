/* MOVT web — Meu plano (provisória: a tela completa entra na próxima fase) */
import { emptyState } from "../ui.js";

export default {
  title: "Meu plano",
  eyebrow: "Assinatura e limites de uso",
  render(el) {
    el.innerHTML = emptyState({ ico: "star", title: "Em breve", text: "Esta tela está sendo preparada." });
  },
};