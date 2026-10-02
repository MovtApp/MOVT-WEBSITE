# MOVT Website

Site do MOVT: landing page, login/registro e dashboard web do usuário. Usa o mesmo backend do app mobile (`movt-backend`).

HTML, CSS e JavaScript puros (ES modules), empacotados com [Vite](https://vite.dev). Deploy na Vercel; domínio registrado no Registro.br.

## Requisitos

- Node.js 20.19 ou superior

## Comandos

```bash
npm install        # instala as dependências
npm run dev        # servidor de desenvolvimento → http://localhost:5173
npm run build      # build de produção em dist/
npm run preview    # serve o dist/ com os MESMOS headers de segurança do vercel.json → http://localhost:4173
npm run lint       # ESLint
npm run check      # lint + build (rode antes de abrir PR)
```

## Estrutura

```
├─ public/                    # copiado como está para o dist/
│  ├─ img/                    # imagens self-hosted (brand, screens, avatars, blog)
│  ├─ scripts/auth-guard.js   # guarda síncrono do dashboard (sem sessão → /auth)
│  ├─ robots.txt
│  └─ sitemap.xml
├─ src/
│  ├─ index.html              # landing         → /
│  ├─ auth.html               # login/registro  → /auth
│  ├─ dashboard.html          # área logada     → /dashboard
│  ├─ styles/                 # global.css + CSS por página
│  └─ js/
│     ├─ core/                # config (env), api (HTTP), session, auth
│     ├─ components/          # peças de UI compartilhadas
│     ├─ pages/               # um entry point por página
│     └─ utils/               # dom/sanitização, máscaras
├─ vercel.json                # rotas limpas, redirects, headers de segurança e cache
└─ vite.config.js
```

## Variáveis de ambiente

Copie `.env.example` para `.env.local` (não versionado). Na Vercel, configure em *Settings → Environment Variables*.

| Variável | Padrão | Uso |
|---|---|---|
| `VITE_API_URL` | `https://movt-backend.vercel.app/api` | Base da API. HTTPS obrigatório; HTTP só para `localhost` no `npm run dev`. |
| `VITE_SITE_URL` | `https://movt.app` | URL pública (canonical e Open Graph). |

> Tudo que começa com `VITE_` vai para o JavaScript público. **Nunca** coloque segredos nessas variáveis.

A URL da API é definida **apenas no build**. Não existe override em runtime (`localStorage`, query string), para impedir que um script injetado ou um golpe de "cole isso no console" desvie login e token para outro servidor.

## Segurança

Os headers ficam em [`vercel.json`](vercel.json):

- **Content-Security-Policy**: só scripts do próprio domínio (sem inline), fontes Google/Fontshare e chamadas apenas para `movt-backend.vercel.app`. Também bloqueia iframe (`frame-ancestors 'none'`).
- **HSTS** (2 anos, `preload`), `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` e `COOP`.
- `/auth` e `/dashboard` saem com `noindex` e `Cache-Control: no-store`.

Regras ao mexer no código:

1. **Trocou o host da API?** Atualize o `connect-src` da CSP no `vercel.json`.
2. **Nada de `<script>` inline nem `onclick=`**: a CSP bloqueia. Use arquivos em `src/js/`.
3. **Todo dado vindo da API em `innerHTML` passa por `esc()`**, e URLs de imagem passam por `safeUrl()` (`src/js/utils/dom.js`). Para texto puro, prefira `textContent`.
4. Valide com `npm run preview` e confira se o console não mostra violações de CSP.

### Pendências no backend (outro repositório)

- **Sessão em `localStorage`**: o token pode ser lido por qualquer script da página. O ideal é migrar para cookie `HttpOnly; Secure; SameSite`, o que exige mudanças no `movt-backend`.
- **CORS**: o domínio do site (ex.: `https://movt.app` e `https://www.movt.app`) precisa estar em `CORS_ORIGINS` no backend.
- **Política de senha**: o front exige no mínimo 6 caracteres. A regra real precisa ser aplicada no backend.

## Deploy (Vercel + Registro.br)

1. Importe o repositório na Vercel. O `vercel.json` já define o framework (Vite), o build e o `dist/`.
2. Configure `VITE_API_URL` e `VITE_SITE_URL` em *Environment Variables*.
3. Em *Settings → Domains*, adicione `movt.app` e `www.movt.app`.
4. No Registro.br (*DNS → Editar zona*), crie os registros que a Vercel mostrar. Normalmente são:
   - `A` em `@` apontando para o IP indicado pela Vercel
   - `CNAME` em `www` apontando para o alvo indicado pela Vercel
5. Adicione os domínios em `CORS_ORIGINS` do backend.
