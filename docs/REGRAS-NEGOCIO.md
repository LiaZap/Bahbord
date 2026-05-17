# Regras de Negócio

## 1. Ciclo de Vida do Ticket

### Criação

| Regra | Descrição |
|-------|-----------|
| Auto-reporter | Se reporter_id não informado, usa o usuário autenticado |
| Auto-project | Se só board_id informado, extrai project_id do board pai |
| Auto-sprint | Se sprint_id não informado, atribui ao sprint ativo do projeto |
| Multi-assignee | `assignee_ids[]` suportado; primeiro vira primary |
| SLA automático | `sla_due_at` calculado via trigger (created_at + hours_to_resolve) |
| Sequence | `sequence_number` auto-incrementado por workspace (trigger) |
| Ticket key | Gerado como `PREFIX-000` (ex: BAH-015) |

### Transições de Status

| Evento | Comportamento |
|--------|--------------|
| Mover para `is_done=true` | Seta `completed_at = NOW()` (idempotente) |
| Sair de `is_done=true` | Limpa `completed_at = NULL` |
| Qualquer mudança de status | Registra em `activity_log` |
| Mudança de prioridade | Recalcula `sla_due_at` via trigger |

### Arquivamento

- `is_archived = true` → oculto de todas as views
- Queries sempre filtram `WHERE is_archived = false`
- **Snooze**: `snoozed_until` oculta temporariamente (sem arquivar)

---

## 2. Sprint Management

### Regras de Sprint Ativo

- Apenas **1 sprint ativo** por projeto (`is_active = true`)
- Ativar sprint → desativa irmãos do mesmo projeto
- Tickets criados sem sprint → atribuídos ao sprint ativo automaticamente

### Fluxo de Conclusão

1. Sprint marcado `is_completed = true`, `is_active = false`
2. Próximo sprint incompleto encontrado (mesmo projeto, mais antigo)
3. Tickets não-concluídos → movidos para próximo sprint
4. Se não há próximo sprint → tickets vão para backlog (`sprint_id = NULL`)

### Auto-Rollover (`lib/sprint-rollover.ts`)

| Config | Descrição |
|--------|-----------|
| `auto_rollover = true` | Habilita rollover automático |
| `cadence_days` | Duração do próximo sprint (default 7) |
| Estratégia `move_incomplete` | Move tickets para novo sprint (default) |
| Estratégia `keep_in_place` | Mantém no sprint antigo |
| Estratégia `archive_incomplete` | Arquiva não-concluídos |

- **Nome auto-incrementa**: "Sprint 2" → "Sprint 3"
- **Board criado**: Novo sprint auto-cria board Scrum no projeto
- **Idempotência**: `rolled_over_at IS NULL` previne double-rollover

---

## 3. SLA (Service Level Agreement)

### Configuração (`sla_policies`)

```
workspace_id, priority, hours_to_resolve, alert_hours_before, enabled
```

**Defaults por prioridade:**

| Prioridade | Horas para resolver | Alerta antes de |
|-----------|--------------------|----|
| urgent | 24h | 6h |
| high | 168h (7 dias) | 24h |
| medium | 336h (14 dias) | 48h |
| low | 720h (30 dias) | 72h |

### Cálculo Automático

- **Trigger**: `compute_ticket_sla_due_at()` em INSERT e UPDATE de priority
- **Fórmula**: `sla_due_at = created_at + (hours_to_resolve * INTERVAL '1 hour')`
- **Policy desabilitada**: `sla_due_at = NULL`

### Status no Frontend

| Status | Condição |
|--------|----------|
| `overdue` | `sla_due_at < NOW()` AND não concluído |
| `warning` | `sla_due_at < NOW() + 24h` AND não concluído |
| `ok` | `sla_due_at >= NOW() + 24h` OR concluído |
| `none` | Sem SLA definido |

### Alertas (Cron `/api/cron/sla-check`)

- Roda a cada 30 minutos
- Busca tickets com SLA próximo do deadline + `sla_alert_sent_at IS NULL`
- Envia: Slack webhook + notificação in-app
- Seta `sla_alert_sent_at = NOW()` (previne duplicatas)

---

## 4. Aprovações

### Tipos

| Tipo | Gatilho |
|------|---------|
| `org_access` | Primeiro login de novo usuário |
| `project_access` | Pedido de acesso a projeto |
| `board_access` | Pedido de acesso a board |
| `project_creation` | Criação de novo projeto |

### Status Flow

```
pending → approved | rejected
```

- Admin aprova → cria `project_roles` / `board_roles`
- Aprovação de `org_access` → seta `is_approved = true`
- Rejeição → `reviewer_note` opcional

---

## 5. Time Tracking

### Regras

