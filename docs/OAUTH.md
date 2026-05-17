# OAuth & Autenticação

## Visão Geral

- **Provider**: Clerk (`@clerk/nextjs` ^7.2.0)
- **Mecanismo**: JWT via session cookie (HttpOnly)
- **Mapeamento**: Clerk user → tabela `members` (via `clerk_user_id`)
- **Aprovação**: Novos usuários ficam pendentes até admin aprovar

---

## Fluxo Completo

### Sign-Up & Primeiro Login

```
Usuário clica "Criar conta"
  ↓
Clerk SignUp (email/senha ou OAuth social)
  ↓
JWT gerado, session cookie setado
  ↓
Redirect para app (/my-tasks)
  ↓
middleware.ts: Clerk valida session
  ↓
getAuthMember() chamado
  ↓
Membro não encontrado no DB → auto-criação com is_approved=false
  ↓
approval_request criado para admin
  ↓
Usuário vê ApprovalGate: "Aguardando aprovação"
  ↓
Admin aprova no painel
  ↓
is_approved = true
  ↓
Refresh → conteúdo do app visível
```

### Login Subsequente

```
Usuário acessa app
  ↓
Clerk session cookie presente
  ↓
middleware.ts valida JWT
  ↓
getAuthMember() busca membro por clerk_user_id
  ↓
Retorna AuthMember (role, workspace, etc)
  ↓
Conteúdo renderizado baseado no role
```

### Webhook Sync (assíncrono)

```
Clerk user created/updated/deleted
  ↓
POST /api/webhooks/clerk
  ↓
Svix HMAC verification
  ↓
Update/create member no banco
  ↓
Próximo request vê estado consistente
```

---

## Configuração Clerk

### Provider (`app/layout.tsx`)

```tsx
<ClerkProvider
  appearance={{
    variables: {
      colorPrimary: '#3b82f6',
      colorBackground: '#1a1c1e',
      colorInputBackground: '#232730',
      colorInputText: '#e2e8f0',
    },
  }}
>
```

### Variáveis de Ambiente

```bash
CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
CLERK_WEBHOOK_SECRET=whsec_...
```

---

## Middleware (`middleware.ts`)

### Rotas Públicas (sem auth)

| Pattern | Descrição |
|---------|-----------|
| `/sign-in(.*)` | Página de login |
| `/sign-up(.*)` | Página de cadastro |
| `/api/webhooks(.*)` | Webhooks (verificados por signature) |
| `/share/(.*)` | Links públicos |
| `/feedback(.*)` | Formulário de feedback |

### Proteção

```typescript
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isPublicRoute = createRouteMatcher([...]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect(); // Redireciona para /sign-in
  }
});
```

### Security Headers

| Header | Valor |
|--------|-------|
| X-Frame-Options | DENY |
| X-Content-Type-Options | nosniff |
| X-XSS-Protection | 1; mode=block |
| Referrer-Policy | strict-origin-when-cross-origin |

---

## Auth Member Lookup (`lib/api-auth.ts`)

### `getAuthMember()`

```typescript
export async function getAuthMember(): Promise<AuthMember | null>
```

**Interface retornada:**

```typescript
interface AuthMember {
  id: string;           // UUID do membro interno
  clerk_id: string;     // Clerk user ID
  workspace_id: string; // UUID do workspace
  role: string;         // Role de org_roles (owner|admin|member|viewer)
  display_name: string;
  email: string;
  is_approved: boolean;
  can_track_time?: boolean;
}
```

**Fluxo interno:**

1. `const { userId } = await auth()` (Clerk server)
2. Query: `SELECT * FROM members WHERE clerk_user_id = $1`
3. Se não encontrou → busca por email (pré-criação manual)
4. Se não encontrou → auto-cria membro:
   - Fetch Clerk profile (`currentUser()`)
   - INSERT member com `is_approved = false`
   - INSERT approval_request
5. Resolve role via `org_roles` (COALESCE para 'viewer')
6. Async: atualiza `avatar_url` do Clerk (non-blocking)

### `isAdmin(role)`

```typescript
export function isAdmin(role: string): boolean {
  return role === 'owner' || role === 'admin';
}
```

### `getApprovedMember()`

- Retorna membro apenas se `is_approved = true`
- Admins/owners bypass (sempre retorna)

---

