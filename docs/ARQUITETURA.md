# Arquitetura

Visão geral de como o Bah!Flow é organizado, do diretório à requisição.
Para a documentação completa de endpoints, ver [`API.md`](API.md).

## Estrutura de pastas

```
.
├── app/                      # Next.js App Router
│   ├── api/                  # Rotas REST (route handlers)
│   ├── board/                # Quadro Kanban
│   ├── boards/               # Listagem de boards
│   ├── backlog/              # Backlog de um board
│   ├── list/                 # Visão lista
│   ├── timeline/             # Cronograma
│   ├── sprints/              # Sprints (filtro por projeto)
│   ├── timesheet/            # Time tracking agregado
│   ├── projects/             # Projetos (CRUD)
│   ├── teams/                # Equipes
│   ├── clients/              # Clientes
│   ├── filters/              # Saved filters
│   ├── reports/              # Relatórios
│   ├── inbox/                # Notificações
│   ├── my-tasks/             # Visão pessoal
│   ├── this-week/            # Tarefas da semana
│   ├── calendar/             # Calendário
│   ├── dashboard/            # Dashboard com métricas
│   ├── settings/             # Configurações + onboarding
│   ├── share/                # Páginas públicas (share-links)
│   ├── sign-in, sign-up/     # Páginas Clerk
│   ├── pending-approval/     # Tela de membro aguardando aprovação
│   ├── onboarding/           # Wizard pós-primeiro-login
│   ├── ticket/[id]/          # Detalhe do ticket
│   ├── layout.tsx            # Root layout (sidebar, providers)
│   └── globals.css           # Tokens CSS + base
├── components/               # Componentes React reutilizáveis
│   ├── ui/                   # Primitivos (Button, Modal, Toast, etc)
│   ├── board/                # Coluna, card, drag layer
│   ├── ticket/               # Detalhe, comentários, anexos
│   ├── settings/             # Telas de config (membros, roles, etc)
│   ├── editor/               # TipTap (rich text)
│   └── ...                   # 1 pasta por área
├── lib/                      # Lógica server-side
│   ├── db.ts                 # Pool pg + helpers + whitelist de colunas
│   ├── api-auth.ts           # getAuthMember + isAdmin (Clerk → DB)
│   ├── page-guards.ts        # requireAuth/Approved/Admin pra Server Components
│   ├── rbac.ts               # Roles em 3 níveis (org, project, board)
│   ├── access-check.ts       # hasTicketAccess (helper de autorização)
│   ├── ai.ts                 # OpenAI gpt-4.1-mini
│   ├── webhooks.ts           # Dispatch outbound (Slack/Discord/genérico)
│   ├── notifications.ts      # createNotification + extractMentions
│   ├── automations.ts        # Rules engine
│   ├── audit.ts              # logAudit (Postgres)
│   ├── recurring.ts          # cron-parser + render template
│   ├── share-links.ts        # Tokens p/ links públicos
│   ├── email.ts              # Resend
│   ├── whatsapp.ts           # Provider externo
│   ├── google-drive.ts       # Upload de anexos
│   ├── mongodb.ts            # Conexão Mongo (audit-trail)
│   ├── rate-limit.ts         # In-memory rate limiter
│   ├── validators.ts         # Schemas Zod
│   ├── supabase/             # Client + server (anon e service role)
│   ├── hooks/                # React hooks compartilhados
│   ├── types/                # Tipos compartilhados
│   └── utils/                # Helpers puros
├── db/                       # 44 migrations SQL idempotentes
├── e2e/                      # Playwright (3 specs + auth.setup)
├── tests/                    # Vitest (unitários)
├── public/                   # Estáticos + favicons
├── scripts/                  # Utilitários (backup, etc)
├── supabase/                 # Migrations Supabase (realtime)
├── middleware.ts             # Clerk middleware + headers de segurança
├── sentry.client/server/edge.config.ts
├── Dockerfile                # Multi-stage standalone
└── tailwind.config.ts        # Tokens em CSS vars
```

## Fluxo de autenticação

```
Browser ──► Clerk SDK (cookie JWT)
                │
                ▼
       middleware.ts (clerkMiddleware)
                │   protege tudo exceto /sign-in, /sign-up, /api/webhooks/*, /share/*
                ▼
        Server Component / Route handler
                │
                ▼
       lib/api-auth.ts → getAuthMember()
                │
                │  1. auth().userId   (Clerk)
                │  2. SELECT em members WHERE clerk_user_id = $1
                │  3. Se não existir → cria member + cria approval_request 'org_access'
                │  4. Atualiza avatar do Clerk em background
                ▼
       AuthMember { id, workspace_id, role, is_approved, can_track_time, ... }
```

Em **Server Components**, use os helpers de `lib/page-guards.ts`:

