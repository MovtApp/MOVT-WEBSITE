# MOVT Website

Site do MOVT: landing page, login/registro, dashboard web do usuário e páginas jurídicas.

- **Front-end:** HTML, CSS e JavaScript puros (ES modules), empacotados com [Vite](https://vite.dev).
- **BFF (`api/`):** camada de servidor do site (Vercel Function). Fica entre o navegador e o `MOVT-BACKEND` e **não tem acesso ao banco de dados**.
- **Deploy:** Vercel; domínio registrado no Registro.br.

```
Navegador ──cookie HttpOnly──► api/ (BFF, Vercel) ──Bearer + IP assinado──► MOVT-BACKEND ──► Postgres
            sem token no JS     valida · filtra · limita                    único dono do banco
```

## Requisitos

- Node.js 20.19 ou superior

## Comandos

```bash
npm install          # instala as dependências
npm run dev          # site + BFF em http://localhost:5173
npm run build        # build de produção em dist/
npm run preview      # serve o dist/ + BFF com os MESMOS headers de segurança do vercel.json → http://localhost:4173
npm run lint         # ESLint
npm test             # testes de segurança do BFF (backend falso, nada toca a produção)
npm run check        # lint + testes + build (rode antes de abrir PR)
npm run sync:legal   # regenera /termos e /privacidade a partir das telas do app (../MOVT)
```

> Alterações em `api/` exigem reiniciar o `npm run dev`.

## Estrutura

```
├─ api/                       # BFF (servidor). Só index.js vira função; "_" = interno
│  ├─ index.js                # entrada da Vercel Function (todas as rotas /api/*)
│  └─ _lib/
│     ├─ app.js               # roteador + cadeia de segurança
│     ├─ routes.js            # allowlist de rotas e handlers
│     ├─ guards.js            # IP do cliente, origem, CSRF, sessão
│     ├─ schemas.js           # validação de entrada (Zod)
│     ├─ sanitize.js          # minimização de dados das respostas (LGPD)
│     ├─ upstream.js          # chamadas ao MOVT-BACKEND
│     ├─ crypto.js            # AES-256-GCM, HMAC, comparação em tempo constante
│     ├─ cookies.js · http.js · rate-limit.js · log.js · env.js
├─ public/                    # copiado como está para o dist/
│  ├─ img/                    # imagens self-hosted
│  ├─ scripts/auth-guard.js   # guarda síncrono do dashboard
│  └─ robots.txt · sitemap.xml
├─ src/
│  ├─ index.html · auth.html · dashboard.html
│  ├─ termos.html · privacidade.html   # GERADOS por npm run sync:legal
│  ├─ styles/                 # global · auth · dashboard (casca) · dashboard-views (telas)
│  └─ js/ core/ · components/ · pages/ · utils/
│     └─ pages/dashboard/      # painel: index (entrada) · router · store · ui · views/
├─ scripts/                   # sync-legal.mjs + template
├─ tests/                     # testes de segurança do BFF
├─ vercel.json                # rotas, rewrite /api, headers de segurança e cache
└─ vite.config.js             # monta o BFF no dev/preview
```

## Telas do painel

Cada item do sidebar é uma tela própria. Todas as URLs servem o mesmo `dashboard.html` (rewrite no `vercel.json` e no `vite.config.js`) e o roteador do navegador (`js/pages/dashboard/router.js`) troca só o conteúdo, sem recarregar a página.

| URL | Tela |
|---|---|
| `/dashboard` | Início: visão geral com "Ver mais" em cada bloco |
| `/dashboard/treinos` | Catálogo e treinos do dia (`?aba=hoje&tipo=yoga&nivel=Iniciante&q=...`) |
| `/dashboard/agenda` | Calendário + sessões; cancelar (`?aba=historico&dia=AAAA-MM-DD`) |
| `/dashboard/plano` | Assinatura, uso dos limites e planos; assinar e portal da Stripe |
| `/dashboard/comunidade` | Perfil, feed (curtir), meus posts e comunidades (`?aba=posts`) |

**Baixar app:** todo link do painel para `/#download` abre um modal com App Store e Google Play, cada um com QR code gerado no navegador. Os links ficam em `STORES` (`src/js/core/config.js`); loja com link vazio aparece como "Em breve".

Tela nova: crie `views/<nome>.js` exportando `{ title, eyebrow, render(el, ctx) }`, registre em `pages/dashboard/index.js` e adicione o link no sidebar do `dashboard.html`. Use `ctx.signal` em todo `addEventListener` para os ouvintes morrerem ao sair da tela.

## Rotas do BFF

| Rota | O que faz |
|---|---|
| `GET /api/auth/session` | Estado da sessão + token CSRF |
| `POST /api/auth/login` · `register` · `logout` | Autenticação (o token fica só no cookie) |
| `POST /api/auth/recovery/request` · `verify` · `reset` | Recuperação de senha |
| `GET /api/me/trainings` · `training-filters` · `appointments` · `plan` · `stats` · `health` | Dados do painel, já filtrados |
| `GET /api/me/profile` · `posts` · `communities` · `billing` · `GET /api/feed` · `GET /api/plans` | Comunidade, assinatura e catálogo de planos |
| `POST /api/me/appointments/cancel` | Cancela uma sessão (o backend confere o dono) |
| `POST /api/feed/like` · `POST /api/me/communities/join` | Curtir post · entrar em comunidade |
| `POST /api/me/billing/checkout` · `portal` | Abre o checkout ou o portal da Stripe |

Qualquer outro caminho em `/api` responde 404. Não existe proxy aberto para o backend.

## Variáveis de ambiente

Veja [`.env.example`](.env.example). Localmente, use `.env.local` (não versionado). Na Vercel, configure em *Settings → Environment Variables* para **Production e Preview**.

| Variável | Onde | Obrigatória na Vercel | Uso |
|---|---|---|---|
| `UPSTREAM_API_URL` | servidor | não (padrão: produção) | URL do MOVT-BACKEND |
| `BFF_SESSION_KEY` | servidor | **sim** | Chave AES-256 do cookie de sessão (32 bytes base64) |
| `BFF_PROXY_SECRET` | servidor + backend | **sim** | Assina o IP real do usuário para o backend |
| `ALLOWED_ORIGINS` | servidor | não | Origens extras aceitas (ex.: `https://www.movt.app`) |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | servidor | não | Rate limit global entre instâncias |
| `VITE_SITE_URL` | navegador | não | Canonical e Open Graph |

Sem `BFF_SESSION_KEY` ou `BFF_PROXY_SECRET`, o BFF na Vercel **recusa todas as requisições** com 503 (fail closed). Localmente, ele gera uma chave temporária.

## Segurança

| Camada | Proteção |
|---|---|
| Sessão | Token em cookie `__Host-` · `HttpOnly` · `Secure` · `SameSite=Strict`, cifrado com AES-256-GCM. Nenhum script da página consegue ler o token. |
| CSRF | Token double-submit + checagem de `Origin` em toda requisição que altera dados |
| Entrada | Schemas Zod estritos (campo extra = rejeitado), CPF/CNPJ com dígito verificador, idade ≥ 18, limite de 16 KB por corpo |
| Saída | Allowlist de campos por rota: CNPJ, IDs internos, UID do Supabase, e-mail do personal e anotações nunca chegam ao navegador |
| Anti-enumeração | Login e recuperação de senha respondem igual, exista ou não o e-mail |
| Força bruta | Rate limit por IP e por e-mail no BFF, além do que o backend já aplica |
| IDOR | `/api/me/stats`, `profile` e `posts` usam o ID da sessão cifrada, nunca um ID enviado pelo cliente; ações aceitam só IDs numéricos e o backend confere o dono |
| Ações do painel | CSRF + limite por sessão; limite do plano vira 402 e "sem permissão" vira 409, sem derrubar a sessão |
| Pagamento | O preço precisa existir no catálogo da Stripe; o BFF só devolve URLs HTTPS de `checkout.stripe.com` / `billing.stripe.com`; cobrança sai sem e-mail, CPF/CNPJ e do cartão só bandeira e final |
| Trusted proxy | O IP real do usuário vai ao backend assinado com HMAC (janela de 60s). Sem isso, o rate limit do backend viraria global e o registro de acesso (Marco Civil) gravaria o IP da Vercel. |
| Logs | JSON estruturado; senha, token, CPF e telefone são removidos; e-mail e IP são mascarados |
| Navegador | CSP `connect-src 'self'` (só fala com o próprio site), sem script inline, HSTS, `frame-ancestors 'none'` |
| Privacidade | Nenhum dado pessoal no `localStorage` (versões antigas são limpas automaticamente) |

Regras ao mexer no código:

1. **Rota nova no BFF:** adicione em `routes.js` com schema Zod para a entrada e um sanitizador para a saída. Depois escreva o teste.
2. **Nada de `<script>` inline nem `onclick=`:** a CSP bloqueia.
3. **Dados da API em `innerHTML` passam por `esc()`, e URLs por `safeUrl()`.**
4. **Consentimento:** `CONSENT_VERSIONS` em `api/_lib/routes.js` precisa ser igual ao de `MOVT-BACKEND/lib/privacy.js`.

## Deploy (Vercel + Registro.br)

**Ordem obrigatória:**

1. **Backend primeiro:** faça o merge e o deploy da branch `feat/trusted-bff-proxy` do `MOVT-BACKEND` e configure lá:
   - `BFF_PROXY_SECRET`, com o mesmo valor que você vai usar no site
   - `CORS_ORIGINS` deixa de ser necessário para o site, porque o navegador não chama mais o backend
2. **Site:** na Vercel, configure `BFF_SESSION_KEY` e `BFF_PROXY_SECRET` (Production e Preview).
3. **Domínio:** em *Settings → Domains*, adicione `movt.app` e `www.movt.app`. No Registro.br (*DNS → Editar zona*), crie os registros A e CNAME que a Vercel mostrar.

Gerar os segredos:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```
