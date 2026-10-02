import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";

const root = resolve(import.meta.dirname, "src");

// `npm run preview` usa os mesmos headers de segurança globais do vercel.json,
// para que violações de CSP apareçam localmente antes do deploy.
const vercel = JSON.parse(readFileSync(resolve(import.meta.dirname, "vercel.json"), "utf8"));
const securityHeaders = Object.fromEntries(
  vercel.headers.find((h) => h.source === "/(.*)").headers.map(({ key, value }) => [key, value]),
);
// preview roda em http://localhost: sem HSTS nem upgrade de requisições
delete securityHeaders["Strict-Transport-Security"];
securityHeaders["Content-Security-Policy"] = securityHeaders["Content-Security-Policy"].replace(/;\s*upgrade-insecure-requests/, "");

// Valor público padrão usado em canonical/Open Graph quando VITE_SITE_URL não está definida
process.env.VITE_SITE_URL ??= "https://movt.app";

export default defineConfig({
  root,
  envDir: import.meta.dirname,
  publicDir: resolve(import.meta.dirname, "public"),
  build: {
    outDir: resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      input: {
        index: resolve(root, "index.html"),
        auth: resolve(root, "auth.html"),
        dashboard: resolve(root, "dashboard.html"),
      },
    },
  },
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true, headers: securityHeaders },
});
