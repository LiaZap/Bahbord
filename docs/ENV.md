# Variáveis de ambiente

Todas as variáveis abaixo são lidas de `.env.local` (dev) ou
do ambiente do container (produção). Variáveis `NEXT_PUBLIC_*` são
inlinedadas no bundle do client em **build time** — em Docker passe
como `ARG` no Dockerfile.

Use `.env.example` na raiz como ponto de partida.

## Banco de dados

| Nome | Obrigatória | Descrição | Exemplo |
|------|:-----------:|-----------|---------|
| `DATABASE_URL` | sim | String de conexão Postgres usada por `lib/db.ts`. Pool global em dev, por-instância em prod. | `postgres://user:pass@localhost:5432/bahflow` |

## Auth (Clerk)

| Nome | Obrigatória | Descrição | Exemplo |
|------|:-----------:|-----------|---------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | sim | Chave pública do Clerk (build time). | `pk_test_xxx` |
| `CLERK_SECRET_KEY` | sim | Secret do Clerk (server). | `sk_test_xxx` |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | não (default `/sign-in`) | Rota da página de sign-in. | `/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | não (default `/sign-up`) | Rota da página de sign-up. | `/sign-up` |
| `CLERK_WEBHOOK_SECRET` | recomendada | Valida headers `svix-*` em `/api/webhooks/clerk`. Sem isso, o endpoint aceita qualquer payload (modo dev). | `whsec_xxx` |
| `CLERK_TEST_EMAIL` | só E2E | Usuário de teste pra Playwright (precisa estar **aprovado** no Clerk). | `qa@bahflow.app` |
| `CLERK_TEST_PASSWORD` | só E2E | Senha do usuário de teste. | `secret` |

## AI (OpenAI)

| Nome | Obrigatória | Descrição | Exemplo |
|------|:-----------:|-----------|---------|
| `OPENAI_API_KEY` | sim (se usar IA) | Chave da OpenAI. Sem ela, `/api/ai/*` retorna `500`. | `sk-proj-xxx` |
| `OPENAI_MODEL` | não (default `gpt-4.1-mini`) | Override do modelo usado em `lib/ai.ts` e `/api/ai/chat`. | `gpt-4.1-mini` |

## Storage (Supabase)

Usado para realtime de notificações e (opcionalmente) upload de anexos.

| Nome | Obrigatória | Descrição | Exemplo |
|------|:-----------:|-----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | sim | URL do projeto Supabase (build time). | `https://xxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | sim | Chave anon (client). | `eyJhbGciOi...` |
| `SUPABASE_URL` | não | URL para uso server-side (espelha `NEXT_PUBLIC_SUPABASE_URL`). | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | recomendada | Service role key — usada por `/api/attachments/upload` para subir arquivos com bypass de RLS. | `eyJhbGciOi...` |

## Storage (Google Drive)

Alternativa ao Supabase Storage para anexos.

| Nome | Obrigatória | Descrição | Exemplo |
|------|:-----------:|-----------|---------|
| `GOOGLE_SERVICE_ACCOUNT_JSON` | não | JSON da service account (string serializada). Sem isso, integração Google Drive desativa. | `{"type":"service_account",...}` |
| `GOOGLE_DRIVE_ROOT_FOLDER_ID` | não | ID da pasta raiz onde os uploads serão criados. | `1aBcDef...` |

## Webhooks

| Nome | Obrigatória | Descrição | Exemplo |
|------|:-----------:|-----------|---------|
| `GITHUB_WEBHOOK_SECRET` | recomendada | HMAC-SHA256 secret pra validar `x-hub-signature-256` em `/api/webhooks/github`. Sem isso, aceita qualquer payload. | `random-32-chars` |
| `WEBHOOK_SECRET` | recomendada | Secret pro endpoint genérico `POST /api/webhooks` (header `X-Webhook-Secret`). | `random-32-chars` |

## Notifications

### Resend (e-mail)

| Nome | Obrigatória | Descrição | Exemplo |
|------|:-----------:|-----------|---------|
| `RESEND_API_KEY` | não | Chave da [Resend](https://resend.com). Sem ela, `sendWelcomeEmail()` faz `console.warn` e segue. | `re_xxx` |
| `EMAIL_FROM` | não (default `Bah!Flow <noreply@projetos.bahtech.com.br>`) | Endereço remetente. Precisa estar verificado na Resend. | `Bah!Flow <noreply@meu-dominio.com>` |

### WhatsApp (provider externo)

| Nome | Obrigatória | Descrição | Exemplo |
|------|:-----------:|-----------|---------|
| `WHATSAPP_API_URL` | não | Endpoint do provider (ex: Z-API, Evolution API). | `https://api.z-api.io/instances/.../send-text` |
| `WHATSAPP_API_TOKEN` | não | Token de autenticação enviado pelo provider. | `xxxx` |

## Cron

| Nome | Obrigatória | Descrição | Exemplo |
|------|:-----------:|-----------|---------|
| `CRON_SECRET` | sim em produção | Header `x-cron-secret` (ou `Authorization: Bearer ...`) que `/api/cron/recurring-tickets` exige. Em dev sem secret, o endpoint passa; em prod sem secret, retorna `401`. | `random-64-chars` |
| `CRON_TZ` | não (default `America/Sao_Paulo`) | Timezone usado pelo `cron-parser` para calcular `next_run_at`. | `America/Sao_Paulo` |

## Sentry (opcional)

| Nome | Obrigatória | Descrição | Exemplo |
|------|:-----------:|-----------|---------|
| `NEXT_PUBLIC_SENTRY_DSN` | não | DSN público (client + edge + server). | `https://xxx@sentry.io/yyy` |
| `SENTRY_DSN` | não | Fallback server-side se `NEXT_PUBLIC_SENTRY_DSN` ausente. | `https://xxx@sentry.io/yyy` |

## MongoDB (audit-trail — opcional)

Histórico granular de mudanças em tickets/projects.

| Nome | Obrigatória | Descrição | Exemplo |
|------|:-----------:|-----------|---------|
| `MONGODB_URI` | não (default `mongodb://localhost:27017`) | String de conexão. | `mongodb+srv://user:pass@cluster.mongodb.net/` |
| `MONGODB_DB` | não (default `bahjira`) | Nome do database. | `bahflow_audit` |

## Aplicação

| Nome | Obrigatória | Descrição | Exemplo |
|------|:-----------:|-----------|---------|
| `NEXT_PUBLIC_APP_URL` | não (default `https://projetos.bahtech.com.br`) | URL canônica usada em links de webhooks (Slack/Discord) e e-mails. | `https://app.meu-dominio.com` |
| `NODE_ENV` | automática | `development` em dev, `production` em build/start. Afeta logging e o pool global. | `production` |

## E2E (apenas dev)

| Nome | Obrigatória | Descrição | Exemplo |
|------|:-----------:|-----------|---------|
| `E2E_BOARD_ID` | só E2E | UUID de um board real para os testes Playwright. | `abc-...-uuid` |
| `E2E_TICKET_ID` | opcional | UUID de um ticket pra testes que precisam de um existente. | `abc-...-uuid` |
