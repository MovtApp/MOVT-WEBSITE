import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { defineConfig, loadEnv } from "vite";

const dir = import.meta.dirname;
const root = resolve(dir, "src");

// `npm run preview` usa os mesmos headers de segurança globais do vercel.json,
// para que violações de CSP apareçam localmente antes do deploy.
const vercel = JSON.parse(readFileSync(resolve(dir, "vercel.json"), "utf8"));
const securityHeaders = Object.fromEntries(
  vercel.headers.find((h) => h.source === "/(.*)").headers.map(({ key, value }) => [key, value]),
);
// preview roda em http://localhost: sem HSTS nem upgrade de requisições
delete securityHeaders["Strict-Transport-Security"];
securityHeaders["Content-Security-Policy"] = securityHeaders["Content-Security-Policy"].replace(/;\s*upgrade-insecure-requests/, "");

// Valor público padrão usado em canonical/Open Graph quando VITE_SITE_URL não está definida
process.env.VITE_SITE_URL ??= "https://movt.app";

// Monta o BFF (api/) no servidor do Vite, igual à função da Vercel em produção.
// Alterações em api/ exigem reiniciar o `npm run dev`.
function bff() {
  const mount = async (server) => {
    const { handle } = await import(pathToFileURL(resolve(dir, "api/_lib/app.js")).href);
    server.middlewares.use((req, res, next) => (req.url?.startsWith("/api/") ? handle(req, res) : next()));
  };
  return { name: "movt-bff", configureServer: mount, configurePreviewServer: mount };
}

// Telas do painel (/dashboard/treinos, /dashboard/agenda...) servem o mesmo
// dashboard.html, igual ao rewrite do vercel.json. O roteador do cliente escolhe a tela.
function dashboardRoutes() {
  const mount = (server) => {
    server.middlewares.use((req, _res, next) => {
      const [path, query = ""] = String(req.url || "").split("?");
      if (/^\/dashboard(\/[a-z-]+)*\/?$/.test(path)) req.url = `/dashboard.html${query ? `?${query}` : ""}`;
      next();
    });
  };
  return { name: "movt-dashboard-routes", configureServer: mount, configurePreviewServer: mount };
}

export default defineConfig(({ mode }) => {
  // Variáveis do servidor (sem prefixo VITE_) só para o BFF local; nunca vão para o bundle
  for (const [k, v] of Object.entries(loadEnv(mode, dir, ""))) process.env[k] ??= v;

  return {
    root,
    envDir: dir,
    publicDir: resolve(dir, "public"),
    plugins: [bff(), dashboardRoutes()],
    build: {
      outDir: resolve(dir, "dist"),
      emptyOutDir: true,
      sourcemap: false,
      rollupOptions: {
        input: {
          index: resolve(root, "index.html"),
          auth: resolve(root, "auth.html"),
          dashboard: resolve(root, "dashboard.html"),
          termos: resolve(root, "termos.html"),
          privacidade: resolve(root, "privacidade.html"),
        },
      },
    },
    server: { port: 5173, strictPort: true },
    preview: { port: 4173, strictPort: true, headers: securityHeaders },
  };
});
