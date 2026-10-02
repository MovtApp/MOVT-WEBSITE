/* MOVT web — dados do painel
 *
 * Toda leitura passa por aqui: cada recurso é buscado uma vez e reaproveitado
 * entre as telas (navegar não refaz a requisição). Ações chamam invalidate()
 * para a próxima leitura vir atualizada. Nada é gravado no navegador.
 */
import { request } from "../../core/api.js";
import { ROUTES } from "../../core/config.js";

const cache = new Map();

// Sessão inválida: o BFF já apagou os cookies, então volta para o login
const onError = (err) => {
  if (err?.status === 401) location.replace(ROUTES.auth);
  throw err;
};

function load(key, fetcher, { force = false } = {}) {
  if (!force && cache.has(key)) return cache.get(key);
  const p = fetcher().catch((err) => {
    cache.delete(key); // erro não fica em cache: "Tentar de novo" refaz a busca
    return onError(err);
  });
  cache.set(key, p);
  return p;
}

export const invalidate = (...prefixes) => {
  for (const k of [...cache.keys()]) if (prefixes.some((p) => k.startsWith(p))) cache.delete(k);
};

const list = (r) => (Array.isArray(r?.data) ? r.data : []);

export const api = {
  trainings: ({ specialty = "", daily = false } = {}) =>
    load(`trainings:${specialty}:${daily}`, () =>
      request("/me/trainings", { params: { specialty, daily: daily ? "1" : "" } }).then(list)),
  trainingFilters: () => load("training-filters", () => request("/me/training-filters")),
  appointments: (opts) => load("appointments", () => request("/me/appointments").then(list), opts),
  plan: (opts) => load("plan", () => request("/me/plan"), opts),
  stats: () => load("stats", () => request("/me/stats")),
  health: () => load("health", () => request("/me/health")),
};

// Ações (POST com CSRF). Erros de sessão também levam ao login.
export const act = (path, body) => request(path, { method: "POST", body: body ?? {} }).catch(onError);
