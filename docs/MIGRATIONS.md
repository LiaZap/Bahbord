# Migrations

**56 migrations** sequenciais em `db/0XX_*.sql` (045-056 adicionadas nas
Sprints 1-5 — snooze, ticket_relations, multi_assignees, ticket_embeddings,
triage_inbox, sla, project_updates, sprint_auto_rollover, customer_requests,
project_specs, initiatives, perf_indexes). Aplicação manual — não há
ferramenta dedicada (Prisma migrate, Knex, etc). Todas as migrations são
**idempotentes**: usam `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD
COLUMN IF NOT EXISTS`, e blocos `DO $$ BEGIN ... EXCEPTION WHEN
duplicate_object THEN NULL; END $$;` quando precisam criar tipos/índices.

**Variant CONCURRENTLY** (`db/manual/perf_indexes_concurrent.sql`):
versão do 056 pra rodar em produção sem bloquear escritas. Roda fora do
loop padrão (script à parte), porque `CREATE INDEX CONCURRENTLY` não pode
estar em transação.

A ordem **importa** — algumas migrations dependem de colunas/tabelas
criadas pelas anteriores.

## Como rodar

### Local (psql)

```bash
for f in db/0*.sql; do
  echo "=== $f ==="
  psql "$DATABASE_URL" -f "$f"
done
```

### Local (npm script auxiliar — se existir)

Não há script npm dedicado; use o loop acima.

### Produção (EasyPanel)

A pasta `db/` é copiada para a imagem (`COPY --from=builder /app/db ./db`
no `Dockerfile`). Após o deploy:

1. Abra o **Console** do container no EasyPanel.
2. Rode:
   ```bash
   for f in db/0*.sql; do psql "$DATABASE_URL" -f "$f"; done
   ```

### Setup inicial completo

Para um banco vazio, há um arquivo agregado em `db/FULL_SETUP.sql` que
combina o schema base + as 44 migrations em uma única execução
(idempotente). Use **uma das duas estratégias**:

```bash
# Opção A: tudo numa tacada
psql "$DATABASE_URL" -f db/FULL_SETUP.sql

# Opção B: sequencial (mais fácil pra debugar erros)
psql "$DATABASE_URL" -f db/schema.sql
for f in db/0*.sql; do psql "$DATABASE_URL" -f "$f"; done
```

`db/seed_breakr.sql` contém dados de exemplo (workspace + members + projetos)
para dev local.

## Lista das migrations

