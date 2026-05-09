# API REST

Todas as rotas vivem em `app/api/**/route.ts`. Auth padrão é via cookie
do Clerk (`middleware.ts` protege tudo, exceto `/api/webhooks/*` e
`/share/*`). Endpoints abaixo estão agrupados por área de domínio.

Convenções:

- **Auth**: `público` | `autenticado` | `aprovado` | `admin` (admin/owner) | `cron` (header secret).
- Todos retornam JSON. Erros vêm como `{ error: string }` + status HTTP.
- Quando o body sai do schema esperado, retorna `400` com mensagem específica.
- `5xx` sempre vêm como `{ error: 'Erro interno' }` (detalhes só no log do servidor).

Sumário por área:

- [Auth](#auth)
- [Members](#members)
- [Projects](#projects)
- [Boards](#boards)
- [Sprints](#sprints)
- [Tickets](#tickets)
- [Subtasks](#subtasks)
- [Comments](#comments)
- [Time entries / Timesheet](#time-entries--timesheet)
- [Notifications](#notifications)
- [Approvals](#approvals)
- [Webhooks (entrada)](#webhooks-entrada)
- [Webhooks (saída — subscriptions)](#webhooks-saída--subscriptions)
- [Audit log](#audit-log)
- [AI](#ai)
- [Cron](#cron)
- [Onboarding](#onboarding)
- [Saved views / Saved filters](#saved-views--saved-filters)
- [Recurring tickets](#recurring-tickets)
- [Templates](#templates)
- [Diversos](#diversos)

---

## Auth

### `GET /api/auth/me`
- **Auth**: autenticado (retorna 401 se não estiver).
- **Response**:
  ```json
  {
    "authenticated": true,
    "member": {
      "id": "uuid",
      "display_name": "Paulo",
      "email": "x@y.com",
      "role": "admin",
      "is_approved": true,
      "can_track_time": true
    },
    "workspace_id": "uuid"
  }
  ```
- **Erros**: `401` (não autenticado), `500`.

---

## Members

Tabela `members` + `org_roles` + `project_roles` + `board_roles`.

### `GET /api/members`
Listagem básica usada por dropdowns. Em `/api/options?type=members`
existe variante com projeção mais leve para não-admins (sem email/phone).

### `GET /api/members/with-projects`
Lista com agregado de projetos onde cada membro tem acesso. Usado em
`Settings → Membros` (visão por linha + popover).

### `GET /api/members/grouped-by-project`
Mesma data agrupada por projeto. Usado em layouts alternativos.

### `GET /api/members/by-access`
Filtra membros por escopo de acesso — query params `?project_id=` ou
`?board_id=` retornam apenas membros com role naquele recurso.

### `GET /api/members/boards?member_id=<uuid>`
Lista boards onde um membro específico tem acesso.

### `POST /api/members/sync-clerk`
- **Auth**: admin.
- **Função**: força resync de todos os usuários do Clerk pra `members`,
  cria approval requests pendentes para usuários novos.
- **Response**: `{ synced, created, updated }`.

### `PATCH /api/members/role`
- **Auth**: admin.
- **Body**: `{ member_id, role: 'owner'|'admin'|'member'|'viewer' }`.
- **Função**: atualiza `org_roles`. Loga em `audit_log`.

### `PATCH /api/members/time-tracking`
- **Auth**: admin.
- **Body**: `{ member_id, can_track_time: boolean }`.
- **Função**: libera time tracking pra um membro sem promovê-lo a admin.

### `POST /api/members/assign-project`
- **Auth**: admin.
- **Body**: `{ member_id, project_id, role: 'admin'|'member'|'viewer' }`.
- **Função**: UPSERT em `project_roles`.

### `POST /api/members/assign-board`
- **Auth**: admin.
- **Body**: `{ member_id, board_id, role }`.
- **Função**: UPSERT em `board_roles`.

---

## Projects

### `GET /api/projects?member_id=<uuid>`
- **Auth**: autenticado.
- **Comportamento**: se `member_id` informado, filtra projetos onde o
  membro tem role (org/project/board). Sem `member_id`, retorna todos
  do workspace (uso interno).
- **Response**: `[{ id, name, prefix, description, color, board_count, ticket_count, ... }]`.

### `POST /api/projects`
- **Auth**: admin (`owner`/`admin`).
- **Body** (validado por Zod):
  ```json
  { "name": "Bug Tracker", "prefix": "BT", "description": "...", "color": "#3b82f6", "template_id": "uuid?" }
  ```
- **Comportamento especial**: se `requester_id` no body for um membro
  não-admin, em vez de criar diretamente, cria um `approval_request`
  do tipo `project_creation` e retorna `202 { pending: true, approval_id }`.
- **Side effects (quando criado)**: cria board default `"01 <NOME>"` +
  sprint ativa com mesmo nome. Loga em `audit_log`.

### `PATCH /api/projects`
- **Auth**: admin.
- **Body**: `{ id, name?, description?, color?, is_archived? }`.

### `DELETE /api/projects?id=<uuid>`
- **Auth**: admin.
- **Comportamento**: soft delete (`is_archived = true`).

---

## Boards

### `GET /api/boards?project_id=<uuid>&member_id=<uuid>`
- **Auth**: padrão middleware.
- **Comportamento**: aplica RBAC — admin/owner vê tudo, member vê só
  boards onde tem `board_role` ou `project_role`.

### `POST /api/boards`
- **Auth**: admin de projeto OU org admin.
- **Body**: `{ project_id, name, type?: 'kanban'|'scrum'|'simple', description? }`.
- **Side effect**: dá `board_role=admin` ao criador.

### `PATCH /api/boards`
- **Auth**: admin do board, do projeto OU da org.
- **Body**: `{ id, name?, description? }`.

### `DELETE /api/boards?id=<uuid>`
- **Auth**: admin org.

---

## Sprints

### `GET /api/sprints?project_id=<uuid?>`
- **Auth**: autenticado.
- **Response**: `[{ id, name, goal, start_date, end_date, is_active, is_completed, ticket_count, done_count, project_name, ... }]`.

### `POST /api/sprints`
- **Auth**: admin.
- **Body** (Zod): `{ name, goal?, start_date?, end_date?, project_id? }`.
- **Side effect**: cria board do tipo `scrum` no projeto.

### `PATCH /api/sprints`
- **Auth**: admin.
- **Body**:
  - `{ id, action: 'activate' }` — desativa outros do mesmo projeto + ativa este.
  - `{ id, action: 'complete' }` — fecha sprint, move tickets não-feitos para o próximo (mesmo projeto, ordem de criação) ou pro backlog se não houver.
  - `{ id, name?, goal?, start_date?, end_date?, project_id? }` — update genérico.

### `DELETE /api/sprints?id=<uuid>`
- **Auth**: admin.
- **Erros**: `409` se houver ticket associado.

### `GET /api/sprints/[id]/burndown`
- **Auth**: autenticado.
- **Response**: série temporal `{ date, remaining, ideal }` para o gráfico.

---

## Tickets

### `GET /api/tickets?page=&limit=`
- **Auth**: autenticado.
- **RBAC**: não-admin vê apenas tickets de projetos/boards onde tem role.
- **Comportamento**:
  - Sem `page` → retorna `array` direto (compat board view).
  - Com `page` → retorna `{ data, pagination: { page, limit, total } }` (limit max 200).
- **Response (sumarizado)**: `[{ id, title, due_date, status, service, assignee }]`.

### `POST /api/tickets`
- **Auth**: autenticado.
- **Body** (Zod `createTicketSchema`):
  ```json
  {
    "title": "...", "description": "...", "priority": "medium",
    "ticket_type_id": "uuid?", "status_id": "uuid?", "service_id": "uuid?",
    "category_id": "uuid?", "assignee_id": "uuid?", "reporter_id": "uuid?",
    "due_date": "2026-05-09", "parent_id": "uuid?", "sprint_id": "uuid?",
    "client_id": "uuid?", "project_id": "uuid?", "board_id": "uuid?",
    "workspace_slug": "slug?"
  }
  ```
- **Side effects**:
  - Auto-set de `reporter_id` ao usuário atual.
  - Auto-resolve `project_id` a partir de `board_id` se faltar.
  - Inferência de project/board a partir do acesso do usuário.
  - `dispatchWebhook('ticket.created')`.
  - `runAutomations({ event: 'ticket.created' })`.
  - Notifica assignee se não for o próprio criador.

### `PATCH /api/tickets` (drag & drop)
- **Auth**: autenticado.
- **Body**: `{ id, status_key: 'todo'|'waiting'|'progress'|'done' }`.
- **Comportamento**: mapeia chave fuzzy para algum status existente
  (`UPPER(name) LIKE '%PADRÃO%'`) e atualiza. Se status é "is_done",
  popula `completed_at`.

### `GET /api/tickets/[id]`
- **Auth**: autenticado + `hasTicketAccess`.
- **Response**: payload completo de `tickets_full` view + agregados
  (subtask_count, total_time_minutes, parent_key, parent_title, ...).
- **Erros**: `403` (sem acesso), `404`.

### `PATCH /api/tickets/[id]`
- **Auth**: autenticado.
- **Body**: campos opcionais entre os whitelisted (`title`, `description`,
  `priority`, `due_date`, `status_id`, `assignee_id`, `reporter_id`,
  `service_id`, `category_id`, `sprint_id`, `ticket_type_id`,
  `parent_id`, `client_id`, `project_id`, `board_id`).
  Aceita `_updated_at` opcional para OCC (Optimistic Concurrency).
- **Side effects**: webhook `ticket.updated`; notifica novo assignee;
  dispara automations `ticket.status_changed` / `ticket.assigned`
  conforme mudanças detectadas.

### `DELETE /api/tickets/[id]`
- **Auth**: admin.

### `POST /api/tickets/bulk`
- **Auth**: autenticado (filtra IDs via `hasTicketAccess`).
- **Body**: `{ ids: string[], action: 'archive'|'move'|'assign'|'priority', status_id?, assignee_id?, priority? }`.
- **Response**: `{ updated, skipped }`.

### `POST /api/tickets/bulk-assign`
- **Auth**: admin.
- **Body**: `{ ticket_ids: string[], assignee_id: string|null }`.

### `POST /api/tickets/sync-project`
- **Auth**: admin.
- **Função**: para tickets órfãos (`project_id IS NULL`), tenta
  preencher a partir do `board.project_id`.

### `GET /api/tickets/search?q=<texto>&limit=`
- **Auth**: autenticado.
- **Comportamento**: busca full-text no `title`/`description` respeitando RBAC.

---

## Subtasks

### `GET /api/subtasks?ticket_id=<uuid>`
- **Auth**: autenticado + `hasTicketAccess`.
- **Response**: `[{ id, title, is_completed, position, ... }]`.

### `POST /api/subtasks`
- **Body**: `{ ticket_id, title }`.

### `PATCH /api/subtasks`
- **Body**: `{ id, title?, is_completed?, position? }`.

### `DELETE /api/subtasks?id=<uuid>`

---

## Comments

### `GET /api/comments?ticket_id=<uuid>`
- **Auth**: autenticado + `hasTicketAccess`.
- **Response**: `[{ id, body, created_at, updated_at, author_id, author_name, author_email, author_avatar }]`.

### `POST /api/comments`
- **Body** (Zod): `{ ticket_id, content }`.
- **Side effects**:
  - Webhook `comment.created`.
  - Detecção de `@menções` (`extractMentions` matching por `display_name LIKE`).
    Cria notificação por menção (deduplicada por target).

### `PATCH /api/comments`
- **Auth**: autor OU admin.
- **Body**: `{ id, content }`.

### `DELETE /api/comments?id=<uuid>`
- **Auth**: autor OU admin.

### `GET /api/comment-reactions?comment_id=<uuid>`
### `POST /api/comment-reactions` `{ comment_id, emoji }`
### `DELETE /api/comment-reactions?id=<uuid>`

### `GET /api/quick-reactions`
Lista de emojis configurados como atalhos rápidos.
### `POST /api/quick-reactions` (admin) `{ emoji, label, position }`

---

## Time entries / Timesheet

### `GET /api/time-entries?ticket_id=<uuid>`
- **Auth**: autenticado + `hasTicketAccess`.
- **Comportamento**: não-admin vê apenas as próprias entradas.

### `POST /api/time-entries`
- **Body**:
  - `{ ticket_id, action: 'start' }` — para qualquer timer rodando no ticket e cria nova entry com `is_running=true`.
  - `{ ticket_id, action: 'stop' }` — encerra timer atual (mín 1min, `CEIL` da diferença em minutos).
  - `{ ticket_id, action: 'log', duration_minutes, description?, is_billable? }` — log manual.

### `PATCH /api/time-entries`
- **Auth**: autor da entry OU admin.
- **Body**: `{ id, description?, duration_minutes?, is_billable? }`.
- Não permite editar entry com `is_running=true`.

### `DELETE /api/time-entries?id=<uuid>`
Bloqueia se `is_running=true`.

### `GET /api/timesheet?period=<dias>&project_id=<uuid?>&board_id=<uuid?>`
- **Auth**: admin OU `can_track_time=true`.
- **Response**: `{ entries: [...], summary: [{ member_name, total_minutes, billable_minutes, non_billable_minutes, entry_count }] }`.

### `GET /api/time-logs`
Listagem alternativa, agrupada por dia/semana — usada em relatórios.

---

## Notifications

### `GET /api/notifications?unread_only=&limit=`
- **Auth**: autenticado.
- **Response**: notificações apenas do `recipient_id` do usuário (limit max 100).

### `PATCH /api/notifications`
- Sem `id` → marca **todas** as do usuário como lidas.
- `?id=<uuid>` ou body `{ id }` → marca específica como lida.
- Body `{ action: 'read_all' }` — compat legado.

### `POST /api/notifications/test`
- **Auth**: admin.
- **Função**: cria uma notificação de teste para o próprio usuário.
  Útil para diagnóstico do canal Supabase realtime.

---

## Approvals

### `GET /api/approvals?status=pending|approved|rejected`
- **Auth**: padrão (UI de admin chama).
- **Response**: lista enriquecida com nomes de requester, reviewer, board e project.

### `POST /api/approvals`
- **Body**: `{ type: 'org_access'|'project_access'|'board_access'|'project_creation', request_data: {...}, requester_id }`.
- **Erros**: `409` se já houver pedido pendente do mesmo tipo.

### `PATCH /api/approvals`
- **Auth**: admin.
- **Body**: `{ id, action: 'approve'|'reject', reviewer_note?, board_id?, project_id?, role?, projects?: [{project_id, role}] }`.
- **Side effects** (quando `approve`):
  - `org_access` → cria `org_role`, marca `is_approved=true`, envia welcome email (Resend, fire-and-forget), opcionalmente atribui múltiplos projetos.
  - `project_access` / `board_access` → upsert em `project_roles` / `board_roles`.
  - `project_creation` → cria projeto + board "01 <NOME>" + sprint ativa + dá `project_role=admin` ao requester.

---

## Webhooks (entrada)

> Estes endpoints estão em `isPublicRoute` (sem Clerk). A autenticação é por
> assinatura HMAC ou secret no header.

### `POST /api/webhooks/github`
- **Auth**: header `x-hub-signature-256` validado com `GITHUB_WEBHOOK_SECRET` via `crypto.timingSafeEqual`. Se a env não estiver setada, aceita sem validar (modo dev).
- **Eventos suportados**:
  - `pull_request` — extrai `[PREFIX-NUM]` de `title`/`body`/`head.ref` e popula `github_links` (state: `open`/`closed`/`merged`).
  - `push` — extrai `[PREFIX-NUM]` de cada commit e popula `github_links` (`type='commit'`).
  - `issues` — popula `github_links` (`type='issue'`).
- **Response**: `{ ok: true }` mesmo quando não casa nenhum ticket (evita retry).

### `POST /api/webhooks/clerk`
- **Auth**: headers `svix-signature`, `svix-timestamp`, `svix-id` validados se `CLERK_WEBHOOK_SECRET` setado. Timestamp anti-replay 5min.
- **Eventos**: `user.created`, `user.updated`, `user.deleted` — sincroniza members + cria `approval_request` pra novos usuários.

### `POST /api/webhooks`
Webhook genérico admin — header `X-Webhook-Secret` validado com `WEBHOOK_SECRET`.

---

## Webhooks (saída — subscriptions)

### `GET /api/webhook-subscriptions`
### `POST /api/webhook-subscriptions`
- **Body**: `{ url, secret?, events: ['ticket.created', ...] }`.
- Slack/Discord são detectados pela URL e formatados automaticamente.

### `PATCH /api/webhook-subscriptions` `{ id, is_active?, events?, url?, secret? }`
### `DELETE /api/webhook-subscriptions?id=<uuid>`

Eventos disparados pelo backend:
`ticket.created`, `ticket.updated`, `ticket.completed`, `ticket.assigned`,
`comment.created`, `sprint.started`, `sprint.completed`.

---

## Audit log

### `GET /api/audit-log?entity_type=&entity_id=&action=&page=&limit=`
- **Auth**: admin.
- **Response**: `{ data: [...], pagination: { page, limit, total, has_more } }`.
- Se a tabela ainda não existe (migration 040 não aplicada), responde
  com `[]` + `warning`.

### `GET /api/audit-trail?entity_type=&entity_id=`
Histórico granular do MongoDB. Retorna `[]` se Mongo não configurado.

### `POST /api/audit-trail`
Insert manual no Mongo (uso interno, raramente chamado pelo client).

### `GET /api/access-logs`
Lista de acessos a share-links (anônimos).
### `POST /api/access-logs` (uso interno por `/share/...`).

### `GET /api/activity-log` / `GET /api/activity` / `GET /api/changelog`
Feeds derivados (Activity feed do dashboard, changelog público).

---

## AI

> Todos requerem `OPENAI_API_KEY`. Modelo via `OPENAI_MODEL` (default `gpt-4.1-mini`).

### `POST /api/ai/generate-description`
- **Auth**: autenticado.
- **Body**: `{ title, context? }`.
- **Response**: `{ description: "markdown..." }`.

### `POST /api/ai/suggest-attributes`
- **Body**: `{ title, description }`.
- **Response**: `{ priority: 'urgent'|'high'|'medium'|'low', labels: string[] }`.

### `POST /api/ai/suggest-priority`
- **Body**: `{ title, description }`.
- **Response**: `{ priority, reasoning: 'frase em PT-BR' }`.

### `POST /api/ai/summarize-thread`
- **Body**: `{ comments: string[] }`.
- **Response**: `{ summary: "..." }`.

### `POST /api/ai/chat`
- **Auth**: admin.
- **Rate limit**: 30 req/min por usuário.
- **Body**: `{ message: string, history?: [{role, content}] }`.
- **Comportamento**: a IA responde com texto puro OU com JSON
  `{sql, explanation}`. Se for SQL, o servidor valida (apenas SELECT,
  whitelist de tabelas, força `LIMIT 100`) e executa.
- **Response**:
  - `{ type: 'text', text }` — resposta conversacional.
  - `{ type: 'sql', sql, explanation, rows, rowCount }` — resultado da query.
  - `{ type: 'sql_error', sql, explanation, error }` — SQL inválido.

---

## Cron

### `POST /api/cron/recurring-tickets` (também aceita `GET`)
- **Auth**: header `x-cron-secret` ou `Authorization: Bearer ...` =
  `CRON_SECRET`. Em dev sem secret, passa.
- **Função**: processa até 100 recurrings com `is_active=true AND next_run_at <= NOW()`. Pra cada um cria o ticket, recalcula `next_run_at` (via `cron-parser` no fuso `CRON_TZ`, default `America/Sao_Paulo`), atualiza `last_run_at`. Em erro, ainda avança `next_run_at` pra evitar loop quente.
- **Response**:
  ```json
  { "ok": true, "processed": 5, "created": 4, "errors": 1, "details": {...}, "ran_at": "2026-05-09T20:00:00.000Z" }
  ```

---

## Onboarding

### `POST /api/onboarding/complete`
- **Auth**: admin.
- **Função**: marca `workspaces.onboarded_at = NOW()`. Idempotente
  (faz `ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS onboarded_at` antes).
  Loga em `audit_log`.

---

## Saved views / Saved filters

### `GET /api/saved-views`
- **Auth**: autenticado.
- **Response**: views próprias + views compartilhadas (`is_shared=true`) do workspace.

### `POST /api/saved-views`
- **Body**: `{ name, icon?, scope?: 'board'|'list'|..., filters: object, is_shared?: boolean }`.
- Apenas admin pode marcar `is_shared=true`.

### `DELETE /api/saved-views?id=<uuid>`
- Dono OU admin.

### `GET/POST/PATCH/DELETE /api/filters`
Filtros nomeados (legado — antecede saved-views). Mesma ideia: persistir
combinação de filtros para reutilizar. CRUD básico.

---

## Recurring tickets

### `GET /api/recurring-tickets`
- **Auth**: autenticado.
- **Response**: lista enriquecida com nomes de project, board, type, service, assignee.

### `POST /api/recurring-tickets`
- **Auth**: admin.
- **Body**: `{ name, title_template, cron_expression, project_id?, board_id?, description_html?, ticket_type_id?, service_id?, assignee_id?, priority? }`.
- **Validação**: `cron_expression` validada via `cron-parser`. Calcula `next_run_at`.

### `PATCH /api/recurring-tickets`
- **Auth**: admin.
- **Body**: `{ id, ...campos }`. Se `cron_expression` muda, recalcula `next_run_at`.

### `DELETE /api/recurring-tickets?id=<uuid>` (admin)

### `POST /api/recurring-tickets/run-now`
- **Auth**: admin.
- **Body**: `{ id }`.
- **Função**: força a criação do ticket agora (sem mexer em `next_run_at`).

### `GET /api/ticket-templates` / `POST /api/ticket-templates`
CRUD de templates de ticket reutilizáveis.

---

## Templates

### `GET /api/templates`
- **Auth**: autenticado.
- **Response**: `[{ id, name, description, config, is_system, created_at }]` ordenado por `is_system DESC, name`.
- Templates de **projeto** — usados no setup inicial.

---

## Diversos

### `GET /api/options?type=<tipo>&project_id=<uuid?>`
Endpoint utilitário — uma chamada serve dropdowns inteiros.
- **Tipos suportados**: `statuses`, `services`, `members`, `categories`,
  `sprints`, `ticket_types`, `clients`, `projects`, `boards`, `templates`.
- Para `members`, projeção depende do role: admin vê email/phone;
  outros veem só id/name/avatar/role.

### `GET /api/personal/counts`
Contadores rápidos pra badges da sidebar (Inbox, My Tasks, This Week).

### `GET /api/settings`
### `PATCH /api/settings` `{ key, value }`
Configurações do workspace. Admin only para writes.

### `GET/POST/PATCH/DELETE /api/clients`
CRUD de clientes. Admin para writes.
### `GET /api/clients/by-project?project_id=<uuid>`

### `GET/POST/PATCH/DELETE /api/teams` (admin para writes)

### `GET/POST/PATCH/DELETE /api/products` (admin)

### `GET/POST/PATCH/DELETE /api/organizations` (admin — workspaces secundários se houver multi-tenant)

### `GET/POST /api/roles` + `GET/POST /api/permissions` + `GET/POST /api/permission-groups` + `POST /api/role-permissions`
Sistema de permissões granulares (extensível, ainda admin-only).

### `GET/POST/PATCH/DELETE /api/dev-links`
Links externos vinculados a tickets (ex: branch, build).

### `GET/POST /api/github-links` (criação manual; auto-criação via `/api/webhooks/github`)

### `GET/POST/DELETE /api/share-links`
Tokens públicos para `/share/<token>`. Admin para criar/remover.

### `GET/POST/DELETE /api/access-links`
Links convite (deprecated em favor de Clerk invitations).

### `GET/POST/PATCH /api/automations`
CRUD de regras (rules engine) executadas em eventos de ticket.

### `GET/POST /api/attachments?ticket_id=<uuid>`
Lista anexos. Upload propriamente dito é multipart em `/api/attachments/upload`.
### `POST /api/attachments/upload` (multipart) → grava no Supabase Storage
ou Google Drive (depende da config) e cria registro em `attachments`.

### `GET /api/reports/tickets/summary?project_id=&period=`
Agregados pra dashboard de relatório.
### `GET /api/reports/tickets/csv?...` (CSV download).

### `GET /api/docs/spaces` / `GET /api/docs/folders` / `GET /api/docs/pages` (CRUDs)
Wiki interna (docs) — ver migration `018_docs_wiki.sql`.

### `GET/POST/PATCH/DELETE /api/ticket-links`
Vínculos entre tickets (blocks/duplicates/related).

### `GET /api/integrations/clockify` + `POST /api/integrations/clockify/sync`
Integração Clockify (importa entries).
### `GET/POST /api/integrations/whatsapp` + `GET/PATCH /api/integrations/whatsapp/preferences`
Disparo de notificações WhatsApp (provider externo via `WHATSAPP_API_URL`).
