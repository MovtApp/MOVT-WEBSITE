#!/usr/bin/env node
/* Configura na Vercel as variáveis obrigatórias do BFF (Production e Preview).
 *
 *   npm run vercel:env
 *
 * - BFF_SESSION_KEY: gerada aqui, uma por ambiente (preview não abre sessões de produção)
 * - BFF_PROXY_SECRET: o MESMO valor do MOVT-BACKEND. Lido de $BFF_PROXY_SECRET ou
 *   digitado (sem eco na tela).
 *
 * Os valores vão para a CLI pela entrada padrão: nunca aparecem no terminal, em
 * argumentos de processo ou em arquivos. Variável que já existe NÃO é sobrescrita
 * (trocar a BFF_SESSION_KEY derruba todas as sessões abertas).
 * Pré-requisito: `vercel login` e `vercel link` nesta pasta.
 */
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { stdin, stdout } from "node:process";

const TARGETS = ["production", "preview"];
const isWin = process.platform === "win32";

function vercel(args, input) {
  const r = spawnSync("vercel", [...args, "--non-interactive"], { input, encoding: "utf8", shell: isWin });
  return { ok: r.status === 0, out: `${r.stdout || ""}${r.stderr || ""}` };
}

// Digitação sem eco (o segredo não aparece na tela)
function askHidden(question) {
  return new Promise((resolve) => {
    stdout.write(question);
    let value = "";
    stdin.setRawMode?.(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    const onData = (ch) => {
      if (ch === "\r" || ch === "\n" || ch === "\u0004") {
        stdin.setRawMode?.(false);
        stdin.pause();
        stdin.off("data", onData);
        stdout.write("\n");
        resolve(value.trim());
      } else if (ch === "\u0003") {
        process.exit(130);
      } else if (ch === "\u007f" || ch === "\b") {
        value = value.slice(0, -1);
      } else {
        value += ch;
      }
    };
    stdin.on("data", onData);
  });
}

/* 1. Projeto vinculado? Mostra para a pessoa confirmar o alvo */
const inspect = vercel(["project", "inspect"]);
if (!inspect.ok) {
  console.error("Projeto não vinculado ou sem login. Rode antes:\n  vercel login\n  vercel link\n");
  console.error(inspect.out.trim().split("\n").slice(-4).join("\n"));
  process.exit(1);
}
console.log("Projeto Vercel vinculado:\n" + inspect.out.trim().split("\n").slice(0, 6).map((l) => `  ${l}`).join("\n") + "\n");

/* 2. O que já existe (nomes e ambientes; valores nunca são lidos) */
const ls = vercel(["env", "ls", "--format", "json"]);
const existing = new Set();
try {
  const data = JSON.parse(ls.out.slice(ls.out.indexOf("{")));
  for (const e of data.envs || data || []) for (const t of [].concat(e.target || [])) existing.add(`${e.key}:${t}`);
} catch {
  // formato inesperado: segue tentando adicionar; a CLI recusa duplicadas
}

/* 3. Segredo do proxy (igual ao do backend) */
let proxySecret = process.env.BFF_PROXY_SECRET || "";
const needProxy = TARGETS.some((t) => !existing.has(`BFF_PROXY_SECRET:${t}`));
if (needProxy && !proxySecret) proxySecret = await askHidden("BFF_PROXY_SECRET (o mesmo valor do MOVT-BACKEND, mín. 32 caracteres): ");
if (needProxy && proxySecret.length < 32) {
  console.error("BFF_PROXY_SECRET precisa ter pelo menos 32 caracteres. Nada foi alterado.");
  process.exit(1);
}

/* 4. Adiciona o que falta */
let failed = false;
for (const target of TARGETS) {
  const plan = [
    ["BFF_SESSION_KEY", () => randomBytes(32).toString("base64")],
    ["BFF_PROXY_SECRET", () => proxySecret],
  ];
  for (const [name, value] of plan) {
    if (existing.has(`${name}:${target}`)) {
      console.log(`= ${name} (${target}) já existe: mantido`);
      continue;
    }
    const v = value();
    let r = vercel(["env", "add", name, target, "--sensitive", "--yes"], v);
    // CLI antiga sem --sensitive: repete sem a flag
    if (!r.ok && /unknown or unexpected option|unknown option.*sensitive/i.test(r.out)) r = vercel(["env", "add", name, target, "--yes"], v);
    if (r.ok) console.log(`+ ${name} (${target}) configurada`);
    else if (/already exists/i.test(r.out)) console.log(`= ${name} (${target}) já existe: mantido`);
    else {
      failed = true;
      console.error(`! ${name} (${target}) falhou:\n  ${r.out.trim().split("\n").slice(-3).join("\n  ")}`);
    }
  }
}

console.log(failed ? "\nAlgumas variáveis falharam (veja acima)." : "\nPronto. Faça o deploy: npm run deploy (preview) ou npm run deploy:prod");
process.exit(failed ? 1 : 0);
