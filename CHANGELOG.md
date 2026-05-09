# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).
Os agrupamentos são por mês — o projeto não usa releases versionados.

## [Não lançado]

### Added
- Edição inline da duração no Timesheet e no TimeTracker (`fecf08d`).

### Changed
- Coluna "Projetos" em `Settings → Membros` virou botão + popover via portal,
  resolvendo cortes por `overflow-hidden` (`26cdce2`, `8cfbee5`, `1188e9e`).
- Adicionar membro a múltiplos projetos diretamente pela section (`b64d8ab`).

### Fixed
- Popover do menu de Projetos não abria por causa de separador `|` na key (`660c04d`).
- Timesheet filtra por projeto/board do contexto, não pela visão geral (`45e6cf1`).

---

## 2026-04 — Recurring tickets, OpenAI e refino de aprovações

### Added
- **Migração de IA: Anthropic Claude → OpenAI `gpt-4.1-mini`** (`05465af`).
- **15 melhorias entregues numa onda**: templates de ticket, recurring tickets,
  calendário, PWA básico, AI chat (admin), wizard de onboarding, suíte E2E
  Playwright, etc (`03c6e71`).
- **Bulk actions em tickets** (arquivar / mover / atribuir / prioridade), audit
  log em Postgres (migration 040), welcome email via Resend, integração Sentry
  e backup automatizado pra S3 (`b259449`).
- **Rebrand Bah!Flow**: novos logos no lugar do `logo-bahtech` antigo + favicon
  (`e09217c`, `7e494aa`, `8020ef0`).
- Aprovação de `org_access` permite atribuir múltiplos projetos no mesmo fluxo (`a312748`).
- Recurring tickets: modal customizado, botão "Executar agora", timezone
  `America/Sao_Paulo`, dropdown de Responsável filtrado pelo projeto (`c18956b`,
  `5180987`, `59fdc12`).
- Liberar Time Tracking pra usuário específico via toggle (sem precisar promover
  a admin) — migration 038 (`9b633f5`).
- Endpoint de diagnóstico de notificações + relax de `NOT NULL` legados na
  tabela (migration 037) (`9ae75fc`).
- Activity feed na Dashboard + skeleton tokens (`4b08782`).
- Views pessoais: Inbox, Minhas tarefas, Esta semana — com badges na sidebar (`4f2d734`).
- Botão "Sincronizar com Clerk" em `Settings → Membros` (`8b7c26a`).
- Refatoração visual em ondas: estética Linear/Vercel + editorial style
  (`86ac830`, `39a4d7e`, `f9ca241`, `2cb830f`).

### Changed
- Auditoria de segurança: guards server-side em todas as pages e APIs críticas
  (`eaff378`).

### Fixed
- Tempo manual quebrava por cast implícito de int (`1e7a4a7`).
- `time_entries` ficava com 0min por truncamento INT — migration 039 recalcula
  os existentes (`013c15d`).
- Auto-menção permitida + autoScroll no drag-and-drop (`7a415ac`).
- Ticket detail quebrava após migration 036 (`type_id` renomeado) (`f652a17`).
- Descrição formatada em modo leitura + 6 endpoints com access control (`2f21076`).
- 3 bugs para membros (shortcut M, sprints, command palette) (`90c6909`).
- `MentionInput` funciona pra não-admins + brand Bah!Flow (`d2a6a15`).
- `my-tasks` / `this-week` quebravam por `project_color` faltando no view —
  migration 036 (`7d3977b`).

---

## 2026-04 (meio) — Convenção projeto-board-sprint, sprints por projeto

### Added
- **Convenção projeto = 1 board + 1 sprint "01 <NOME>"** auto-criados
  (migration 035) (`481a8b1`).
- Sprints vinculados a projetos — cada projeto tem seus próprios sprints
  (migration 028) (`fe69d31`).
