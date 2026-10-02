/* MOVT web — estado compartilhado do painel (só em memória) */
export const state = {
  user: null,
  // Chamado quando uma tela descobre o plano atualizado (atualiza o selo do topo)
  onPlan: () => {},
};
