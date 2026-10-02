/* MOVT web — guarda do dashboard.
 * Script clássico e síncrono no <head>: redireciona para o login ANTES de
 * renderizar a página quando não há sessão. Fica em public/ (fora do bundle)
 * para poder bloquear a renderização; externo para respeitar a CSP (sem inline).
 * A validação real da sessão é feita pela API (401 → logout em dashboard.js).
 */
(function () {
  try {
    if (!localStorage.getItem("movt:sessionId")) location.replace("/auth");
  } catch {
    location.replace("/auth");
  }
})();
