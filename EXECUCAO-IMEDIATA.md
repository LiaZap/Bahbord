# BahBoard — GUIA DE EXECUÇÃO IMEDIATA
## Prompts prontos para colar no Claude Code

---

## ⚡ ANTES DE COMEÇAR

### 1. Criar projeto Supabase
- Acesse https://supabase.com/dashboard
- Crie um novo projeto chamado "bahboard"
- Copie a **Project URL** e a **anon public key**
- Guarde também a **service_role key** (em Settings > API)

### 2. Abrir terminal no diretório desejado
```bash
cd C:\Users\Paulo\Documents
```

### 3. Abrir Claude Code
```bash
claude
```

---

## 🚀 PROMPT 1 — CRIAR O PROJETO (Copie e cole tudo)

```
Crie um projeto chamado "bahboard" com Next.js 14 (App Router), TypeScript 
strict, Tailwind CSS e Supabase. Este é um sistema de gestão de projetos 
estilo Kanban para substituir o Jira.

PASSO 1 - Setup do projeto:
- npx create-next-app@14 bahboard --typescript --tailwind --app --src-dir=false
- Instalar dependências:
  npm install @supabase/supabase-js @supabase/ssr 
  npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
  npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-placeholder
  npm install lucide-react recharts date-fns clsx tailwind-merge

PASSO 2 - Criar arquivo .env.local na raiz:
NEXT_PUBLIC_SUPABASE_URL=<minha_url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<minha_anon_key>
SUPABASE_SERVICE_ROLE_KEY=<minha_service_key>

(Vou preencher os valores depois, por agora deixe os placeholders)

PASSO 3 - Criar a estrutura de pastas:
/app
  /(auth)/login/page.tsx
  /(dashboard)/layout.tsx
  /(dashboard)/page.tsx              → Dashboard (por agora, redirect para /board)
  /(dashboard)/board/page.tsx        → Kanban Board
  /(dashboard)/list/page.tsx         → Visão Lista (placeholder)
  /(dashboard)/ticket/[key]/page.tsx → Detalhe do ticket (placeholder)
  /(dashboard)/settings/page.tsx     → Configurações (placeholder)
  /api/webhooks/route.ts             → Webhooks (placeholder)
  layout.tsx                         → Root layout
  globals.css                        → Estilos globais
/components
  /board/                            → (vazio por agora)
  /tickets/                          → (vazio por agora)
  /layout/Sidebar.tsx
  /layout/Header.tsx
  /ui/Button.tsx
  /ui/Badge.tsx
  /ui/Avatar.tsx
  /ui/Modal.tsx
  /ui/Input.tsx
/lib
  /supabase/client.ts                → createBrowserClient
  /supabase/server.ts                → createServerClient
  /supabase/middleware.ts            → Auth middleware
  /hooks/                            → (vazio por agora)
  /types/database.types.ts           → (placeholder, será gerado)
  /utils/cn.ts                       → Utility classnames merge
  /utils/formatDate.ts               → Formatação de datas pt-BR

PASSO 4 - Configurar Supabase clients:

lib/supabase/client.ts:
- Usar createBrowserClient do @supabase/ssr
- Exportar função createClient()

lib/supabase/server.ts:
- Usar createServerClient do @supabase/ssr com cookies()
- Exportar função createClient()

lib/supabase/middleware.ts:
- Middleware que atualiza a sessão do Supabase
- Redirecionar para /login se não autenticado
- Permitir acesso a /login sem auth

PASSO 5 - middleware.ts na raiz:
- Importar updateSession de lib/supabase/middleware
- Matcher: proteger tudo exceto _next, favicon, /login

PASSO 6 - Configurar Tailwind (tailwind.config.ts):
- Tema dark como padrão
- Cores customizadas:
  bg-page: '#1d1f21'
  bg-sidebar: '#1a1c1e'  
  bg-card: '#282a2e'
  bg-column: '#22242a'
  bg-input: '#373b41'
  bg-hover: '#2d3036'
  text-primary: '#c5c8c6'
  text-secondary: '#969896'
  text-bright: '#ffffff'
  accent-blue: '#3b82f6'
  accent-green: '#22c55e'
  accent-yellow: '#f59e0b'
  accent-red: '#ef4444'
  accent-purple: '#a855f7'
  accent-orange: '#f97316'
  border-default: '#373b41'

PASSO 7 - globals.css:
- Fundo da página: bg-page
- Texto padrão: text-primary
- Scrollbar estilizada (dark)
- body com antialiased

PASSO 8 - Criar lib/utils/cn.ts:
import { clsx, ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)) }

PASSO 9 - Criar lib/utils/formatDate.ts:
- Função formatDate(date) → "13 de abr. de 2026"
- Função formatDateTime(date) → "13 de abr. de 2026 às 14:30"  
- Função timeAgo(date) → "há 2 horas", "há 3 dias"
- Usar date-fns com locale pt-BR

PASSO 10 - Página de Login /(auth)/login/page.tsx:
- Layout centralizado, fundo bg-page
- Card com logo "BahBoard" (texto estilizado, sem imagem)
- Form com email + senha
- Botão "Entrar" azul (accent-blue)
- Usar Supabase signInWithPassword
- Redirect para / após login

PASSO 11 - Layout do Dashboard /(dashboard)/layout.tsx:
Sidebar esquerda (w-64, bg-sidebar, fixed):
- Logo "BahBoard" no topo (texto bold, branco, tamanho grande)
- Divider sutil
- Navegação com ícones (lucide-react):
  - 📊 Resumo → /
  - 📋 Quadro → /board
  - 📝 Lista → /list
  - ⚙️ Configurações → /settings
- Item ativo: bg-hover com borda esquerda accent-blue
- Rodapé: avatar + nome do usuário + botão logout

Header (top, h-16, bg-card, sticky):
- Barra de busca (input com ícone Search)
- Botão "+ Criar" (bg accent-blue, branco, rounded)
- Ícone sino (Bell) para notificações
- Avatar do usuário

Área de conteúdo: padding adequado, scroll vertical

PASSO 12 - Componentes UI base:
- Button: variantes primary (azul), secondary (cinza), danger (vermelho), ghost (transparente)
- Badge: com prop color, texto pequeno, rounded-full, padding horizontal
- Avatar: imagem circular com fallback de iniciais
- Modal: overlay escuro, card centralizado, animação fade
- Input: bg-input, border-default, focus border-accent-blue

Crie tudo funcional e estilizado. O visual deve parecer profissional,
estilo Jira dark mode. Textos em português. Faça commit ao final.
```