## Page Guards (`lib/page-guards.ts`)

| Guard | Redirecionamento | Uso |
|-------|-----------------|-----|
| `requireAuth()` | → `/sign-in` | Qualquer rota protegida |
| `requireApproved()` | → `/pending-approval` | Rotas de trabalho |
| `requireAdmin()` | → `/my-tasks` | Settings, dashboard global |

---

## Mapeamento Clerk → Members

### Tabela `members`

```sql
CREATE TABLE members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  user_id UUID NOT NULL,
  clerk_user_id TEXT,             -- ← Link com Clerk
  display_name TEXT NOT NULL,
  email TEXT NOT NULL,
  avatar_url TEXT,                -- Atualizado do Clerk em cada login
  is_approved BOOLEAN DEFAULT false,
  can_track_time BOOLEAN DEFAULT false,
  UNIQUE(workspace_id, user_id)
);

CREATE UNIQUE INDEX idx_members_clerk_user_id
  ON members(clerk_user_id) WHERE clerk_user_id IS NOT NULL;
```

### Webhook de Sync (`/api/webhooks/clerk`)

**Verificação:**
```typescript
import { Webhook } from 'svix';
const wh = new Webhook(CLERK_WEBHOOK_SECRET);
body = wh.verify(rawBody, { 'svix-id', 'svix-timestamp', 'svix-signature' });
```

**Eventos:**

| Evento | Ação |
|--------|------|
| `user.created` | Cria member + approval_request |
| `user.updated` | Atualiza display_name, email, avatar |
| `user.deleted` | Deleta member (cascade roles, approvals) |

**Fallback Logic:**
1. Busca por `clerk_user_id` → encontrou → update
2. Busca por email → encontrou → link (seta clerk_user_id)
3. Não encontrou → cria novo membro

---

## Páginas de Auth

### Sign-In (`app/sign-in/[[...sign-in]]/page.tsx`)

```tsx
import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0f0f0f]">
      <SignIn />
    </div>
  );
}
```

### Sign-Up (`app/sign-up/[[...sign-up]]/page.tsx`)

```tsx
import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0f0f0f]">
      <SignUp />
    </div>
  );
}
```

---

## ApprovalGate (Client-Side)

```tsx
// components/ui/ApprovalGate.tsx
// Wraps protected content
// Fetches /api/auth/me → checks is_approved
// Shows "Awaiting approval" + sign-out button if pending
```

---

## API Auth Pattern

Todos os endpoints API seguem:

```typescript
export async function GET(request: Request) {
  const auth = await getAuthMember();
  if (!auth) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  // Check role if needed
  if (!isAdmin(auth.role)) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
  }

  // Proceed...
}
```

---

## Cron Auth

Workers/crons usam header secreto:

```typescript
// Verificação no endpoint
const cronSecret = request.headers.get('x-cron-secret');
if (cronSecret !== process.env.CRON_SECRET) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

---

## Arquivos-Chave

| Arquivo | Função |
|---------|--------|
| `middleware.ts` | Clerk middleware + security headers |
| `lib/api-auth.ts` | `getAuthMember()`, auto-criação, role lookup |
| `lib/page-guards.ts` | Guards server-side (requireAuth/Approved/Admin) |
| `app/layout.tsx` | ClerkProvider wrapper |
| `app/sign-in/[[...sign-in]]/page.tsx` | Página de login |
| `app/sign-up/[[...sign-up]]/page.tsx` | Página de cadastro |
| `app/api/webhooks/clerk/route.ts` | Webhook sync Clerk→Members |
| `app/api/auth/me/route.ts` | Endpoint current user |
| `app/pending-approval/page.tsx` | Tela de aprovação pendente |
| `components/ui/ApprovalGate.tsx` | Gate client-side |
| `db/021_clerk_auth.sql` | Migration: clerk_user_id column |

---

## Segurança

| Aspecto | Implementação |
|---------|--------------|
| JWT validation | Clerk (automático via middleware) |
| Session | HttpOnly cookie (Clerk default) |
| Webhook auth | HMAC-SHA256 via Svix |
| Cron auth | Bearer token / x-cron-secret |
| API auth | getAuthMember() em todo endpoint |
| CSRF | Clerk handles (SameSite cookie) |
| XSS | Security headers + DOMPurify |
| Clickjacking | X-Frame-Options: DENY |
