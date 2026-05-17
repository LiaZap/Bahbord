# RBAC — Controle de Acesso Baseado em Papéis

## Hierarquia de Papéis

### Nível Organização (`org_roles`)

| Role | Permissões |
|------|-----------|
| **owner** | Controle total do workspace (settings, membros, billing) |
| **admin** | Gerencia settings, membros, permissões; bypass de aprovação |
| **member** | Acesso de trabalho — cria/edita tickets, comenta |
| **viewer** | Somente leitura nos recursos atribuídos |

### Nível Projeto (`project_roles`)

| Role | Permissões |
|------|-----------|
| **admin** | Admin do projeto específico |
| **member** | Membro padrão do projeto |
| **viewer** | Leitura no projeto |

### Nível Board (`board_roles`)

| Role | Permissões |
|------|-----------|
| **admin** | Admin do board específico |
| **member** | Membro do board |
| **viewer** | Leitura no board |

### Nível Time (`team_members`)

| Role | Permissões |
|------|-----------|
| **lead** | Líder do time |
| **member** | Membro do time |

---

## Herança de Acesso

```
Workspace (org_roles)
├── Project (project_roles)
│   └── Board (board_roles)
│       └── Tickets (herda acesso do board/project)
```

- **Admin org** → acesso total a todos os projetos/boards/tickets
- **project_roles** → acessa todos os boards do projeto
- **board_roles** → acessa apenas o board específico
- Tickets acessíveis se o usuário tem role no **project** OU em qualquer **board** do projeto

---

## Enforcement (Camadas)

### 1. Middleware (`middleware.ts`)
- Clerk valida JWT
- Rotas públicas: `/sign-in`, `/sign-up`, `/api/webhooks`, `/share/*`, `/feedback`
- Todas as demais exigem autenticação
- Headers de segurança: X-Frame-Options, X-Content-Type-Options, X-XSS-Protection

### 2. Page Guards (`lib/page-guards.ts`)

| Guard | Comportamento |
|-------|--------------|
| `requireAuth()` | Redireciona → `/sign-in` se não autenticado |
| `requireApproved()` | Redireciona → `/pending-approval` se pendente (admins bypass) |
| `requireAdmin()` | Redireciona → `/my-tasks` se não owner/admin |

### 3. API Guards (`lib/api-auth.ts`)

```typescript
const auth = await getAuthMember();
if (!auth) return 401; // Não autenticado
if (!isAdmin(auth.role)) return 403; // Acesso negado
```

### 4. Access Checks (`lib/access-check.ts`)

| Função | Lógica |
|--------|--------|
| `hasBoardAccess(auth, boardId)` | Admin org → OK; Outros → precisa board_roles OU project_roles no parent |
| `hasProjectAccess(auth, projectId)` | Admin org → OK; Outros → precisa project_roles OU board_roles em qualquer board |
| `hasTicketAccess(auth, ticketId)` | Admin org → OK; Outros → verifica acesso ao board/project do ticket |

---

## Catálogo de Permissões

### Tabelas

- `permissions` — definições (key, display_name, group_id, scope)
- `permission_groups` — categorização
- `role_permissions` — mapeamento role→permission

### Scopes

| Scope | Uso |
|-------|-----|
| `users` | Operações via UI |
| `api_keys` | Operações M2M/API |
| `both` | Ambos os contextos |

### Permissões Padrão (role admin)

- `admin:all` — Superadmin
- `read:customers`, `write:customers`
- `read:tickets`, `write:tickets`, `delete:tickets`
- `read:dashboard`, `read:settings`, `write:settings`
- `read:timesheet`, `write:timesheet`
- `manage:webhooks`, `manage:integrations`, `manage:api_keys`

---

## Fluxo de Aprovação

1. Usuário faz login via Clerk → membro criado com `is_approved = false`
2. `approval_request` criado automaticamente (type: `org_access`)
3. Admin aprova no painel → `is_approved = true`
4. Atribuição a projeto/board aprova automaticamente
5. Membro sem aprovação vê tela de "Aguardando aprovação"

### Tipos de Aprovação

| Tipo | Descrição |
|------|-----------|
| `org_access` | Acesso ao workspace |
| `project_access` | Acesso a projeto específico |
| `board_access` | Acesso a board específico |
| `project_creation` | Criar novo projeto |

---

## Arquivos-Chave

| Arquivo | Função |
|---------|--------|
| `lib/api-auth.ts` | Auth + auto-criação de membro |
| `lib/page-guards.ts` | Guards de página server-side |
| `lib/access-check.ts` | Checks de acesso board/project/ticket |
| `lib/rbac.ts` | Hierarquia de roles + `canAccess()` |
| `middleware.ts` | Clerk middleware + security headers |
| `app/api/roles/route.ts` | API universal de roles (org/project/board) |
| `app/api/permissions/route.ts` | CRUD de permissões |
| `app/api/role-permissions/route.ts` | Atribuição role→permission |
| `components/settings/PermissionsSettings.tsx` | UI de gerenciamento |
| `db/012_multi_tenant_rbac.sql` | Migration RBAC |
| `db/016_permissions.sql` | Migration catálogo de permissões |

---

## Notas de Design

- **Segurança application-level** — sem RLS no PostgreSQL; checks em TypeScript
- **Dual-role storage** — `org_roles` table + legacy `members.role` (compatibilidade)
- **Multi-tenant** — workspace_id isola dados entre organizações
- **Audit** — mudanças de role logadas via `logAudit()` com IP e user-agent
- **Rate limiting** — bucket in-memory (60 req/60s por instância)