| # | Arquivo | Descrição |
|---|---------|-----------|
| 002 | `002_complete_schema.sql` | Tabelas faltantes, triggers e view `tickets_full`. |
| 003 | `003_fix_schema_mismatches.sql` | Alinha schema do banco com as APIs existentes. |
| 004 | `004_indexes_and_performance.sql` | Indexes para performance em queries frequentes. |
| 005 | `005_dev_links.sql` | Tabela `dev_links` (links externos vinculados a tickets). |
| 006 | `006_webhook_settings.sql` | Tabela `webhook_subscriptions`. |
| 007 | `007_integrations.sql` | Tabela de integrações externas (Clockify, GitHub, etc). |
| 008 | `008_whatsapp.sql` | Coluna `phone` em `members` para notificações WhatsApp. |
| 009 | `009_access_links.sql` | Tabela `access_links` (links convite). |
| 010 | `010_clients.sql` | Tabela de clientes + `client_id` em `tickets`. |
| 011 | `011_billable_hours.sql` | `is_billable` em `time_entries`. |
| 012 | `012_multi_tenant_rbac.sql` | Tabelas `projects`, `boards`, `project_roles`, `board_roles`, `org_roles` (RBAC em 3 níveis). |
| 013 | `013_client_orgs.sql` | Organizações, produtos e vínculo com clientes. |
| 014 | `014_saved_filters.sql` | Tabela `saved_filters`. |
| 015 | `015_teams.sql` | Tabela `teams`. |
| 016 | `016_permissions.sql` | Permission groups/categories (sistema granular extensível). |
| 017 | `017_fix_hierarchy.sql` | View `tickets_full` ganha info de project + board. |
| 018 | `018_docs_wiki.sql` | Documentation spaces (estilo Confluence). |
| 019 | `019_approval_flow.sql` | Fila de aprovação para criação de projetos e acesso. |
| 020 | `020_doc_access.sql` | Access control para documentation spaces. |
| 021 | `021_clerk_auth.sql` | Integração com Clerk (`clerk_user_id` em `members`). |
| 022 | `022_categories_color.sql` | Coluna `color` em `categories`. |
| 023 | `023_time_entries_fix.sql` | Garante todas as colunas necessárias em `time_entries`. |
| 024 | `024_member_avatar.sql` | `avatar_url` em `members` para foto de perfil. |
| 025 | `025_view_avatar.sql` | Recria view `tickets_full` com `avatar_url`. |
| 026 | `026_subtasks_fix.sql` | Garante `completed_at` em `subtasks`. |
| 027 | `027_security_and_indexes.sql` | Security fixes, FK cascades, indexes e tabelas faltantes. |
| 028 | `028_sprint_project.sql` | `project_id` em `sprints` (cada projeto tem seus sprints). |
| 029 | `029_sprint_dates_nullable.sql` | Datas de sprint passam a ser nullable (planning sem datas). |
| 030 | `030_notifications.sql` | Schema de notifications p/ menções e atribuições (`recipient_id`, `actor_id`). |
| 031 | `031_is_client_flag.sql` | `is_client` em `members` para distinguir staff interno de cliente externo. |
| 032 | `032_automations.sql` | Automation/rules engine. |
| 033 | `033_client_share_links.sql` | Links públicos read-only de dashboard pra clientes. |
| 034 | `034_github_integration.sql` | Tabela `github_links` (PRs/commits/issues vinculados a tickets). |
| 035 | `035_project_board_sprint_convention.sql` | Convenção: cada projeto tem 1 board "01 <NOME>" + 1 sprint ativa com mesmo nome. |
| 036 | `036_view_project_color.sql` | View `tickets_full` ganha `project_color` (usado por my-tasks/this-week). |
| 037 | `037_notifications_relax.sql` | Relaxa constraints legadas de `notifications` que causavam falha silenciosa. |
| 038 | `038_members_time_tracking.sql` | Permite admin liberar Time Tracking pra um usuário específico (sem promovê-lo). |
| 039 | `039_fix_zero_duration.sql` | Recalcula `duration_minutes` pra entries que ficaram com 0 (truncamento INT). |
| 040 | `040_audit_log.sql` | Tabela `audit_log` (eventos administrativos). |
| 041 | `041_ticket_templates.sql` | Templates de ticket reutilizáveis. |
| 042 | `042_recurring_tickets.sql` | Tabela `recurring_tickets` (cron-driven). |
| 043 | `043_workspace_onboarded.sql` | `onboarded_at` em `workspaces` (gate do wizard). |
| 044 | `044_saved_views.sql` | Saved views — combinação de filtros como atalho na sidebar. |
| 045 | `045_snooze.sql` | Coluna `tickets.snoozed_until` + recreate da view `tickets_full` com `snoozed_until`. |
| 046 | `046_ticket_relations.sql` | Tabela `ticket_relations` (blocks/blocked_by/relates_to) com UNIQUE + CHECK anti self-ref. |
| 047 | `047_multi_assignees.sql` | Tabela `ticket_assignees` (many-to-many) + backfill do `tickets.assignee_id` legado como `is_primary`. |
| 048 | `048_ticket_embeddings.sql` | Tabela `ticket_embeddings` (JSONB de 1536 dims do `text-embedding-3-small`). |
| 049 | `049_triage_inbox.sql` | Tabela `triage_inbox` + dedup UNIQUE (workspace, source, source_external_id). |
| 050 | `050_sla.sql` | Tabela `sla_policies` + colunas `sla_due_at`/`sla_alert_sent_at` em `tickets` + função `compute_ticket_sla_due_at()` + 2 triggers + recreate da view. |
| 051 | `051_project_updates.sql` | Tabela `project_updates` (status semanal por projeto) com UNIQUE(project, period). |
| 052 | `052_sprint_auto_rollover.sql` | 5 colunas em `sprints` (auto_rollover, cadence_days, rollover_strategy, parent_sprint_id, rolled_over_at). |
| 053 | `053_customer_requests.sql` | Tabela `customer_requests` (linka feedback externo a tickets, source enum). |
| 054 | `054_project_specs.sql` | Tabelas `project_specs` (rich text) + `project_spec_backlinks` (BAH-X parser). |
| 055 | `055_initiatives.sql` | Tabelas `initiatives` + `initiative_projects` (com weight) — camada acima de projeto. |
| 056 | `056_perf_indexes.sql` | 16 índices de perf (assignee_active, project_status, sla_due_at, snoozed_until, audit, customer_requests_unresolved, etc). |
| 056 | `manual/perf_indexes_concurrent.sql` | **Variant CONCURRENTLY pra produção** — fora do loop padrão. Roda em script separado. |

## Convenções

- Toda migration começa com um comentário `-- NNN: descrição` que explica
  o que faz.
- Tabelas novas: `CREATE TABLE IF NOT EXISTS`.
- Colunas novas: `ALTER TABLE x ADD COLUMN IF NOT EXISTS y ...`.
- Índices: `CREATE INDEX IF NOT EXISTS ...`.
- Tipos custom (enums): bloco `DO $$ BEGIN ... EXCEPTION WHEN
  duplicate_object THEN NULL; END $$;`.
- Views: `CREATE OR REPLACE VIEW`.
- Para dados (seeds, valores default), usar `INSERT ... ON CONFLICT DO NOTHING`.

## Reaplicar tudo

Como todas são idempotentes, pode rodar do zero numa base existente sem
quebrar — útil quando você importou um dump antigo e quer garantir que
as últimas migrations estão aplicadas.