- Sprint workflow completo: filtro por projeto, histórico colapsável,
  auto-criar próximo sprint, burndown chart (`e8cf1b5`, `886fcb1`).
- Visualizações (Quadro, Lista, Backlog, Sprints) movidas para tabs no topo
  (`27a9d78`).
- Aba Dashboard por projeto no ViewTabs (`975b23f`).
- Botão "Atribuir acesso a board" em cada linha da tabela de Membros (`bca7dea`).
- Modal de atribuir board mostra acessos atuais e permite remover (`cbee134`).
- Notificações + sprint workflow + badge cliente/interno (migration 031) (`60e390e`).
- Regras de serviço/cliente por contexto do projeto (`b06f741`).

### Fixed
- API ticket auto-resolve `project_id` a partir do `board_id`; modal usa
  `board_id` da URL (`55b1e0a`).
- Aprovação `org_access` pode atribuir board/projeto no mesmo fluxo (`9efa512`).
- Responsável e Relator no modal filtrados pelo acesso ao projeto/board (`50689d2`).
- `Cronograma` filtra por projeto/board; Timesheet API protegida pra admin
  (`7c3ce6f`).
- `Lista` e `Backlog` filtram por `board_id`/`project_id` da URL (`c6b2664`).
- Sidebar escondida pra usuário não aprovado + tela de aprovação fullscreen
  (`51c66c0`).
- Drag-and-drop salvava status incorretamente — pattern matching com `LIKE`
  case-insensitive (`db65ee7`, `ad15aad`, `79f328d`).

---

## 2026-04 (início) — Tema, dashboard premium e Clerk

### Added
- **Migração de auth para Clerk** (`ea10505`).
- **Sistema de tema claro/escuro completo** (`6f63a1d`).
- **Dashboard premium**: velocity chart, donut central, ranking, performance
  cards (`ddb7ddb`, `ab8bafc`).
- **Acessibilidade completa** (Fase 5) (`854e95a`).
- **Confluence-like wiki/docs** + fluxo de aprovação para criação de projetos
  (migrations 018, 019) (`0f1d87e`).
- **RBAC multi-tenant**: catálogo de permissões, grupos, cargos (migrations
  012, 013, 016) + MongoDB para coleções NoSQL (`07c656e`, `ae11c68`).
- **Visão por projeto** — cliente só vê os projetos/boards que tem acesso
  (`870e81f`).
- **Google Drive como storage de arquivos** (fallback Supabase) (`e392ab3`).
- **Optimistic Concurrency Control (OCC)** para edição de tickets (`d61ea17`).
- **Dockerfile** + standalone output para deploy no EasyPanel (`81907aa`).
- `FULL_SETUP.sql` com todas as migrations unificadas (`33d6b0c`).
- Seed do projeto Breakr com 30 tarefas (`e4b7905`).
- Filtros salvos, boards recentes, equipes, Gantt timeline (`e61d6f8`).
- Avatar nos comentários, tags maiores no card estilo ClickUp (`a51c272`).
- Modal de confirmação customizado substituindo `confirm()` nativo (`aaa3e38`).
- Membros entram como `member`, role lido de `org_roles`, API de role separada
  (`78f636f`).
- Boards CRUD com RBAC enforced (`2ffbd8c`).
- RBAC enforced em 21 APIs + sidebar filtrada + docs access + approval auth
  (`1272b68`).

### Fixed
- 5 problemas críticos encontrados na auditoria final (`b315ac8`).
- OCC desabilitado temporariamente — causava falso conflito em todos os
  tickets (`56e3bc0`).
- Auto-create member usa `gen_random_uuid()` + busca por email primeiro
  (`69ad4c2`).
- ApprovalGate em Lista, Backlog e Dashboard (`c90757f`, `d27ab4a`).
- Build não crasha sem `DATABASE_URL` (`304145b`).
- Tema claro premium — sidebar escura, textos pretos, hovers visíveis
  (`4ad1512`).

---

Para o histórico completo, ver `git log`.
