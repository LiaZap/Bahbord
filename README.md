# Bahboard

Sistema de gestão de projetos profissional construído com Next.js 14, Clerk, Postgres e Supabase.

## Features principais

- Kanban board com drag & drop
- Dashboard com gráficos e métricas
- Sprints com burndown chart
- Comentários com @mention e reações
- IA: gerar descrição e resumir threads
- Automações (rules engine)
- Relatórios e exports (CSV/PDF)
- Links públicos para clientes
- Integração GitHub (PRs e commits)
- Tema claro/escuro
- Command Palette (Cmd+K)

## Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- PostgreSQL
- Clerk (auth)
- Supabase (realtime)
- Anthropic Claude (AI)
- Google Drive (file uploads)

## Setup local

1. Clone o repo
2. Copy `.env.example` to `.env.local` and fill in values
3. Install: `npm install --legacy-peer-deps`
4. Run migrations: aplicar arquivos em `db/` no Postgres
5. Dev: `npm run dev`

## Scripts

- `npm run dev` - ambiente de desenvolvimento
- `npm run build` - build de produção
- `npm run typecheck` - verificar tipos
- `npm run test` - rodar testes
- `npm run lint` - lint

## Deploy

Deploy via EasyPanel ou Vercel. Requer `DATABASE_URL` e Clerk configurado.
