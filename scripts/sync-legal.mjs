/* Gera src/termos.html e src/privacidade.html a partir das telas do app
 * (fonte única do texto jurídico), usando scripts/legal-template.html.
 *
 * Uso: npm run sync:legal [-- caminho-do-repo-do-app]
 * Padrão: ../MOVT (repositório do app ao lado deste).
 *
 * Só CONVERTE o texto (títulos, parágrafos e listas) para HTML escapado; não
 * altera conteúdo. Revisões jurídicas devem ser feitas no app e re-sincronizadas.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const appRepo = resolve(process.argv[2] || resolve(import.meta.dirname, "../../MOVT"));
const outDir = resolve(import.meta.dirname, "../src");
const template = readFileSync(resolve(import.meta.dirname, "legal-template.html"), "utf8");

const DOCS = [
  { src: "src/screens/App/terms&conditions/termsScreen.tsx", slug: "termos", title: "Termos e Condições" },
  { src: "src/screens/App/policies/policiesScreen.tsx", slug: "privacidade", title: "Política de Privacidade" },
];

const BR = "⏎"; // marcador temporário de quebra de linha
const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// Conteúdo de um <Text>: string JSX simples ou {'...'} / {"..."} / {`...`}
function textOf(raw) {
  const t = raw.trim();
  const m = /^\{\s*(['"`])([\s\S]*)\1\s*\}$/.exec(t);
  const s = m ? m[2].replace(/\\(['"`\\])/g, "$1") : t;
  // {"\n"} vira quebra de linha (marcador BR); {" "} vira espaço
  return s
    .replace(/\{\s*(['"])\\n\1\s*\}/g, BR)
    .replace(/\{\s*(['"]) \1\s*\}/g, " ")
    .replace(/\s+/g, " ")
    .replace(/ *⏎ */g, BR)
    .trim();
}

function convert(tsx) {
  const re = /<Text style=\{styles\.(\w+)\}>([\s\S]*?)<\/Text>/g;
  const html = [];
  let inList = false;
  let lastUpdate = "";
  for (const [, style, body] of tsx.matchAll(re)) {
    const text = textOf(body);
    if (!text || style === "headerTitle") continue;
    if (style === "lastUpdate") { lastUpdate = text; continue; }
    if (style === "bulletItem") {
      if (!inList) { html.push("<ul>"); inList = true; }
      html.push(`  <li>${esc(text.replace(/^[•\-–]\s*/, ""))}</li>`);
      continue;
    }
    if (inList) { html.push("</ul>"); inList = false; }
    if (style === "sectionTitle") html.push(`<h2>${esc(text)}</h2>`);
    else if (style === "sectionText") html.push(`<p>${esc(text).replace(/⏎+/g, "<br />")}</p>`);
    else throw new Error(`Estilo não mapeado: ${style}`);
  }
  if (inList) html.push("</ul>");
  return { lastUpdate, lines: html };
}

for (const doc of DOCS) {
  const { lastUpdate, lines } = convert(readFileSync(resolve(appRepo, doc.src), "utf8"));
  const content = [
    `    <!-- Gerado por scripts/sync-legal.mjs a partir de MOVT/${doc.src}. Não editar à mão. -->`,
    `    <p class="legal-updated">${esc(lastUpdate)}</p>`,
    ...lines.map((l) => `    ${l}`),
  ].join("\n");
  const page = template
    .replaceAll("{{title}}", doc.title)
    .replaceAll("{{slug}}", doc.slug)
    .replace("{{body}}", () => content);
  writeFileSync(resolve(outDir, `${doc.slug}.html`), page);
  console.log(`ok src/${doc.slug}.html — ${lastUpdate}`);
}