---

## 🚀 PROMPT 2 — BANCO DE DADOS (Copie e cole tudo)

```
No projeto bahboard, crie o arquivo supabase/migrations/001_initial_schema.sql 
com o schema completo do banco de dados. Crie também um arquivo 
supabase/migrations/002_seed_data.sql com os dados iniciais.

SCHEMA (001_initial_schema.sql):

Crie as seguintes tabelas na ordem (respeitar foreign keys):

1. workspaces (id uuid PK, name text, slug text unique, prefix text, 
   description text, avatar_url text, created_at, updated_at)

2. members (id uuid PK, workspace_id FK→workspaces, user_id FK→auth.users, 
   role text CHECK owner/admin/member/viewer, display_name text, avatar_url text, 
   email text, created_at, UNIQUE workspace_id+user_id)

3. ticket_types (id uuid PK, workspace_id FK, name text, icon text, 
   color text, description_template text, position int, is_subtask boolean, created_at)

4. statuses (id uuid PK, workspace_id FK, name text, color text, 
   position int, wip_limit int nullable, is_done boolean, created_at)

5. services (id uuid PK, workspace_id FK, name text, color text, 
   description text, is_active boolean, created_at) 
   -- Este é o "BAH! Serviço/Produto" do Jira

6. categories (id uuid PK, workspace_id FK, name text, color text, created_at)

7. sprints (id uuid PK, workspace_id FK, name text, goal text, 
   start_date date, end_date date, is_active boolean, is_completed boolean, 
   created_at, completed_at)

8. tickets (id uuid PK, workspace_id FK, ticket_type_id FK→ticket_types, 
   service_id FK→services, status_id FK→statuses, category_id FK→categories, 
   sprint_id FK→sprints, parent_id FK→tickets SELF-REF, 
   assignee_id FK→members, reporter_id FK→members,
   sequence_number int NOT NULL, title text NOT NULL, description jsonb, 
   priority text CHECK urgent/high/medium/low DEFAULT medium,
   due_date date, started_at timestamptz, completed_at timestamptz,
   position int DEFAULT 0, is_archived boolean DEFAULT false, 
   created_at, updated_at)

9. subtasks (id uuid PK, ticket_id FK→tickets CASCADE, title text, 
   is_completed boolean, assignee_id FK→members, position int, 
   created_at, completed_at)

10. ticket_links (id uuid PK, source_ticket_id FK, target_ticket_id FK,
    link_type text CHECK blocks/is_blocked_by/relates_to/duplicates/is_duplicated_by,
    created_at, UNIQUE source+target)

11. comments (id uuid PK, ticket_id FK CASCADE, author_id FK→members, 
    content jsonb NOT NULL, created_at, updated_at)

12. comment_reactions (id uuid PK, comment_id FK CASCADE, member_id FK CASCADE,
    emoji text, created_at, UNIQUE comment+member+emoji)

13. quick_reactions (id uuid PK, workspace_id FK, emoji text, label text, 
    position int)

14. activity_log (id uuid PK, ticket_id FK CASCADE, actor_id FK→members,
    action text NOT NULL, field_name text, old_value text, new_value text, 
    created_at)

15. time_entries (id uuid PK, ticket_id FK CASCADE, member_id FK CASCADE,
    description text, started_at timestamptz, ended_at timestamptz,
    duration_minutes int, is_running boolean, created_at)

16. attachments (id uuid PK, ticket_id FK CASCADE, uploaded_by FK→members,
    file_name text, file_url text, file_size int, mime_type text, created_at)

17. notifications (id uuid PK, workspace_id FK, recipient_id FK→members CASCADE,
    actor_id FK→members, ticket_id FK CASCADE, type text, title text, 
    message text, is_read boolean, created_at)

18. ticket_viewers (ticket_id FK, member_id FK, last_viewed_at, PK ticket+member)

ÍNDICES:
- tickets: workspace_id, status_id, assignee_id, service_id, sprint_id, parent_id, (workspace_id, sequence_number)
- activity_log: ticket_id
- comments: ticket_id
- subtasks: ticket_id
- time_entries: ticket_id
- notifications: (recipient_id, is_read)
- ticket_links: source_ticket_id, target_ticket_id

TRIGGERS:
1. generate_ticket_sequence() - BEFORE INSERT em tickets:
   Pega MAX(sequence_number) do workspace + 1

2. update_timestamp() - BEFORE UPDATE em tickets e comments:
   Seta updated_at = NOW()

3. log_ticket_changes() - BEFORE UPDATE em tickets:
   - Se status_id mudou → INSERT activity_log com action='status_changed'
   - Se assignee_id mudou → INSERT activity_log com action='assigned'
   - Se status novo is_done=true e completed_at é null → seta completed_at = NOW()
   - Se status novo is_done=false → limpa completed_at

VIEW:
Criar view tickets_full que faz JOIN de tickets com:
workspaces (prefix, name), ticket_types (name, icon, color), 
statuses (name, color, is_done), services (name, color), 
categories (name, color), sprints (name, is_active),
members AS assignee (display_name, avatar_url),
members AS reporter (display_name, avatar_url),
tickets AS parent (sequence_number, title)
+ subqueries para: subtask_count, subtask_done_count, comment_count, 
  viewer_count, total_time_minutes
Filtrar WHERE is_archived = false

SEED DATA (002_seed_data.sql):

Workspace: Bah!Company, slug=bahcompany, prefix=BAH

Ticket types:
- História (📘, #3b82f6, template: "**História de usuário:**\n\n**Critério de aceitação:**\n\n**Observação:**")
- Tarefa (✅, #22c55e, template: "**Descrição da tarefa:**\n\n**Passo a passo:**")
- Bug (🐛, #ef4444, template: "**Passos para reproduzir:**\n\n**Comportamento esperado:**\n\n**Comportamento atual:**")
- Epic (⚡, #a855f7, template: "**Objetivo:**\n\n**Escopo:**\n\n**Critério de sucesso:**")

Statuses (na ordem):
- NÃO INICIADO (#6b7280, pos=0, wip=null, done=false)
- AGUARDANDO RESPOSTA (#f59e0b, pos=1, wip=6, done=false)
- EM PROGRESSO (#3b82f6, pos=2, wip=null, done=false)
- CONCLUÍDO (#22c55e, pos=3, wip=null, done=true)

Services:
- BAHPROJECT (#6366f1)
- BAHVITRINE (#22c55e)
- BAHTECH (#3b82f6)
- EQUINOX (#eab308)
- LOVATTOFIT (#f97316)
- BAHFLASH (#a855f7)

Categories:
- MANUTENÇÃO (#6b7280)
- PROJETO-NOVO (#8b5cf6)

Quick reactions:
- 🎉 Ficou bom!
- 👋 Precisa de ajuda?
- 🚫 Este item está bloqueado...
- 💬 Você pode...

Sprint:
- Sprint 23, 2026-04-01 a 2026-04-14, is_active=true

Imprima instruções de como rodar estas migrações no Supabase 
(tanto via Dashboard SQL Editor quanto via CLI). Faça commit.
```

