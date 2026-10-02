/* MOVT web — modal "Baixar app": App Store e Google Play, cada um com QR code
 *
 * Abre em qualquer link do painel para /#download (sidebar, "Agendar pelo app",
 * "Começar no app"...). O QR é gerado aqui a partir de STORES (core/config.js):
 * trocar o link troca o QR, sem imagens para atualizar.
 */
import { STORES } from "../../core/config.js";
import { $, esc, safeUrl } from "../../utils/dom.js";

const LOGO = {
  apple:
    '<path d="M16.4 12.6c0-2.4 2-3.6 2.1-3.7-1.1-1.7-2.9-1.9-3.5-1.9-1.5-.2-2.9.9-3.7.9-.8 0-1.9-.9-3.2-.8-1.6 0-3.1 1-4 2.4-1.7 3-.4 7.4 1.2 9.8.8 1.2 1.8 2.5 3 2.4 1.2 0 1.7-.8 3.2-.8s1.9.8 3.2.8c1.3 0 2.2-1.2 3-2.4.9-1.4 1.3-2.7 1.3-2.8 0 0-2.6-1-2.6-3.9zM14 5.4c.7-.8 1.1-1.9 1-3-1 0-2.1.7-2.8 1.5-.6.7-1.2 1.8-1 2.9 1 .1 2.1-.6 2.8-1.4z"/>',
  play:
    '<path d="M3.6 2.3c-.3.3-.4.7-.4 1.2v17c0 .5.1.9.4 1.2l9.6-9.7z" fill="#00d7fe"/><path d="M16.4 15.2l-3.2-3.2 3.2-3.2 3.7 2.1c1 .6 1 1.6 0 2.2z" fill="#ffce00"/><path d="M16.4 15.2L13.2 12l-9.6 9.7c.4.4 1 .4 1.7 0z" fill="#ff3a44"/><path d="M16.4 8.8L5.3 2.4c-.7-.4-1.3-.4-1.7 0l9.6 9.6z" fill="#00f076"/>',
};

const STORE_LIST = [
  { key: "appStore", name: "App Store", sub: "iPhone e iPad", logo: "apple", cta: "Abrir na App Store" },
  { key: "googlePlay", name: "Google Play", sub: "Celulares Android", logo: "play", cta: "Abrir no Google Play" },
];

// QR em SVG (um único <path>): nítido em qualquer tamanho e sem bibliotecas no DOM
function qrSvg(qrcode, text) {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  const m = 2; // margem (zona de silêncio) em módulos
  let d = "";
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c + m} ${r + m}h1v1h-1z`;
  return `<svg viewBox="0 0 ${n + m * 2} ${n + m * 2}" shape-rendering="crispEdges" role="img" aria-label="QR code"><rect width="100%" height="100%" fill="#fff"/><path d="${d}" fill="#121212"/></svg>`;
}

// iPhone/iPad ou Android: a loja do aparelho aparece primeiro e destacada
const platform = () => (/iPhone|iPad|iPod/.test(navigator.userAgent) ? "appStore" : /Android/.test(navigator.userAgent) ? "googlePlay" : null);

// Só links HTTPS absolutos (vazio ou relativo = "Em breve"; safeUrl("") viraria a raiz do site)
const storeUrl = (key) => {
  const raw = String(STORES[key] || "").trim();
  return /^https:\/\//i.test(raw) ? safeUrl(raw) : "";
};

function storeCard(s, qrcode) {
  const url = storeUrl(s.key);
  const mine = platform() === s.key;
  return `
    <article class="store-card${url ? "" : " soon"}${mine ? " mine" : ""}">
      <header>
        <span class="store-logo store-${s.logo}"><svg viewBox="0 0 24 24" aria-hidden="true">${LOGO[s.logo]}</svg></span>
        <div><h3>${esc(s.name)}</h3><p>${esc(s.sub)}</p></div>
        ${mine ? `<span class="store-tag">Seu aparelho</span>` : ""}
      </header>
      ${
        url
          ? `<div class="store-qr">${qrSvg(qrcode, url)}</div>
             <p class="store-hint">Aponte a câmera do celular</p>
             <a class="btn btn-sm store-btn" href="${esc(url)}" target="_blank" rel="noopener">${esc(s.cta)}</a>`
          : `<div class="store-qr store-qr-soon"><span>Em breve</span></div>
             <p class="store-hint">O MOVT chega à ${esc(s.name)} em breve</p>
             <button class="btn btn-sm btn-ghost store-btn" disabled>Em breve</button>`
      }
    </article>`;
}

let built = null;
// O gerador de QR só é baixado na primeira abertura (fica fora do bundle inicial)
async function build() {
  const { default: qrcode } = await import("qrcode-generator");
  const d = $("#app-modal");
  const order = [...STORE_LIST].sort((a, b) => (b.key === platform()) - (a.key === platform()));
  $("#app-stores", d).innerHTML = order.map((s) => storeCard(s, qrcode)).join("");
}

export async function openAppModal() {
  const d = $("#app-modal");
  if (!built) $("#app-stores", d).innerHTML = '<div class="skeleton sk-store"></div>'.repeat(2);
  d.showModal();
  built ??= build().catch(() => {
    built = null; // sem rede: tenta de novo na próxima abertura
    $("#app-stores", d).innerHTML = '<p class="hint">Não foi possível carregar agora. Tente de novo.</p>';
  });
  await built;
  $(".store-btn:not([disabled])", d)?.focus({ preventScroll: true });
}

export function initAppModal() {
  const d = $("#app-modal");
  d.addEventListener("click", (e) => {
    if (e.target === d || e.target.closest("[data-close]")) d.close();
  });
  // Qualquer CTA do painel para baixar o app abre o modal em vez de sair para a landing
  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[href="/#download"], [data-app-modal]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    openAppModal();
  });
}
