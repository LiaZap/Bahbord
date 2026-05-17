# Backend — Arquitetura

## Visão Geral

- **Runtime**: Next.js 14 API Routes (serverless)
- **Database**: PostgreSQL via `pg` (raw queries com prepared statements)
- **Auth**: Clerk JWT → membro interno
- **Pattern**: RESTful, stateless, fire-and-forget side effects

---

## Acesso ao Banco (`lib/db.ts`)

```typescript
// Pool singleton com reuso em dev
const pool = global.pgPool ?? new Pool({ connectionString });

// Query parametrizada (previne SQL injection)
export async function query<T>(text: string, params?: unknown[]): Promise<QueryResult<T>>

// Whitelist de colunas por tabela (segunda camada de proteção)
export function filterAllowedColumns(table: string, fields: Record<string, unknown>)
```

**Helpers**: `getDefaultWorkspaceId()`, `getDefaultMemberId()`, `validateColumns()`

---

## Estrutura de API Routes

**115+ endpoints organizados por domínio:**

### Core Resources
| Endpoint | Métodos | Descrição |
|----------|---------|-----------|
| `/api/tickets` | GET, POST, PATCH | CRUD de tickets |
| `/api/tickets/[id]` | GET, PATCH | Detalhe com OCC |
| `/api/tickets/bulk` | PATCH | Ações em lote |
| `/api/tickets/search` | GET | Busca full-text |
| `/api/sprints` | GET, POST, PATCH | CRUD de sprints |
| `/api/projects` | GET, POST | Projetos |
| `/api/boards` | GET, POST | Boards |
| `/api/members` | GET | Listagem de membros |

### Features
| Endpoint | Descrição |
|----------|-----------|
| `/api/automations` | Rules engine (trigger/condition/action) |
| `/api/notifications` | In-app notifications |
| `/api/time-logs` | Time tracking entries |
| `/api/recurring-tickets` | Templates recorrentes |
| `/api/saved-views` | Filtros salvos |
| `/api/sla-policies` | Configuração de SLA |
| `/api/approvals` | Workflow de aprovação |
| `/api/ticket-templates` | Templates de criação |

### Integrações
| Endpoint | Descrição |
|----------|-----------|
| `/api/integrations/whatsapp` | Config UazAPI |
| `/api/integrations/clockify` | Config + sync Clockify |
| `/api/webhooks/github` | PR/commit → ticket linking |
| `/api/webhooks/clerk` | Sync de usuários |
| `/api/webhooks` | Webhook genérico (n8n/Zapier) |

### Cron Workers
| Endpoint | Frequência | Função |
|----------|-----------|--------|
| `/api/cron/sla-check` | 30 min | Alertas de SLA |
| `/api/cron/recurring-tickets` | 15 min | Criação automática |
| `/api/cron/sprint-rollover` | Diário | Auto-rollover de sprints |
| `/api/cron/project-updates` | Diário | Sync metadata |

### Admin/Auth
| Endpoint | Descrição |
|----------|-----------|
| `/api/auth/me` | Usuário atual |
| `/api/roles` | Gestão universal de roles |
| `/api/permissions` | Catálogo de permissões |
| `/api/settings` | CRUD genérico de configuração |
| `/api/audit-log` | Consulta de auditoria |

---

## Padrão de API

### Request Flow

```
Browser → Middleware (Clerk JWT) → Route Handler
  → getAuthMember() [auth]
  → hasTicketAccess() [access check]
  → query() [database]
  → Side-effects (async, fire-and-forget)
  → JSON Response
```

### HTTP Methods

| Método | Semântica |
|--------|-----------|
| GET | Fetch (single/list) |
| POST | Create ou Action |
| PATCH | Update parcial (com OCC via `_updated_at`) |
| DELETE | Archive (soft delete) |

### Response Format

```typescript
// Sucesso
{ ok: true, ...data }
// ou array direto para listagens

// Erro
{ error: "Mensagem" }
```

### Status Codes

| Code | Uso |
|------|-----|
| 200 | Sucesso |
| 201 | Criado |
| 400 | Request inválida |
| 401 | Não autenticado |
| 403 | Acesso negado |
| 404 | Não encontrado |
| 409 | Conflito (OCC, constraint) |
| 500 | Erro interno |

