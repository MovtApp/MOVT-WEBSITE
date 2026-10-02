/* BFF (Backend-for-Frontend) do site MOVT — Vercel Serverless Function.
 *
 * Todas as rotas /api/* são reescritas para cá (vercel.json) e despachadas
 * pela allowlist em _lib/routes.js. Arquivos com "_" não viram funções.
 */
import { handle } from "./_lib/app.js";

export default handle;