---

## 🚀 PROMPT 3 — KANBAN BOARD (Copie e cole tudo)

```
No projeto bahboard, crie o Kanban Board completo em /board.

Crie estes componentes:

1. components/board/KanbanBoard.tsx (client component):
- Buscar statuses do Supabase ordenados por position
- Buscar tickets usando a view tickets_full, filtrados por workspace
- Agrupar tickets por status_id
- Renderizar KanbanColumn para cada status
- Usar DndContext do @dnd-kit/core para drag-and-drop global
- Ao final do drag (onDragEnd):
  - Atualizar status_id e position do ticket no Supabase
  - Optimistic update (atualizar UI antes da resposta do banco)
- Configurar Supabase Realtime subscription na tabela tickets
  - Quando receber INSERT/UPDATE/DELETE, atualizar o state local

2. components/board/KanbanColumn.tsx:
- Props: status (com name, color, wip_limit), tickets[], contagem
- Header da coluna:
  - Nome do status em bold branco
  - Badge com contagem de tickets
  - Se tem wip_limit: badge "MAX: 6" (amarelo se atingido, vermelho se excedido)
- Usar SortableContext do @dnd-kit/sortable para reordenação
- Renderizar TicketCard para cada ticket
- Fundo: bg-column com rounded-lg
- Se coluna está no WIP limit: borda amarela sutil

3. components/board/TicketCard.tsx:
- Props: ticket (do tickets_full)
- Usar useSortable do @dnd-kit para tornar arrastável
- Layout do card (bg-card, rounded, padding, hover:bg-hover, cursor-grab):
  TOPO:
  - Ticket key (BAH-815) em text-secondary, fonte pequena
  - Ícone do tipo (📘/✅/🐛/⚡) ao lado do key
  
  MEIO:
  - Título em text-bright, font-medium, max 2 linhas com line-clamp
  
  BADGES (flex wrap, gap pequeno):
  - Badge do Serviço/Produto (cor do service, texto branco)
  - Badge da Categoria (se houver)
  
  RODAPÉ (flex justify-between):
  - Esquerda: data limite com ícone Calendar (vermelho se vencido, cinza se ok)
  - Direita: Avatar do responsável (32px, circular)
  
  BORDA ESQUERDA: 3px colorida pela prioridade
  - urgent=#ef4444, high=#f97316, medium=#3b82f6, low=#6b7280

  Durante arraste: opacity-50, shadow-lg, rotate 2deg

  Ao clicar no card: navegar para /ticket/[key] ou abrir modal de detalhe

4. components/board/BoardFilters.tsx:
- Barra horizontal acima do board
- Filtros:
  - Busca por texto (input com ícone Search, filtra por título e key)
  - Por Serviço/Produto: badges clicáveis, toggle on/off
  - Por Responsável: avatares clicáveis, toggle on/off  
  - Por Categoria: badges clicáveis
  - Por Tipo: ícones clicáveis (📘✅🐛⚡)
- Botão "Limpar filtros" (aparece quando há filtro ativo)
- Todos os filtros são client-side (filtram o state local)

5. components/board/SprintHeader.tsx:
- Se tem sprint ativo, mostra barra acima dos filtros:
  - Nome: "Sprint 23"
  - Datas: "01 abr - 14 abr"
  - Dias restantes: "5 dias restantes" (ou "Finalizado" se passou)
  - Botão "Concluir sprint" (accent-blue)

6. app/(dashboard)/board/page.tsx:
- Server component que busca workspace do usuário logado
- Renderiza SprintHeader + BoardFilters + KanbanBoard
- Título da página: nome do workspace

Crie também o hook lib/hooks/useBoard.ts que encapsula:
- Fetch inicial de statuses e tickets
- Realtime subscription
- Função moveTicket(ticketId, newStatusId, newPosition)
- State de filtros
- Função de filtrar tickets

O visual deve ser idêntico ao Jira dark mode. Cards com espaçamento 
de 8px entre eles, colunas com gap de 12px, scroll horizontal se 
necessário. Fundo da página bg-page. Faça commit ao final.
```

