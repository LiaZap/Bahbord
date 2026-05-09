# Plano de execução — Bah!Flow Roadmap

**Tech Lead**: Claude Opus 4.7 (orquestrador, code review final, decisões de arquitetura).

Equipe modular de specialist engineers que orbitam o trabalho ativo. Cada sprint tem um time dedicado + 1 **QA/Reviewer supervisor** que valida antes do merge.

---

## Estrutura geral

```
           Tech Lead (Claude)
                  │
        ┌─────────┼─────────┐
        │         │         │
   Specialist  Specialist  QA / Reviewer
   (executa)   (executa)   (valida + bloqueia merge)
                  │
            SendMessage entre eles
```

**Padrão de comunicação** (conforme `CLAUDE.md` do projeto):
- Todos os agentes spawn em uma única mensagem com `run_in_background: true`
- Cada um com `name` único pra ser endereçável via `SendMessage`
- Pipeline: research → architect → coder → tester → reviewer

---

## Time por especialização

### Frontend Engineer (`coder` + skill `refatorar`)
React/Tailwind/CSS vars. Refatora componentes, ajusta tokens, monta telas novas.

### Backend Engineer (`backend-dev` + skill `api-criar`)
Postgres queries, endpoints REST, migrations. Sem ORM (queries cruas via `lib/db.ts`).

### AI Engineer (`coder` com foco OpenAI)
Prompts, validação de output JSON, rate limit, sandbox SQL. Trabalha em `lib/ai.ts` e `app/api/ai/*`.

### Design System Specialist (`coder` + Tailwind)
Tokens CSS, utility classes, garantir consistência dark/light. Trabalha em `app/globals.css`.

### Database Engineer (`backend-dev` + `migrar`)
Migrations, índices, performance de queries. Idempotência obrigatória.

### DevOps Engineer (`devops` + skill `ci-cd`)
Cron jobs, GitHub Actions, EasyPanel, scripts de backup.

### Performance Engineer (`performance-engineer` + skill `performance`)
Profiling, virtualização, cache, bundle size.

### Security Architect (`security-architect` + skill `seguranca`)
RBAC, validação de inputs, audit log, escapes SQL.

### System Architect (`system-architect` + skill `arquitetura`)
Decisões de schema novo, refatorações estruturais, ADRs.

### QA / Reviewer Supervisor (`reviewer` + skill `revisar`)
Code review, testes manuais light/dark, valida access control, bloqueia merge se algo quebra.

---

## Sprints

### 🔴 Sprint 1 — Light Mode Recovery (3 dias)

**Objetivo**: light mode 100% usável. Zero texto invisível.

**Time**:
- `frontend-eng` (Frontend Engineer)
- `design-spec` (Design System Specialist)
- `qa-reviewer` (QA/Reviewer)

**Pipeline**:
```
design-spec → frontend-eng (em paralelo) → qa-reviewer → Tech Lead (merge)
```

**Tasks**:
1. `design-spec`: criar utility classes (`.text-secondary-muted`, `.surface-subtle`, hover states padronizados) em `app/globals.css`. Mensagem para `frontend-eng` quando pronto.
2. `frontend-eng`: refatorar arquivos críticos em ordem (paralelizado em 2 batches):
   - **Batch A**: `ActivityTimeline.tsx`, `DashboardCharts.tsx`, `TicketSidebar.tsx`
   - **Batch B**: `TicketDetailView.tsx`, `TicketCard.tsx`, `GeneralSettings.tsx`, `Modal.tsx`, `KanbanColumn.tsx`
   - Substituir `text-white` → `text-primary`, `text-slate-XXX` → `text-secondary`/`text-[var(--text-tertiary)]`, `bg-white/[0.0X]` → `bg-[var(--overlay-subtle)]` etc.
3. `qa-reviewer`: testar cada tela em ambos os modos (toggle no Header). Reportar regressões. Aprovar PR.

**Critério de aceite**: nenhuma classe `text-white` ou `text-slate-XXX` hardcoded fora de overrides intencionais. Zero textos invisíveis em light. Screenshots before/after.

---

### ⚡ Sprint 2 — Quick Wins (5 dias)

**Objetivo**: 5 features rápidas que aumentam produtividade diária.

