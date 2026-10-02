/* MOVT web — configuração
 *
 * O navegador só conversa com o BFF do próprio site (/api, mesma origem).
 * A URL do backend real fica no servidor (UPSTREAM_API_URL) e não aparece aqui.
 */
export const API_BASE = "/api";
export const REQUEST_TIMEOUT_MS = 30000;

// Links do app nas lojas (os QR codes do modal "Baixar app" são gerados a partir
// daqui). Vazio = loja aparece como "Em breve".
// - Google Play: derivado do pacote Android (com.dsvmTechnology.movtapp) em app.json.
// - App Store: só existe depois da publicação (https://apps.apple.com/br/app/movt/idNNNNNNNNNN).
export const STORES = {
  appStore: "",
  googlePlay: "https://play.google.com/store/apps/details?id=com.dsvmTechnology.movtapp",
};

export const ROUTES = {
  home: "/",
  auth: "/auth",
  dashboard: "/dashboard",
};