| Helper | Comportamento |
|--------|---------------|
| `requireAuth()` | Não autenticado → `/sign-in`. |
| `requireApproved()` | Pendente de aprovação → `/pending-approval`. Admin/owner sempre passam. |
| `requireAdmin()` | Não admin → `/my-tasks`. |

Em **Route handlers** (`app/api/.../route.ts`), use `getAuthMember()` direto.
Validações típicas:

```ts
const auth = await getAuthMember();
if (!auth) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
if (!isAdmin(auth.role)) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
```

Quando o endpoint precisa validar acesso a um ticket específico,
usa-se `hasTicketAccess(auth, ticketId)` (`lib/access-check.ts`), que
considera as 3 camadas de RBAC + bypass de admin.

## RBAC

Três níveis de papel, com **herança** (board ← project ← org):

| Tabela | Escopo | Roles |
|--------|--------|-------|
| `org_roles` | workspace inteiro | `owner`, `admin`, `member`, `viewer` |
| `project_roles` | um projeto | `admin`, `member`, `viewer` |
| `board_roles` | um board | `admin`, `member`, `viewer` |

Hierarquia numérica (em `lib/rbac.ts`): `owner=4`, `admin=3`, `member=2`,
`viewer=1`. Função `canAccess(memberId, level, id, minRole, options?)`
retorna o role mais alto encontrado no nível pedido (com fallback p/
níveis acima na hierarquia) e compara com `minRole`.

Outras flags em `members`:

- `is_approved` — gate de acesso. Falso = redireciona pra `/pending-approval`.
- `can_track_time` — admin pode liberar tracking pra um membro
  específico sem promovê-lo (migration 038).
- `is_client` — distingue cliente externo de staff interno.

Owner/admin **bypass** quase todos os checks de role e visibilidade.

## Fluxo de aprovação de membros

```
Novo usuário sign-up no Clerk
        │
        ▼
clerkMiddleware atinge página protegida
        │
        ▼
getAuthMember() detecta member inexistente → cria com is_approved=false
        │   + INSERT em approval_requests (type='org_access')
        ▼
Página detecta is_approved=false → redirect /pending-approval
        │
Admin abre /settings/approvals
        │   PATCH /api/approvals { id, action: 'approve', role, projects: [...] }
        ▼
approval.type === 'org_access':
  - INSERT/UPSERT em org_roles (role pedido)
  - UPDATE members SET is_approved = true
  - Multi-projects: array de { project_id, role } em project_roles
  - Opcional: board_id concede board_role
  - Fire-and-forget: sendWelcomeEmail() via Resend
```

Outros tipos de aprovação:

- `project_creation` — usuário não-admin tenta criar projeto.
  Aprovação cria projeto + board + sprint "01 <NOME>" + dá `project_role=admin` ao requester.
- `project_access` / `board_access` — pedido de acesso a recurso específico.

## Fluxo de IA

`lib/ai.ts` envolve `OpenAI` com modelo padrão `gpt-4.1-mini`
(override via `OPENAI_MODEL`). Funções:

- `generateTicketDescription(title, context?)` — markdown estruturado.
- `suggestTicketAttributes(title, description)` — `{priority, labels[]}`.
- `suggestPriority(title, description)` — `{priority, reasoning}` com sinais explícitos.
- `summarizeThread(comments[])` — resumo de 2-3 frases.