---

## 🚀 PROMPT 4 — MODAL DE CRIAÇÃO DE TICKET (Copie e cole tudo)

```
No projeto bahboard, crie o modal de criação de ticket.

Crie components/tickets/CreateTicketModal.tsx:

Modal que abre ao clicar no botão "+ Criar" do header.
Layout: overlay escuro, card centralizado (max-w-2xl), scrollável.

HEADER DO MODAL:
- Título: "Criar [Tipo]" (ex: "Criar História", "Criar Bug")
- Botões: minimizar, expandir, menu (⋯), fechar (✕)

CAMPOS (na ordem, todos com labels em português):

1. "Espaço" - Select readonly mostrando "Bah!Company (BAH)" com ícone
2. "Tipo do ticket" - Select com opções:
   - 📘 História (selecionado por padrão)
   - ✅ Tarefa
   - 🐛 Bug
   - ⚡ Epic
   Ao mudar: atualizar template da descrição e título do modal

3. "Status" - Select com statuses do workspace (padrão: primeiro/NÃO INICIADO)

4. "Resumo" - Input text, obrigatório, placeholder "Resumo do ticket"
   Estilo: fundo bg-input, borda accent-blue quando focado

5. "Descrição" - Editor rich text usando TipTap:
   - Toolbar com: Bold, Italic, Underline, Lista bullet, Lista numerada,
     Heading, Link, Código, Divider
   - Conteúdo pré-preenchido com template baseado no tipo:
     História → "**História de usuário:**\n\n**Critério de aceitação:**\n\n**Observação:**"
     Tarefa → "**Descrição da tarefa:**\n\n**Passo a passo:**"
     Bug → "**Passos para reproduzir:**\n\n**Comportamento esperado:**\n\n**Comportamento atual:**"
     Epic → "**Objetivo:**\n\n**Escopo:**\n\n**Critério de sucesso:**"

6. "Data limite" - Input date com ícone calendário

7. "Responsável" - Select com membros do workspace (avatar + nome)
   - Opção padrão: "Automático"
   - Link "Atribuir a mim" que seleciona o usuário logado

8. "BAH! Serviço/Produto" - Select OBRIGATÓRIO
   - Se vazio ao tentar criar: mensagem de erro vermelha 
     "BAH! Serviço/Produto é obrigatório."
   - Opções: BAHPROJECT, BAHVITRINE, BAHTECH, EQUINOX, LOVATTOFIT, BAHFLASH
   - Cada opção com badge colorido

9. "Pai" - Autocomplete search
   - Input que busca tickets existentes pelo key ou título
   - Mostra: "BAH-781 HUMANIZA" com link
   - Checkbox "Mostrar tudo marcado como concluído" para incluir tickets done

10. "Categoria" - Select com categorias (MANUTENÇÃO, PROJETO-NOVO)

11. "Sprint" - Select com sprints
    - Se sprint ativo selecionado: warning amarelo 
      "A criação desse ticket vai afetar o escopo do sprint ativo"
    - Ícone ⚙️ ao lado do select

12. "Relator" - Select pré-preenchido com usuário logado, editável

13. "Prioridade" - Select visual:
    - 🔴 Urgente
    - 🟠 Alta  
    - 🔵 Média (padrão)
    - ⚪ Baixa

FOOTER:
- Checkbox "Criar outro" (se marcado, limpa form e mantém modal aberto)
- Botão "Cancelar" (ghost)
- Botão "Criar" (accent-blue, disabled enquanto campos obrigatórios vazios)

COMPORTAMENTO:
- Ao criar: insert na tabela tickets via Supabase
- sequence_number gerado pelo trigger
- Fechar modal (ou manter se "criar outro")
- Toast de sucesso: "BAH-XXX criado com sucesso"
- Board atualiza via Realtime

Crie também um componente components/editor/RichTextEditor.tsx 
usando TipTap com a toolbar descrita acima. Estilo dark: fundo bg-input, 
texto text-primary, toolbar com botões icon cinza que ficam brancos quando ativos.

Faça commit ao final.
```

