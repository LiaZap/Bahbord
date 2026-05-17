# Frontend — Arquitetura

## Tech Stack

| Tecnologia | Versão | Uso |
|-----------|--------|-----|
| Next.js | 14.2.5 | App Router, SSR, API routes |
| React | 18.3.1 | UI framework |
| TypeScript | 5.5.4 | Tipagem estrita |
| Tailwind CSS | 3.4.4 | Estilização + design tokens |
| next-intl | 4.11.1 | i18n (cookie-based, sem URL prefix) |
| Sentry | 8.40.0 | Monitoramento de erros |

---

## Estrutura de Rotas

### Públicas (sem autenticação)

| Rota | Descrição |
|------|-----------|
| `/sign-in` | Login (Clerk SignIn) |
| `/sign-up` | Cadastro (Clerk SignUp) |
| `/share/[slug]` | Links públicos de board/ticket |
| `/feedback` | Formulário de feedback |

### Protegidas (autenticação obrigatória)

| Rota | Descrição | Guard |
|------|-----------|-------|
| `/` | Dashboard (analytics global) | `requireAdmin()` |
| `/my-tasks` | Tarefas pessoais | `requireApproved()` |
| `/board` | Kanban board | `requireApproved()` |
| `/list` | Visão lista | `requireApproved()` |
| `/backlog` | Backlog | `requireApproved()` |
| `/sprints` | Gestão de sprints | `requireApproved()` |
| `/projects/[id]` | Detalhe de projeto | `requireApproved()` |
| `/teams` | Times | `requireApproved()` |
| `/clients` | Clientes | `requireApproved()` |
| `/reports` | Relatórios | `requireApproved()` |
| `/roadmap` | Roadmap/Iniciativas | `requireApproved()` |
| `/docs` | Base de conhecimento | `requireApproved()` |
| `/inbox` | Triagem | `requireApproved()` |
| `/settings` | Configurações | `requireAdmin()` |
| `/onboarding` | Setup inicial | `requireAuth()` |

---

## Organização de Componentes

```
components/
├── ui/             ← Design system (primitivos reutilizáveis)
│   ├── Button, Input, Badge, Modal, Toast, Tooltip
│   ├── CommandPalette, KeyboardShortcuts, NotificationCenter
│   ├── SearchModal, ConfirmModal, ApprovalGate
│   ├── AIChat, VirtualList, Skeleton, Avatar
│   └── empty-illustrations/
├── layout/         ← Shell da aplicação
│   ├── Sidebar, Header, Navbar, ViewTabsWrapper
├── board/          ← Kanban (feature principal)
│   ├── KanbanBoard, KanbanColumn, TicketCard
│   ├── BoardFilters, BoardShell, BulkActionBar
│   ├── SavedFilters, CreateTicketModal
├── tickets/        ← Detalhe/lista de tickets
│   ├── ActivityTimeline, SubtaskList, TicketSidebar
├── sprints/        ← Gestão de sprints
│   ├── SprintBurndown
├── dashboard/      ← Gráficos e métricas
├── reports/        ← Analytics
├── roadmap/        ← Iniciativas
├── projects/, clients/, teams/
├── docs/, inbox/, calendar/, timeline/
├── editor/         ← Rich text (TipTap)
├── settings/       ← Configurações (20+ abas)
├── filters/, list/, personal/, onboarding/
└── public/, changelog/
```

---

## State Management

**Padrão: Context API + Custom Hooks (sem Redux/Zustand)**

### Providers Globais

| Provider | Hook | Função |
|----------|------|--------|
| `ThemeProvider` | `useTheme()` | Light/Dark/System, persiste em localStorage |
| `ProjectProvider` | `useProject()` | Projeto/board atual, boards recentes |
| `ToastProvider` | `useToast()` | Notificações globais (auto-dismiss 4s) |
| `ConfirmProvider` | `useConfirm()` | Dialogs de confirmação |
| `NextIntlClientProvider` | — | i18n via cookie `NEXT_LOCALE` |
| `ClerkProvider` | — | Autenticação |

### Custom Hooks (`lib/hooks/`)

| Hook | Função |
|------|--------|
| `useBoard` | Estado do Kanban (items, filtros, DnD, WIP) |
| `useTimeTracking` | Timer ativo + time entries |
| `useComments` | CRUD de comentários |
| `useSubtasks` | CRUD de subtarefas |
| `useTicketDetail` | Estado do detalhe do ticket |
| `useActivityLog` | Feed de atividades |
| `useWorkloadData` | Métricas de carga |

---

## Design System

### Tokens CSS (variáveis em `globals.css`)

```css
/* Fundos */
--bg-primary, --bg-secondary, --bg-sidebar, --bg-column, --bg-input
/* Textos */
--text-primary, --text-secondary, --text-tertiary
/* Acentos */
--accent, --accent-hover, --accent-soft
--success, --danger, --warning
/* Cards */
--card-bg, --card-border, --card-hover, --modal-bg
```

### Tipografia
- **Sans**: Inter (corpo)
- **Serif**: Newsreader (headings editoriais)
- Eyebrows + page-title classes personalizadas

### Primitivos UI
- Sem lib externa (não shadcn, não Material-UI)
- Radix UI: `dropdown-menu`, `context-menu`, `tooltip`
- Tailwind + CSS variables para temas light/dark

---

## Bibliotecas Principais

| Lib | Versão | Uso |
|-----|--------|-----|
| `@dnd-kit/core` | 5.0.3 | Drag & drop (Kanban) |
| `@dnd-kit/sortable` | 6.0.0 | Reordenação |
| `@tiptap/react` | 3.22.3 | Rich text editor |
| `recharts` | 3.8.1 | Gráficos (bar, pie, area) |
| `framer-motion` | 12.38.0 | Animações |
| `cmdk` | 1.1.1 | Command palette |
| `date-fns` | 4.1.0 | Manipulação de datas |
| `lucide-react` | 0.518.0 | Ícones |
| `react-window` | 1.8.11 | Virtual scroll (listas grandes) |
| `zod` | 4.3.6 | Validação |
| `dompurify` | 3.4.0 | Sanitização HTML |
| `clsx` + `tailwind-merge` | — | Class merging |

---

## Performance

- **Code splitting**: recharts lazy-loaded no dashboard
- **Virtual scrolling**: `VirtualList.tsx` para listas > 100 items
- **PWA**: Service worker em `/public/sw.js`
- **View denormalization**: `tickets_full` elimina N+1 queries

---

## Testes

| Ferramenta | Uso |
|-----------|-----|
| Vitest | Unit + integration tests |
| Playwright | E2E tests |
| Testing Library | DOM assertions |
| @clerk/testing | Mocks de autenticação |

---

## Localização

- Locale via cookie `NEXT_LOCALE` (sem URL prefix)
- Default: `pt-BR`
- Config: `i18n/request.ts`, `i18n/routing.ts`
- Mensagens em JSON por locale

---

## Arquivos de Configuração

| Arquivo | Função |
|---------|--------|
| `next.config.mjs` | Sentry, next-intl plugin |
| `tailwind.config.ts` | Tema dark, CSS variables |
| `tsconfig.json` | Path aliases (`@/components`, `@/lib`) |
| `app/globals.css` | Design tokens + tipografia |
| `app/layout.tsx` | Root layout + providers |
| `middleware.ts` | Auth + security headers |
