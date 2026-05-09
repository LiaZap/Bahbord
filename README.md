# Bah!Flow

Sistema de gestão de projetos (kanban, sprints, tickets, time tracking, IA) construído em Next.js 14 + Postgres.

## Stack

- Next.js 14 (App Router) + TypeScript estrito
- Postgres (sem ORM — queries cruas via `lib/db.ts`)
- Clerk (autenticação)
- OpenAI `gpt-4.1-mini` (IA — descrição, prioridade, chat SQL)
- Supabase (realtime para notificações + storage de anexos)
- Google Drive (upload de arquivos para tickets)
- Tailwind CSS + tokens em CSS vars (estilo Linear/Vercel)
- Resend (e-mail transacional)
- MongoDB (audit-trail histórico — opcional)
- Sentry (monitoring — opcional)
- Playwright (E2E)
- Deploy via EasyPanel + Docker

## Setup local

```bash
# 1. Clone
git clone <repo-url>
cd Bahjira

# 2. Dependências (a flag é necessária — conflito de peers do React 18)
npm install --legacy-peer-deps

# 3. Variáveis de ambiente
cp .env.example .env.local
# Preencha conforme docs/ENV.md

# 4. Migrations (banco já criado e DATABASE_URL no .env.local)
# Aplica as 44 migrations em ordem. Detalhes em docs/MIGRATIONS.md
for f in db/0*.sql; do psql "$DATABASE_URL" -f "$f"; done

# 5. Dev server
npm run dev
# http://localhost:3000
```

## Setup produção (Docker / EasyPanel)

O `Dockerfile` na raiz é multi-stage (deps → builder → runner) e usa a saída
`output: 'standalone'` do Next 14. As variáveis `NEXT_PUBLIC_*` precisam ser
passadas como **build args** porque o Next inlineia em build time.

EasyPanel:

1. Crie um app do tipo **App** apontando para o repositório.
2. Em **Build**, escolha **Dockerfile** e adicione os build args:
   `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` (e demais `NEXT_PUBLIC_*` se usar).
3. Em **Environment**, adicione as variáveis runtime
   (`DATABASE_URL`, `CLERK_SECRET_KEY`, `OPENAI_API_KEY`, etc).
4. Em **Networking**, exponha a porta `3000`.
5. Após o primeiro deploy, abra o **Console** do app e rode as migrations
   (a pasta `db/` é copiada para a imagem):
   ```bash
   for f in db/0*.sql; do psql "$DATABASE_URL" -f "$f"; done
   ```

## Variáveis de ambiente

Lista completa, por categoria, em [`docs/ENV.md`](docs/ENV.md).

## Migrations

44 migrations sequenciais em `db/0XX_*.sql`. Todas idempotentes
(`IF NOT EXISTS`, `DO $$ BEGIN ... EXCEPTION ... END $$`). Detalhes,
ordem e descrição em [`docs/MIGRATIONS.md`](docs/MIGRATIONS.md).

## Estrutura do projeto

Arquitetura, fluxos (auth, RBAC, aprovações, IA, webhooks, cron, audit) e
decisões de design em [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md).

API REST documentada em [`docs/API.md`](docs/API.md).

## Scripts disponíveis

| Script | O que faz |
|--------|-----------|
| `npm run dev` | Next dev server (porta 3000). |
| `npm run build` | Build de produção. |
| `npm start` | Roda o build de produção. |
| `npm run lint` | ESLint via `next lint`. |
| `npm run typecheck` | `tsc --noEmit`. |
| `npm test` | Vitest (unitários, headless). |
| `npm run test:watch` | Vitest em watch mode. |
| `npm run e2e` | Playwright em modo headless. |
| `npm run e2e:ui` | Playwright em modo UI interativo. |

## Features principais

- Quadro Kanban com drag & drop entre colunas
- Lista, Backlog, Cronograma e visão de Sprints por projeto
- Sprints com burndown chart e fluxo "concluir → próxima"
- Tickets com subtasks, comentários, @menções, reações, anexos
- Time tracking (timer + log manual + edição inline da duração)
- Timesheet com filtros por período/projeto/board
- IA: gerar descrição, sugerir prioridade, resumir thread, chat SQL admin
- Fluxo de aprovação multi-stage (org_access, project_access, project_creation)
- RBAC em 3 níveis: workspace, projeto e board (com herança)
- Recurring tickets (cron) com fuso `America/Sao_Paulo`
- Templates de projeto e templates de ticket
- Bulk actions (arquivar, mover, atribuir, prioridade)
- Saved views — combinações de filtros como atalho na sidebar
- Webhooks de saída (Slack, Discord, genérico) e de entrada (GitHub, Clerk)
- Audit log (Postgres) + audit-trail histórico (MongoDB opcional)
- Share links públicos read-only para clientes
- Integração GitHub (vincula PRs/commits a tickets via `[PREFIX-NUM]`)
- Notificações realtime (Supabase) + e-mail (Resend) + WhatsApp opcional
- Onboarding wizard pós-primeiro-login do owner
- Tema claro/escuro com tokens CSS vars
- Command palette (Cmd+K)

## Tests E2E

Os testes E2E (Playwright) ficam em `e2e/` e cobrem três fluxos críticos:
criar ticket, mover card entre colunas (drag-and-drop) e criar comentário.

Para rodar localmente:

1. Suba o Postgres em `localhost:5432` com seed aplicado.
2. Configure `CLERK_TEST_EMAIL` e `CLERK_TEST_PASSWORD` no `.env.local`
   apontando para um usuário de teste **já aprovado** no Clerk Dashboard
   (a auth roda via [Clerk Testing Tokens](https://clerk.com/docs/testing/playwright)).
3. Defina `E2E_BOARD_ID` (UUID de um board existente) e opcionalmente
   `E2E_TICKET_ID`.
4. Rode `npm run e2e`.

O Playwright sobe o `npm run dev` automaticamente (ou reusa um já em execução).
Use `npm run e2e:ui` para o modo interativo.

## Backup

Backup diário do Postgres roda via GitHub Actions
(`.github/workflows/backup.yml`) todos os dias às 03:00 UTC. O job usa
`pg_dump --format=custom --no-acl --no-owner` (script em
`scripts/backup-db.sh`), gera um arquivo `backup-YYYY-MM-DD-HHmm.dump`,
sobe pro S3 (`s3://$BACKUP_S3_BUCKET/postgres/`) e mantém localmente os
backups dos últimos 7 dias.

Secrets necessários no repositório: `DATABASE_URL`, `AWS_ACCESS_KEY_ID`,
`AWS_SECRET_ACCESS_KEY`, `BACKUP_S3_BUCKET` e opcionalmente `AWS_REGION`
(default `us-east-1`).

Para rodar manualmente:

```bash
DATABASE_URL=... BACKUP_S3_BUCKET=... ./scripts/backup-db.sh
```