---

## 🚀 PROMPT 5 — DETALHE DO TICKET (Copie e cole tudo)

```
No projeto bahboard, crie a página/modal de detalhe do ticket.

Quando o usuário clicar em um card no board, abrir um modal fullscreen 
(ou page em /ticket/[key]) com layout split:

LAYOUT:
┌────────────────────────────────────────────────────┐
│ 🔗 BAH-781 / 📋 BAH-778        👁 2   🔗  ⋯  ✕  │
├──────────────────────────┬─────────────────────────┤
│ COLUNA ESQUERDA (60%)    │ COLUNA DIREITA (40%)    │
│                          │                         │
│ [Status badge ▼]         │ ▼ Informações           │
│                          │                         │
│ Título (h1, editável)    │ Data limite: [picker]   │
│ [+ ícone] [⚙ ícone]     │ Responsável: [select]   │
│                          │ Serviço/Prod: [select]  │
│ ▼ Descrição              │ Pai: [autocomplete]     │
│ [Rich text editável]     │ Categorias: [select]    │
│                          │ Sprint: [select]        │
│ Subtarefas               │ Relator: [select]       │
│ [lista com checkboxes]   │ Prioridade: [select]    │
│ + Adicionar subtarefa    │ Tipo: [select]          │
│                          │                         │
│ Tickets vinculados       │ ▶ Time Tracking         │
│ [lista de links]         │   [▶ Start] [total: 2h] │
│ + Adicionar vínculo      │                         │
│                          │ ▶ Timesheet             │
│ ▼ Atividade              │   Total: 4h 30min       │
│ [Tudo][Coment][Histór]   │                         │
│ [Reg.Ativ][Time Status]  │ Criado: 11/03/2026      │
│                          │ Atualizado: 13/04/2026  │
│ [Editor de comentário]   │                         │
│ [Reações rápidas]        │ ⚙ Configurar            │
└──────────────────────────┴─────────────────────────┘

COLUNA ESQUERDA:

1. BREADCRUMB (topo):
   - Se tem parent_id: mostrar "🔗 BAH-781 / 📋 BAH-778" como links
   - Clicável: navegar ao ticket pai

2. HEADER:
   - Status: badge colorido com dropdown para mudar 
     (Concluído=verde, Em Progresso=azul, etc.)
   - Quando muda: salva no banco + registra activity_log
   - Se status is_done: mostrar "✓ Itens concluídos" ao lado

3. TÍTULO:
   - Editável inline: ao clicar, vira input
   - Ao perder foco ou Enter: salva no banco
   - Font size grande, bold, branco

4. DESCRIÇÃO:
   - Editor RichText (TipTap) 
   - Editável inline (clica para editar, blur para salvar)
   - Mostra template se vazio

5. SUBTAREFAS:
   - Título "Subtarefas" com contagem (ex: "2/5")
   - Barra de progresso visual (verde)
   - Lista de subtarefas:
     - Checkbox + título + avatar do responsável
     - Ao marcar: atualizar is_completed + completed_at
   - Input "+ Adicionar subtarefa" no final
   - Drag-and-drop para reordenar

6. TICKETS VINCULADOS:
   - Lista agrupada por tipo de vínculo ("bloqueia", "relaciona-se com")
   - Cada item: ticket_key clicável + título + status badge
   - Botão "+ Adicionar ticket vinculado":
     - Modal com busca de tickets + select do tipo de vínculo

7. ATIVIDADE (5 abas):
   a) Tudo: comentários + mudanças intercalados por data
   b) Comentários: apenas comentários
   c) Histórico: mudanças de campo (do activity_log):
      "Paulo Vitor moveu de 'Em Progresso' para 'Concluído' — há 2h"
      "Douglas atribuiu a Paulo Vitor — há 1 dia"
   d) Registro de atividades: log completo detalhado
   e) Time in Status: tabela mostrando quanto tempo ficou em cada status
      (calcular a partir do activity_log)

8. COMENTÁRIOS:
   - Editor de texto com avatar do usuário logado
   - Placeholder: "Adicionar comentário..."
   - Botões de reação rápida abaixo:
     "🎉 Ficou bom!" "👋 Precisa de ajuda?" "🚫 Este item está bloqueado..." "💬 Você pode..."
   - Ao clicar na reação: inserir como comentário automático
   - Lista de comentários: avatar, nome, data relativa, conteúdo
   - Hover mostra: editar (✏️) e deletar (🗑️) para comentários próprios
   - Dica: "aperte M para fazer comentários"

9. VIEWERS:
   - Ícone olho + número (👁 2)
   - Ao abrir o ticket: registrar/atualizar ticket_viewers
   - Tooltip mostra quem visualizou

COLUNA DIREITA:

Seção "Informações" com todos os campos editáveis via dropdown/picker:
- Cada campo: label cinza à esquerda, valor à direita
- Ao clicar no valor: abre dropdown/picker inline
- Ao mudar: salva no banco + registra activity_log

Campos:
- Data limite: date picker (mostrar "Nenhum" se vazio)
- Responsável: select com avatar + nome
- BAH! Serviço/Produto: select com badge colorido
- Pai: autocomplete de tickets + link clicável
- Categorias: select com badge
- Sprint: select (mostrar Sprint 23 +1 se múltiplos)
- Relator: select com avatar + nome
- Prioridade: select visual com cores
- Tipo: select com ícones

Seção "Time Tracking":
- Botão "▶ Start" para iniciar timer (insere time_entry com is_running=true)
- Quando rodando: mostra timer ao vivo "⏱ 00:15:32" + botão "⏹ Stop"
- Ao parar: calcula duration_minutes, seta is_running=false
- Total do ticket: soma de todas as time_entries

Seção "Timesheet":
- Total: "4h 30min"
- Link para ver detalhes (lista de time_entries)

Footer:
- "Criado DD de MMM de YYYY às HH:MM"
- "Atualizado há X horas"
- Botão "⚙ Configurar" (futuro)

REALTIME:
- Subscription no ticket específico
- Quando outro usuário edita, atualiza a tela em tempo real

Crie os seguintes componentes:
- components/tickets/TicketDetailModal.tsx (container principal)
- components/tickets/TicketSidebar.tsx (coluna direita)
- components/tickets/SubtaskList.tsx
- components/tickets/LinkedTickets.tsx
- components/tickets/ActivityTimeline.tsx
- components/tickets/CommentSection.tsx
- components/tickets/QuickReactions.tsx
- components/tickets/TimeTracker.tsx

E os hooks:
- lib/hooks/useTicketDetail.ts
- lib/hooks/useComments.ts
- lib/hooks/useSubtasks.ts
- lib/hooks/useTimeTracking.ts
- lib/hooks/useActivityLog.ts

Faça commit ao final.
```