---

## Ticket Creation Helper (`lib/tickets.ts`)

```typescript
export async function createTicket(input, context): Promise<Ticket>
```

**Consolidado**: INSERT + assignees + audit + embedding + automations + webhooks + notifications

**Side-effects (fire-and-forget)**:
- Embedding vetorial (AI search)
- Webhook dispatch (Slack/Discord/genérico)
- Automations engine
- Notificações (in-app + WhatsApp)

**Audit (síncrono)**: Activity log é síncrono (compliance)

---

## Audit System (`lib/audit.ts`)

```sql
audit_log(
  workspace_id, actor_id, action, entity_type, entity_id,
  changes JSONB, ip_address, user_agent, created_at
)
```

- **Fire-and-forget**: nunca bloqueia o request
- **Captura**: IP (x-forwarded-for), user-agent
- **Índices**: workspace+time, entity, actor

---

## Integrações Externas

### WhatsApp (UazAPI)
- `lib/whatsapp.ts` — `sendWhatsApp(phone, message)`
- Env: `WHATSAPP_API_URL`, `WHATSAPP_API_TOKEN`
- Preferências por membro (canal + evento)

### Clockify
- Config em `integrations` table (JSONB)
- Sync bidirecional de time entries
- UPSERT com external_id

### GitHub
- HMAC-SHA256 signature validation
- Extrai ticket keys de PRs/commits via regex `[A-Z]{2,10}-\d+`
- Salva em `github_links` (PR state, commit author, branch)

### Webhooks Genéricos (`lib/webhooks.ts`)
- Formata para: Slack (blocks), Discord (embeds), JSON genérico
- Lookup em `webhook_subscriptions` por evento
- Header signing para segurança

---

## Database Schema (Resumo)

### Tabelas Core

| Tabela | Função |
|--------|--------|
| `workspaces` | Multi-tenant container |
| `members` | Usuários (clerk_user_id, is_approved) |
| `tickets` | Work items (heart of the system) |
| `statuses` | Colunas do Kanban (dinâmicas) |
| `ticket_types` | Bug, Story, Task, Epic |
| `services` | Serviços/Produtos |
| `categories` | Categorização |
| `projects` | Container de trabalho |
| `boards` | Visualizações Kanban |
| `sprints` | Ciclos time-boxed |
| `clients` | Clientes externos |

### Views

| View | Função |
|------|--------|
| `tickets_full` | Denormalized JOIN (tipo, status, service, assignee, contadores) |

### Triggers

| Trigger | Função |
|---------|--------|
| `compute_ticket_sla_due_at` | Calcula SLA em INSERT/UPDATE priority |
| `sync_ticket_counters` | Mantém contadores denormalizados |
| `generate_ticket_sequence` | Auto-incrementa sequence_number por workspace |
| `log_status_change` | Registra mudanças no activity_log |

---

## Rate Limiting (`lib/rate-limit.ts`)

- Bucket in-memory (por instância, não distribuído)
- Default: 60 requests / 60 segundos
- Cleanup a cada 5 minutos
- Retorna `{ ok: boolean; retryAfter?: number }`

---

## Monitoramento

- **Sentry**: Error tracking + Crons monitoring
- **Audit log**: Todas as mutações sensíveis
- **Activity log**: Histórico de campos por ticket
- **Console**: Errors logados para debugging

---

## Migrations (`db/`)

| Migration | Função |
|-----------|--------|
| `schema.sql` | Tabelas iniciais |
| `002_complete_schema.sql` | Sprints, subtasks, comments |
| `010_clients.sql` | Clientes |
| `012_multi_tenant_rbac.sql` | RBAC multi-nível |
| `016_permissions.sql` | Catálogo de permissões |
| `021_clerk_auth.sql` | Integração Clerk |
| `035_project_board_sprint_convention.sql` | Hierarquia |
| `040_audit_log.sql` | Audit system |
| `050_sla.sql` | SLA policies + trigger |
| `052_sprint_auto_rollover.sql` | Auto-rollover |
| `058_tickets_full_consolidate.sql` | View canônica + contadores |
