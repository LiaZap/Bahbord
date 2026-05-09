# Plano de melhorias — Bah!Flow

Baseado em auditoria interna do light mode + pesquisa de mercado (Linear, Jira, ClickUp, Notion, Plane, Height, Asana, Monday).

Organizado em **5 ondas** por ordem de impacto vs esforço. Cada onda fecha em ~1 sprint.

---

## Onda 1 — Light mode usável (fix de regressão)

**Objetivo**: tornar o light mode tão usável quanto o dark. Hoje tem texto invisível e cores quebradas.

**Trabalho** (~2 dias):
- Refatorar arquivos críticos pra usar tokens CSS (`text-primary`, `text-secondary`, `bg-[var(--overlay-subtle)]`, etc) em vez de `text-white`/`text-slate-XXX`/`bg-white/[0.XX]` hardcoded.
- Prioridade decrescente:
  1. `components/tickets/ActivityTimeline.tsx` (~55 ocorrências) — comentários, atividade
  2. `components/dashboard/DashboardCharts.tsx` (~41) — labels de charts não-cobertas pelos overrides globais
  3. `components/tickets/TicketSidebar.tsx` (~26)
  4. `components/tickets/TicketDetailView.tsx` (~18) — texto invisível em title/buttons
  5. `components/board/TicketCard.tsx` (~18)
  6. `components/settings/GeneralSettings.tsx` (~15)
  7. `components/ui/Modal.tsx` + `ConfirmModal.tsx` (~6) — hover states quebrados
  8. `components/board/KanbanColumn.tsx` (~4)
- Adicionar utility classes `.text-secondary-muted`, `.surface-subtle` em `globals.css` pra evitar repetição.
- Deprecar `text-slate-XXX` no projeto (manter só como override em `globals.css`).
- Validar visualmente abrindo cada tela em `html.dark` e sem.

---

## Onda 2 — Quick wins de produtividade (1 sprint)

Baixo esforço, retorno alto. Inspirados em Linear/Jira.

| # | Feature | Inspirado em | Esforço | Impacto |
|---|---------|--------------|---------|---------|
| 2.1 | **Snooze de tickets** (`snoozed_until` + filtro default no `/my-tasks`) | Linear | P | M |
| 2.2 | **Issue dependencies** (blocks/blocked-by — relação lateral entre tickets) | Linear/Jira | P | M |
| 2.3 | **Multiple assignees** (1→N) — schema + UI | ClickUp/Asana | P | M |
| 2.4 | **Cmd+Shift+M** abre `/my-tasks` filtrado de qualquer lugar + chips "Hoje / Semana / Atrasados" | Linear | P | P-M |
| 2.5 | **Detecção de duplicatas IA** ao criar ticket (`/api/tickets/similar` via embedding) | Height/Linear | M | G |

**Prioridade**: 2.1 → 2.5 → 2.4 → 2.3 → 2.2.

---

## Onda 3 — Diferenciais reais (2 sprints)

Features que mexem o ponteiro vs concorrentes.

### 3.1 Triage Inbox com IA — *Linear*
Inbox `/inbox` separa issues vindas de fora (Slack, Sentry, share-link público) com 3 atalhos: aceitar (1), duplicar (2), recusar (3) + IA sugerindo prioridade/labels/assignee + detector de duplicatas. **Encaixe**: `app/inbox/page.tsx` + novo `lib/triage.ts`. Reusa `lib/automations.ts` e `lib/ai.ts`.

### 3.2 SLA com escalation visual — *Linear*
Deadline automático por prioridade (Urgente=24h, Alta=1sem) com cor que muda cinza→amarelo→laranja→vermelho. Alerta no Slack 1 dia antes. Reusa nosso webhook Slack. **Encaixe**: campo `sla_due_at` calculado no INSERT + cron em `lib/cron/` + `lib/webhooks.ts`.

### 3.3 Status updates semanais automáticos por projeto — *Linear/Asana*
Toda sexta a IA monta resumo do projeto (X concluídos, Y atrasados, riscos detectados) e pede campo livre do PM. Vira histórico. **Encaixe**: cron + `lib/ai.ts` + `app/projects/[id]/updates/`.

### 3.4 Cycles automáticos com auto-rollover — *Linear*
Sprints com cadência fixa (ex: 2 semanas) que se renovam sozinhos. Migra issues incompletas pro próximo. **Encaixe**: flag `auto_rollover` no `sprints` schema + cron.

---

## Onda 4 — Polish + integrações (1 sprint)

| # | Item | Detalhe |
|---|------|---------|
| 4.1 | **Workload view** | Heatmap de carga por pessoa por semana (`app/reports/workload/`) — soma de estimates por assignee |
| 4.2 | **Project documents inline** | Tab "Spec" em `app/projects/[id]/` com editor rich-text + backlinks bidirecionais |
| 4.3 | **Customer Requests** | Linkar feedback externo (share-link/form) a ticket com contagem "X clientes pediram" |
| 4.4 | **Empty states ilustrados** | Substituir textos genéricos por estados com ilustração + CTA |
| 4.5 | **Mobile responsivo polish** | Auditoria nas telas chave (board, ticket modal, settings) |

---

## Onda 5 — Ambicioso (2-3 sprints)

Features estruturais. Só atacar quando 1-4 estiverem fechadas.

### 5.1 Initiatives / Roadmap por trimestre
Camada acima de projeto: agrupa N projetos sob meta (ex: "Q3: Reduzir churn") com health (on-track/at-risk/off-track). Nova entidade `initiatives` + `app/roadmap/`.

### 5.2 Automation rules visuais (no-code builder)
Builder "Quando [trigger] → Se [condição] → Faça [ação]". Backend já existe (`lib/automations.ts`); falta UI completa em `app/settings/automations/`.

### 5.3 i18n base (PT/EN)
Extrair strings hardcoded pra `next-intl` ou similar. Preparação pra mercado externo.

### 5.4 Performance audit
- Virtualizar listas longas (`components/list/`, board com 200+ cards)
- Lazy-load tabs do TicketDetailModal
- Cache de queries pesadas com SWR

---

## Skills / scripts úteis

- **`make-plan`** — pra fasear cada onda em tasks executáveis com estimativas
- **`learn-codebase`** — pra onboardar dev novo antes de pegar uma onda
- **`security-review`** — antes de mergear cada onda (RBAC + endpoints novos)
- **`grill-me`** — pra desafiar suposições antes de começar feature grande
- **`tdd`** — pra Onda 5 (refactor estrutural)

---

## Métricas de sucesso

- Onda 1: zero regressões reportadas em light mode
- Onda 2: tempo médio de criação de ticket cai (atalhos + dependências)
- Onda 3: NPS interno > 8 + redução de tickets duplicados (medir via dedup IA)
- Onda 4: aumento de uso da view Workload (analytics)
- Onda 5: time-to-first-load p95 cai >30%

---

## Próximo passo recomendado

**Começar pela Onda 1** (light mode) — ela bloqueia clientes que rodam em ambientes com luz forte. Trabalho previsível, sem surpresas, e gera ganho visível no primeiro dia.

Após Onda 1, decidir entre:
- **Caminho conservador**: Onda 2 (quick wins) → Onda 4 (polish) — produto 20% melhor
- **Caminho diferencial**: Onda 2 (essenciais) → Onda 3 (Triage Inbox + SLA) — narrativa de venda nova