**Time**:
- `backend-eng` (Backend Engineer)
- `frontend-eng` (Frontend Engineer)
- `ai-eng` (AI Engineer)
- `qa-reviewer`

**Pipeline**:
```
backend-eng (schema + API) ──┐
                              ├─→ frontend-eng (UI) → qa-reviewer
ai-eng (duplicatas)          ─┘
```

**Tasks**:

**2.1 Snooze de tickets**
- `backend-eng`: migration `db/045_snooze.sql` (coluna `snoozed_until`), filter no `/api/tickets`, default no `/api/personal/counts`
- `frontend-eng`: botão "Snooze" no TicketCard + toggle no `/my-tasks` ("mostrar snoozed")

**2.2 Issue dependencies (blocks/blocked-by)**
- `backend-eng`: migration `db/046_ticket_relations.sql` (tabela `ticket_relations` com type=blocks|blocked_by|relates_to), endpoint CRUD
- `frontend-eng`: seção "Bloqueios" no TicketDetailModal + warning visual ao tentar fechar com bloqueador aberto

**2.3 Multiple assignees**
- `backend-eng`: migration `db/047_multi_assignees.sql` (tabela `ticket_assignees` many-to-many), backfill de `assignee_id`. Endpoints atualizados pra aceitar `assignee_ids[]`. Manter `assignee_id` como FK pro principal.
- `frontend-eng`: TicketSidebar mostra avatares stackados, picker permite múltiplos

**2.4 Cmd+Shift+M global + chips**
- `frontend-eng`: estende `KeyboardShortcuts.tsx` com `Cmd+Shift+M` (route `/my-tasks?filter=me`) + chips de filtro no topo do `/my-tasks`

**2.5 Detecção de duplicatas IA**
- `ai-eng`: novo endpoint `/api/tickets/similar` que recebe título e usa OpenAI embeddings (`text-embedding-3-small`) pra achar tickets similares no projeto. Cache via SWR.
- `frontend-eng`: no CreateTicketModal, debounce 500ms no campo título → chama similar → mostra banner "Talvez seja duplicata: [BAH-X] título" com link

**Critério de aceite**: cada feature com TS limpo, testes manuais nos 5 fluxos, audit log registrando ações novas. QA roda smoke test em todas.

---

### 🎯 Sprint 3 — Diferenciais (10 dias, 2 mini-sprints)

**Objetivo**: features que criam narrativa de venda.

**Time** (estendido):
- `backend-eng`
- `frontend-eng`
- `ai-eng`
- `devops-eng` (DevOps Engineer — pra cron)
- `system-arch` (System Architect — pra schema novo)
- `qa-reviewer`

**Mini-sprint 3A** (5 dias):

**3A.1 Triage Inbox com IA**
- `system-arch`: define schema do "triage inbox source" (origem: slack/sentry/share-link/manual)
- `backend-eng`: endpoints CRUD + integração com webhooks atuais
- `ai-eng`: prompt pra classificar nova issue (priority + labels + assignee suggestion + duplicate check)
- `frontend-eng`: refaz `app/inbox/page.tsx` com 3 atalhos (1=accept, 2=duplicate, 3=reject) + sugestões IA

**3A.2 SLA com escalation visual**
- `backend-eng`: migration `db/048_sla.sql` (tabela `sla_policies` por prioridade + coluna `sla_due_at` em tickets, calculada no INSERT)
- `frontend-eng`: badge SLA no TicketCard com cor dinâmica + filtro "atrasados" no board
- `devops-eng`: cron `/api/cron/sla-check` que dispara webhook Slack 1 dia antes de cada SLA

**Mini-sprint 3B** (5 dias):

**3B.1 Status updates semanais por projeto**
- `ai-eng`: prompt que gera resumo do projeto (tickets concluídos, atrasados, mudanças de prioridade, blockers)
- `backend-eng`: tabela `project_updates` + endpoint
- `frontend-eng`: tab "Updates" em `app/projects/[id]/` com timeline de updates + form pra PM completar
- `devops-eng`: cron sexta 17h dispara geração