Endpoints correspondentes em `/api/ai/*` (ver [`API.md`](API.md#ai)).

### Chat SQL admin (`/api/ai/chat`)

Admin only. O OpenAI gera SQL que o servidor **valida e executa** com
restrições rígidas:

1. Apenas `SELECT` (regex bloqueia `INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE|EXECUTE`).
2. Tabelas/views permitidas: `tickets_full`, `tickets`, `projects`,
   `members`, `sprints`, `statuses`, `services`, `categories`,
   `ticket_types`, `board_roles`, `project_roles`.
3. `LIMIT 100` injetado se ausente.
4. Rate limit 30 req/min por usuário.

A resposta inclui `sql` executado + `rows` + `explanation` em PT-BR.

## Webhooks

### Saída (`lib/webhooks.ts`)

Tabela `webhook_subscriptions` (`url`, `secret`, `events[]`, `is_active`).
Após eventos como `ticket.created`, `ticket.updated`, `ticket.completed`,
`ticket.assigned`, `comment.created`, `sprint.started`, `sprint.completed`
o servidor faz `dispatchWebhook(event, data)` que:

1. Busca subscriptions ativas inscritas no evento.
2. Detecta o tipo pela URL:
   - `hooks.slack.com/services/...` → payload Slack (text + blocks).
   - `discord(app).com/api/webhooks/...` → payload Discord (content + embeds).
   - Genérico → `{event, data, timestamp}` + header `X-Webhook-Secret` se houver.
3. POST `fire-and-forget` (não bloqueia a request).

### Entrada

| Endpoint | Origem | Auth |
|----------|--------|------|
| `POST /api/webhooks/github` | GitHub repo webhook | HMAC-SHA256 com `GITHUB_WEBHOOK_SECRET` validada com `crypto.timingSafeEqual`. Eventos: `pull_request`, `push`, `issues`. Extrai chaves `[PREFIX-123]` do título/branch/commit e popula `github_links`. |
| `POST /api/webhooks/clerk` | Clerk Dashboard | Headers `svix-*` validados (timestamp anti-replay 5min). Eventos: `user.created/updated/deleted` — sincroniza members. |
| `POST /api/webhooks` | Webhook genérico admin | Header `X-Webhook-Secret` validado com `WEBHOOK_SECRET`. |

## Cron (recurring tickets)

Tabela `recurring_tickets` guarda `cron_expression`, `next_run_at`,
`last_run_at`, `title_template`, e os defaults do ticket gerado
(project, board, type, service, assignee, priority).

`POST /api/cron/recurring-tickets` (também aceita GET pra Vercel Cron):

- Auth via header `x-cron-secret` ou `Authorization: Bearer ...` =
  `CRON_SECRET`. Em dev sem `CRON_SECRET` o endpoint passa
  (loud-fail em prod).
- Pega até 100 recurrings com `is_active=true AND next_run_at <= NOW()`.
- Pra cada um: cria o ticket (com `title` renderizado por
  `renderTitleTemplate`), recalcula `next_run_at` via
  `cron-parser` (timezone `CRON_TZ`, default `America/Sao_Paulo`),
  atualiza `last_run_at`.
- Em erro, ainda avança `next_run_at` pra evitar loop quente.

Configure em EasyPanel/Vercel Cron pra bater no endpoint a cada 1min ou 5min.

## Audit log

Dois subsistemas independentes:

1. **`audit_log` (Postgres, migration 040)** — eventos administrativos
   importantes (`project.created/updated/archived`, `member.role_changed`,
   `automation.created`, `share_link.created`, `recurring_ticket.created`,
   `workspace.onboarded`, ...). Endpoint `GET /api/audit-log` (admin).
   Helper `logAudit({ workspaceId, actorId, action, entityType, entityId, changes, ipAddress, userAgent })`.
2. **`audit-trail` (MongoDB, opcional)** — histórico granular de mudanças
   em tickets/projects (snapshots). Endpoints `GET/POST /api/audit-trail`.
   Conexão lazy via `MONGODB_URI`; se não estiver configurado, o módulo
   não bloqueia.

## Decisões de design

### Por que sem ORM
A complexidade de queries (joins múltiplos com `tickets_full`, `org_roles`,
`project_roles`, `board_roles`, agregações) pesa contra a ergonomia de um
ORM. SQL puro deixa as queries explícitas, performance controlável e
permite usar features avançadas do Postgres (CTEs, `FILTER`,
`MAKE_INTERVAL`, `to_char`). `lib/db.ts` mantém uma whitelist de colunas
(`ALLOWED_COLUMNS`) pra prevenir SQL injection em updates dinâmicos.

### Por que sem Redux
O state é majoritariamente **server state** (tickets, boards, etc).
Hidratamos via Server Components / fetch direto e revalidamos com
`router.refresh()`. UI state local fica em `useState`/`useReducer`.
Realtime de notificações usa Supabase channel direto, sem store global.

### Por que Newsreader serif
A escolha tipográfica (Newsreader serif para headers + grotesque sans
para UI) faz parte do "editorial style" — referência Linear/Vercel/Stripe
pra dar peso visual sem perder densidade. Tokens em CSS vars
(`globals.css`) permitem trocar tema claro/escuro sem rebuilds.

### Por que migrations idempotentes
Em produção (EasyPanel, sem ferramenta de migration formal), rodamos
manualmente. `IF NOT EXISTS` + `DO $$ BEGIN ... EXCEPTION WHEN
duplicate_object THEN NULL; END $$` permite reaplicar a sequência inteira
sem quebrar. Detalhes em [`MIGRATIONS.md`](MIGRATIONS.md).

### Por que recipient_id + COALESCE em notifications
A tabela tinha colunas legadas (`member_id`) que viraram
`recipient_id` + `actor_id` (migration 030). Pra não quebrar dados
antigos, queries usam `COALESCE(recipient_id, member_id)`. Migration 037
relaxou os `NOT NULL` legados.

### Por que Optimistic Concurrency Control opcional em tickets
PATCH em `/api/tickets/[id]` aceita `_updated_at` no body. Se informado,
valida contra o `updated_at` do banco antes de gravar — útil pra evitar
last-write-wins em edição simultânea.
