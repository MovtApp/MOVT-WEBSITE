/* MOVT web — estado de sessão no navegador
 *
 * O token de sessão fica num cookie HttpOnly definido pelo BFF: o JavaScript
 * NÃO tem acesso a ele (nem um script injetado). Aqui só lemos:
 * - movt_auth: dica "há sessão" (valor 1), usada para redirecionar sem chamar a API;
 * - movt_csrf: token anti-CSRF enviado no header das requisições que alteram dados.
 */
const readCookie = (name) => {
  const hit = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
  return hit ? decodeURIComponent(hit.slice(name.length + 1)) : null;
};

// Remove o que as versões antigas do site guardavam (token e dados pessoais)
try {
  ["movt:sessionId", "movt:user", "movt:api"].forEach((k) => localStorage.removeItem(k));
} catch {}

export const session = {
  get hinted() { return readCookie("movt_auth") === "1"; },
  get csrf() { return readCookie("__Host-movt_csrf") || readCookie("movt_csrf"); },
};
