/* MOVT web — guarda do dashboard.
 * Script clássico e síncrono no <head>: redireciona para o login ANTES de
 * renderizar a página quando não há a dica de sessão (cookie movt_auth). Fica em
 * public/ (fora do bundle) para poder bloquear a renderização; externo para
 * respeitar a CSP (sem inline). A sessão real é um cookie HttpOnly validado
 * pelo BFF: se for inválida, a API responde 401 e o dashboard volta ao login.
 */
(function () {
  if (!/(?:^|;\s*)movt_auth=1(?:;|$)/.test(document.cookie)) location.replace("/auth");
})();
