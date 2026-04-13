# CLAUDE.md — BahBoard

## Sobre o Projeto
BahBoard é um sistema interno de gestão de projetos estilo Kanban, inspirado no Jira, para a Bah!Company. Substitui o Jira como ferramenta de gerenciamento de tarefas da equipe.

## Tech Stack
- **Frontend:** Next.js 14 (App Router) + TypeScript strict
- **Styling:** Tailwind CSS (tema dark obrigatório, fundo #1d1f21)
- **Backend/DB:** Supabase (PostgreSQL + Auth + Realtime + Storage)
- **Drag-and-Drop:** @dnd-kit/core + @dnd-kit/sortable
- **Rich Text Editor:** @tiptap/react + @tiptap/starter-kit
- **Gráficos:** recharts
- **Ícones:** lucide-react
- **Datas:** date-fns (locale pt-BR)

## Conceitos-Chave do Sistema
- **Workspace:** Espaço de trabalho (Bah!Company, prefixo BAH)
- **Ticket:** Work item com key sequencial (BAH-001, BAH-002...)
- **Tipos de ticket:** História, Tarefa, Bug, Epic (com ícones e templates)
- **Serviço/Produto:** Campo OBRIGATÓRIO (BAHPROJECT, BAHVITRINE, BAHTECH, EQUINOX, LOVATTOFIT, BAHFLASH)
- **Categorias:** MANUTENÇÃO, PROJETO-NOVO (separadas de Serviço)
- **Status (colunas):** NÃO INICIADO → AGUARDANDO RESPOSTA (WIP:6) → EM PROGRESSO → CONCLUÍDO
- **Sprints:** Ciclos de trabalho com burndown
- **Hierarquia:** Tickets podem ter pai (BAH-781 pai de BAH-778) e subtarefas
- **Tickets vinculados:** Relacionamentos entre tickets (bloqueia, relaciona, duplica)
- **Reações rápidas:** Comentários pré-definidos com emoji

## Regras de Código
- TypeScript strict mode — sem `any`
- Componentes como funções com export default
- Hooks customizados em `/lib/hooks/`
- Todas as queries tipadas com `database.types.ts`
- Usar `cn()` utility para merge de classes Tailwind
- Server Components por padrão, "use client" só quando necessário
- Descrições armazenadas como JSONB (formato TipTap/ProseMirror)
- Usar view `tickets_full` para queries de leitura (JOIN otimizado)
- Datas sempre em `America/Sao_Paulo` timezone
- Textos da UI em português (pt-BR)

## Convenções
- Componentes: PascalCase (`TicketCard.tsx`)
- Hooks: camelCase com `use` (`useTickets.ts`)
- Utilitários: camelCase (`formatDate.ts`)
- Tabelas SQL: snake_case (`activity_log`)
- CSS vars: kebab-case (`--bg-primary`)
- Ticket key: UPPERCASE PREFIX + hífen + número (`BAH-815`)

## Banco de Dados (18 tabelas)
workspaces, members, ticket_types, statuses, services, categories, 
sprints, tickets, subtasks, ticket_links, comments, comment_reactions, 
quick_reactions, activity_log, time_entries, attachments, notifications, 
ticket_viewers

## Triggers Automáticos
- `trg_ticket_sequence`: auto-incrementa sequence_number ao criar ticket
- `trg_tickets_updated`: atualiza updated_at em qualquer UPDATE
- `trg_log_ticket_changes`: registra mudanças de status e assignee no activity_log
- Marca `completed_at` quando ticket vai para coluna is_done=true

## Design (Dark Theme)
- Fundo página: #1d1f21
- Sidebar: #1a1c1e
- Cards: #282a2e
- Colunas kanban: #22242a
- Inputs/hover: #373b41
- Texto principal: #c5c8c6
- Accent blue: #3b82f6
- Bordas: #373b41
- Sem bordas pesadas, shadows sutis

## Variáveis de Ambiente
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

## Comandos
```bash
npm run dev
npm run build
npx supabase db push
npx supabase gen types typescript --local > lib/types/database.types.ts
```