- Armazenado em **MINUTOS** (conversão na UI)
- Timer ativo: `is_running = true` (apenas 1 por membro por vez)
- Billable hours: subset aprovado para cobrança
- Permissão: `members.can_track_time` (boolean, default false)

### Integrações

- Clockify: `external_id` para sync bidirecional
- Relatórios por: membro, data, projeto, sprint, ticket

---

## 6. Clientes

### Estrutura

```
organizations → clients → client_products
                 ↓
              tickets (client_id FK)
```

- Organization agrupa clientes (ex: "Acme Corp" → "Acme SaaS" + "Acme Mobile")
- Product = entregável/serviço
- Ticket pode ser tagueado com client_id

---

## 7. Tickets Recorrentes

### Configuração

```
cron_expression, title_template, description_html,
project_id, board_id, ticket_type_id, assignee_id, priority
```

### Templates

| Placeholder | Substituição |
|-------------|-------------|
| `{{date}}` | Data atual formatada |
| `{{week}}` | Semana atual |
| `{{month}}` | Mês atual |

### Execução (Cron `/api/cron/recurring-tickets`)

1. Busca `WHERE is_active = true AND next_run_at <= NOW()`
2. Renderiza template + cria ticket via `createTicket()`
3. Atualiza `last_run_at`, calcula `next_run_at`
4. **Idempotência**: `next_run_at` previne re-execução

### Presets de Cron

| Label | Expressão |
|-------|-----------|
| Toda segunda 9h | `0 9 * * 1` |
| Diariamente 8h | `0 8 * * *` |
| Todo dia 1 às 9h | `0 9 1 * *` |
| Toda sexta 17h | `0 17 * * 5` |
| A cada hora | `0 * * * *` |

---

## 8. Automações (Rules Engine)

### Estrutura

```
trigger_event → trigger_conditions (JSONB, AND) → action_type + action_params
```

### Triggers

| Evento | Descrição |
|--------|-----------|
| `ticket.created` | Ao criar ticket |
| `ticket.status_changed` | Ao mudar status |
| `ticket.assigned` | Ao atribuir responsável |

### Ações

| Action | Params |
|--------|--------|
| `assign_to` | `{ member_id }` |
| `set_priority` | `{ priority }` |
| `add_comment` | `{ text, author_id }` |
| `notify_member` | `{ member_id, message }` |

### Escopo

- **Global** (`project_id = NULL`) → aplica a todos os projetos
- **Per-project** → aplica só ao projeto
- Precedência: per-project antes de global

### Execução

- Fire-and-forget após criação de ticket
- Errors isolados (não bloqueiam o request)
- Audit trail via activity_log

---

## 9. WIP Limits

### Configuração

- `statuses.wip_limit` (INT, nullable)
- NULL = sem limite
- Setado por status nas configurações

### Enforcement

- **UI**: Warning visual quando atingido (borda amarela)
- **Drag-and-drop**: Bloqueia move se coluna no limite
- **Sem hard constraint** no banco — enforcement em app layer
- Toast: "Limite WIP atingido (6) nesta coluna"

---

## 10. Notificações

### Canais

| Canal | Comportamento |
|-------|--------------|
| In-app | Sempre criado (síncrono) |
| WhatsApp | Se habilitado em `notification_preferences` (async) |
| Email | Não implementado |

### Triggers

| Evento | Notifica |
|--------|----------|
| `ticket.assigned` | Responsável |
| `ticket.mentioned` | Mencionado (`@Nome`) |
| `comment.created` | Watchers do ticket |
| `approval.request` | Admins |
| Automation notify | Membro configurado |

### Mention Parsing

```
@SingleName ou @[Full Name] → auto-notifica membro
```

---

## 11. Hierarquia Board/Project/Sprint

```
Workspace
├── Projects
│   ├── Boards (Kanban/Scrum/Simple)
│   │   └── Statuses (colunas dinâmicas, com wip_limit)
│   └── Sprints (ciclos, opcionais)
│       └── Tickets
└── Tickets (backlog: sprint_id = NULL)
```

### Regras de Acesso

- `project_roles` → acessa todo o projeto
- `board_roles` → acessa board específico
- Ticket acessível se user tem role no project OU em qualquer board do project

---

## Padrões Consolidados

| Padrão | Uso |
|--------|-----|
| **Idempotência** | SLA alerts (`sla_alert_sent_at`), rollover (`rolled_over_at`), recurring (`next_run_at`) |
| **Fire-and-forget** | Embedding, webhooks, automations, notifications |
| **Audit síncrono** | Compliance — activity_log nunca é async |
| **Soft delete** | `is_archived` em vez de DELETE |
| **Timezone** | UTC no banco, formatado PT-BR na UI |
| **Default values** | Priority: medium, Status: primeiro, Sprint: ativo |