---

## 🚀 PROMPT 6 — CONFIGURAÇÕES (Copie e cole tudo)

```
No projeto bahboard, crie a área de configurações em /settings.

Página /settings com sidebar de navegação interna:
- Geral
- Membros  
- Colunas (Status)
- Serviços/Produtos
- Categorias
- Tipos de ticket
- Reações rápidas

CADA SUBPÁGINA:

1. GERAL (/settings):
   - Editar: nome do workspace, descrição, prefixo dos tickets
   - Preview: "Os tickets serão criados como BAH-XXX"
   - Botão salvar

2. MEMBROS (/settings/members):
   - Tabela: avatar, nome, email, role, data de entrada
   - Botão "Convidar membro" (email + role)
   - Dropdown para mudar role
   - Botão remover (com confirmação)

3. COLUNAS (/settings/statuses):
   - Lista de status com drag-and-drop para reordenar
   - Cada item mostra: cor (circle), nome, WIP limit, badge "Concluído" se is_done
   - Editar inline: nome, cor (color picker), WIP limit (number input)
   - Toggle is_done
   - Botão adicionar novo status
   - Botão deletar (com confirmação, não permite se tem tickets)
   - Preview visual: mini kanban mostrando como ficará

4. SERVIÇOS/PRODUTOS (/settings/services):
   - Lista com: badge colorido, nome, status (ativo/inativo)
   - CRUD completo
   - Color picker para cor do badge
   - Toggle ativo/inativo

5. CATEGORIAS (/settings/categories):
   - Lista com badge + nome
   - CRUD + color picker

6. TIPOS DE TICKET (/settings/ticket-types):
   - Lista: ícone, nome, cor
   - Editar ícone (emoji picker ou input)
   - Editar template de descrição (textarea com preview Markdown)
   - Reordenar com drag-and-drop

7. REAÇÕES RÁPIDAS (/settings/quick-reactions):
   - Lista: emoji + label
   - CRUD
   - Reordenar

Estilo: fundo bg-page, cards bg-card, inputs bg-input.
Todas as operações com feedback visual (loading, toast de sucesso/erro).
Faça commit ao final.
```

