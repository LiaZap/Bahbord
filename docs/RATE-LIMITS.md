# Rate Limits — Endpoints Públicos

> **TODO (follow-up):** Quando uso multi-instance virar significativo, migrar
> pra **Upstash Redis** (`@upstash/redis`) — chave + TTL nativos, sem
> coordenação cross-lambda. O rate limiter atual é in-memory (Map por
> processo Node), portanto **não compartilha estado entre instâncias**: cada
> réplica conta o próprio bucket. Em single-instance (Render free, Docker
> standalone) está perfeito; em horizontal scaling, o limite efetivo
> multiplica pelo nº de réplicas.

Implementação: [`lib/rate-limit.ts`](../lib/rate-limit.ts) — função
`checkRateLimit(key, limit, windowMs)` retorna `{ ok, retryAfter? }`.

## Tabela de limites

| Endpoint | Método | Limit | Janela | Key strategy | Justificativa |
|---|---|---|---|---|---|
| `/api/webhooks/inbox/slack` | POST | **60** | 60s | `webhook-slack:${ip}` | Webhooks Slack legítimos podem ter bursts (retries Slack, múltiplos channels). 60/min absorve uso normal sem permitir flood. |
| `/api/webhooks/inbox/share-link` | POST | **30** | 60s | `webhook-share-link:${ip}` | Form público compartilhável (cliente sem login). Cada submissão é manual — 30/min cobre copy/paste rápido + tabs múltiplas. |
| `/api/webhooks/customer-form` | POST | **30** | 60s | `webhook-customer-form:${ip}` | Webhook embedável em sites externos. Mesma justificativa do share-link. |
| `/api/customer-requests` (modo público) | POST | **10** | 60s | `customer-requests-public:${ip}` | Apenas quando header `X-Public-Form-Secret` válido. 10/min apertado de propósito: pedido manual genuíno não vem em rajadas. Membros autenticados **não** passam por esse limite. |
| `/api/locale` | POST | **60** | 60s | `locale:${ip}` | Endpoint trivial mas público (sem auth). Generoso pra cobrir clicks acidentais; bloqueia loop malicioso. |
| `/api/health` | GET | **120** | 60s | `health:${ip}` | Monitoring tools agressivos polam ~60/min. Damos 2x de margem sem virar vetor de DB-DoS (cada hit roda `SELECT 1`). |
| **Server Action** `submitFeedback` | — | **5** | 60s | `feedback-action:${ip}` | Page `/feedback` pública. Feedback genuíno não vem em rajadas — limite apertado bloqueia spam de bot sem incomodar usuário real. |

## Endpoints **não** cobertos (e por quê)

- **`/api/tickets/similar`** — já tem rate limit próprio (in-memory por
  usuário, mín 400ms entre chamadas). Não foi alterado.
- **`/api/ai/*`** — já tinham `checkRateLimit` aplicado por usuário
  autenticado (30/min). Mantidos.
- **Demais endpoints autenticados** — gate Clerk + `getAuthMember()` já
  protegem contra abuso anônimo. Rate limit por usuário pode ser adicionado
  caso surjam endpoints custosos abusáveis.

## Key strategy: por que IP?

Endpoints públicos não têm `auth.id` disponível. Alternativas consideradas:

- **Hash do secret** (`webhook-secret-hash`): atacante com o secret roda na
  mesma chave de uso legítimo → limit dispara contra ambos. Rejeitado.
- **Combinação `ip + userAgent`**: contorna trivialmente trocando UA.
- **`ip + rota`**: nossa escolha, encapsulado no prefixo da key
  (`webhook-slack:`, `feedback-action:`, etc) — bucket separado por endpoint
  evita um endpoint "queimar" o orçamento de outro.

IP é extraído via `extractRequestMeta()` (lib/audit.ts) que já normaliza
`x-forwarded-for` → `x-real-ip` → `cf-connecting-ip`. Quando ausente, usa
literal `'unknown'` (todos os clients sem IP compartilham bucket — isso é
consciente, é o pior caso e também o mais defensivo).

## Comportamento do 429

Todos os endpoints retornam:

```json
{ "error": "Rate limit excedido", "retryAfter": <segundos> }
```

com header `Retry-After: <segundos>` (RFC 7231). A Server Action
`submitFeedback` retorna `{ ok: false, error: "Muitas tentativas. Aguarde Xs..." }`
em vez de Response (não é um endpoint HTTP convencional).

## Testes

`tests/lib/rate-limit.test.ts` cobre `checkRateLimit` em isolamento (limite,
janela, retryAfter). Não há teste de integração por endpoint — seria útil
adicionar em uma Sprint futura via `supertest` ou Playwright.