**3B.2 Cycles automáticos com auto-rollover**
- `system-arch`: extende schema sprints com `auto_rollover`, `cadence_days`, `rollover_strategy`
- `backend-eng`: endpoint pra ativar; cron diário verifica sprints encerrando hoje
- `frontend-eng`: toggle "auto-rollover" no edit de sprint + UI de cadência
- `devops-eng`: cron `/api/cron/sprint-rollover`

**Critério de aceite**: cada uma com docs em `docs/FEATURES/`, audit log, screenshots, testes E2E novos.

---

### 🪟 Sprint 4 — Polish + integrações (5 dias)

**Time**:
- `frontend-eng`
- `design-spec`
- `qa-reviewer`

**Tasks**:
- `4.1` Workload view (`app/reports/workload/`) — heatmap por pessoa por semana
- `4.2` Project documents inline — tab "Spec" em `app/projects/[id]/` com editor + backlinks
- `4.3` Customer Requests — linkar feedback externo a ticket com contagem
- `4.4` Empty states ilustrados — substituir textos genéricos por SVGs + CTA
- `4.5` Mobile responsivo — auditoria nas telas chave

**Pipeline**:
```
design-spec (empty states + ilustrações) ─┐
                                          ├─→ frontend-eng → qa-reviewer
backend-eng (workload query, customer)   ─┘
```

---

### 🚀 Sprint 5 — Ambicioso (10 dias, 2 mini-sprints)

**Time** (completo):
- `system-arch`
- `backend-eng`
- `frontend-eng`
- `perf-eng` (Performance Engineer)
- `qa-reviewer`

**Mini-sprint 5A** (5 dias):

**5A.1 Initiatives / Roadmap**
- `system-arch`: schema `initiatives` com health (on-track/at-risk/off-track) e relação N-N com projects
- `backend-eng`: endpoints CRUD + agregação de progresso
- `frontend-eng`: nova rota `app/roadmap/` + tab "Initiatives" em projetos

**5A.2 Automation builder UI**
- `frontend-eng`: builder visual em `app/settings/automations/` (drag triggers + conditions + actions)
- `backend-eng`: ajustar `lib/automations.ts` pra suportar combinações via UI

**Mini-sprint 5B** (5 dias):

**5B.1 i18n base PT/EN**
- `system-arch`: define estratégia (`next-intl` ou `react-intl`)
- `frontend-eng`: extrair strings hardcoded pra catalogs

**5B.2 Performance audit**
- `perf-eng`: profile → identifica gargalos (board com >200 cards, charts pesadas)
- `frontend-eng`: virtualizar listas (react-window), lazy-load tabs do TicketDetailModal
- `backend-eng`: índices Postgres adicionais identificados

---

## Como vou rodar (quando autorizar)

Pra cada Sprint, faço **uma única mensagem** spawnando todos os agentes:

```javascript
Agent({ name: "design-spec", subagent_type: "coder", run_in_background: true,
        prompt: "[task específica + SendMessage frontend-eng quando pronto]" })
Agent({ name: "frontend-eng", subagent_type: "coder", run_in_background: true,
        prompt: "[Aguarda design-spec. Refatora arquivos X,Y,Z. SendMessage qa-reviewer]" })
Agent({ name: "qa-reviewer", subagent_type: "reviewer", run_in_background: true,
        prompt: "[Aguarda frontend-eng. Valida light/dark em cada arquivo]" })

// Kick off
SendMessage({ to: "design-spec", message: "[contexto da sprint]" })
```

Eu, como Tech Lead, faço:
- Code review final antes do merge
- Resolvo conflitos / decisões arquiteturais
- Decido quando avançar pra próxima sprint

---

## Critérios universais (todos os sprints)

✅ TypeScript build limpo (`npx tsc --noEmit`)
✅ Sem novos `text-white`/`text-slate` hardcoded em light mode
✅ RBAC validado (admin vs member vs cliente)
✅ Audit log registra ações novas
✅ E2E Playwright passa
✅ Screenshots before/after no PR
✅ Migrations idempotentes (se houver)
✅ Sem `console.log` esquecido

---

## Próximo passo

Aguardo seu **OK** pra disparar **Sprint 1 (Light Mode Recovery)**. Vou spawnar os 3 agentes em paralelo conforme padrão acima e te dar updates conforme cada um termina.

Quando autorizar, é só responder "Vai Sprint 1" ou similar.