---

## 📋 RESUMO DA EXECUÇÃO

| Dia | O que fazer | Prompt |
|-----|-------------|--------|
| **Dia 1** | Criar projeto + layout + login | Prompt 1 |
| **Dia 1** | Rodar migrações SQL no Supabase | Prompt 2 |
| **Dia 2-3** | Kanban Board com drag-and-drop | Prompt 3 |
| **Dia 3-4** | Modal de criação de ticket | Prompt 4 |
| **Dia 4-6** | Detalhe do ticket completo | Prompt 5 |
| **Dia 6-7** | Configurações | Prompt 6 |

**MVP funcional em ~7 dias de trabalho.**

Depois do MVP, os próximos passos seriam:
- Visão Lista (tabela com ordenação e ações em lote)
- Dashboard com gráficos (recharts)
- Sprint management completo
- Webhooks + integração n8n
- Notificações WhatsApp via UazAPI
- Cronograma/Timeline view

---

## ⚠️ TROUBLESHOOTING COMUM

**Erro: "relation does not exist"**
→ As migrações SQL não foram executadas. Rode no SQL Editor do Supabase.

**Erro: RLS policy violation**
→ Por agora, desabilite RLS nas tabelas para desenvolvimento:
```sql
ALTER TABLE tickets DISABLE ROW LEVEL SECURITY;
```
Habilitar novamente antes de ir para produção.

**Erro: "User not found in members"**
→ Após criar usuário via Auth, precisa inserir na tabela members manualmente:
```sql
INSERT INTO members (workspace_id, user_id, role, display_name, email)
VALUES ('SEU_WORKSPACE_ID', 'SEU_USER_ID', 'owner', 'Angelo', 'seu@email.com');
```

**Erro: Realtime não funciona**
→ No Supabase Dashboard > Database > Replication, habilitar as tabelas 
tickets, comments, notifications para Realtime.

**TipTap não renderiza**
→ Verificar se instalou @tiptap/react E @tiptap/starter-kit.
O TipTap precisa de CSS mínimo para o editor ter altura.
