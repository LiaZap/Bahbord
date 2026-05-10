# Cron — agendamento de tarefas recorrentes

O Bah!Flow não tem scheduler interno. Tarefas recorrentes são endpoints
HTTP em `/api/cron/*` disparados externamente pelo workflow
[`.github/workflows/cron.yml`](../.github/workflows/cron.yml). Cada
endpoint é idempotente — pode ser chamado múltiplas vezes sem efeitos
colaterais (lock por linha, marcação de "já processado", etc.).

## Endpoints existentes

| Endpoint | Frequência | O que faz |
|---|---|---|
| `POST /api/cron/sla-check` | a cada 30 min | Varre tickets abertos com `sla_due_at` se aproximando, dispara Slack do workspace + notificação in-app pro assignee, marca `sla_alert_sent_at`. |
| `POST /api/cron/sprint-rollover` | diário 09:00 UTC (06:00 BRT) | Encerra sprints vencidos, move tickets não-finalizados pro próximo sprint ativo. |
| `POST /api/cron/project-updates` | sexta 20:00 UTC (17:00 BRT) | Gera resumo semanal por projeto e posta no canal configurado. |
| `POST /api/cron/recurring-tickets` | a cada 15 min | Cria tickets a partir de templates recorrentes cujo `next_run_at <= NOW()`, recalcula `next_run_at` via `cron-parser`. |

## Autenticação

Todos os endpoints aceitam:

```
Authorization: Bearer <CRON_SECRET>
```

(Alguns também aceitam `x-cron-secret: <CRON_SECRET>` por compat.)

Em produção `CRON_SECRET` é **obrigatório** — sem ele, os endpoints retornam
`401`. Em dev, sem secret, eles passam (loud-fail é só prod).

## Secrets necessários no repo

Configure em `Settings → Secrets and variables → Actions`:

| Secret | Obrigatório | Descrição |
|---|---|---|
| `APP_URL` | sim | URL pública do app (ex: `https://projetos.bahtech.com.br`). Sem path. |
| `CRON_SECRET` | sim | Mesmo valor que está no env do app. |

Se algum estiver vazio, o workflow falha com erro explícito antes de bater
no app.

## Como testar manualmente

Pelo GitHub UI:

1. `Actions → Cron jobs → Run workflow`
2. Escolha o endpoint no dropdown (`sla-check`, `sprint-rollover`, etc.)
3. `Run workflow`

Por linha de comando (gh CLI):

```bash
gh workflow run cron.yml -f endpoint=sla-check
```

Localmente (com app rodando em `localhost:3000`):

```bash
curl -X POST http://localhost:3000/api/cron/sla-check \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json"
```

## Como adicionar um novo cron

1. Crie o endpoint em `app/api/cron/<nome>/route.ts`. Padrão:
   - `POST` apenas
   - Reuse o helper `isAuthorized(request)` (copie de
     `app/api/cron/recurring-tickets/route.ts`)
   - **Idempotente**: marque o que já foi processado, não dependa de "rodou
     uma vez" pra ficar correto
   - Resposta: `{ ok: true, processed: <n>, errors: <n> }` (não 5xx em
     erro parcial — log e siga)
2. Adicione um schedule no `on.schedule:` do `.github/workflows/cron.yml`
   (lembrando: cron do GitHub é UTC).
3. Adicione o `case` correspondente no step `Pick endpoint`.
4. Adicione o nome do endpoint no `inputs.endpoint.options` pra permitir
   trigger manual.
5. Documente nesta tabela aqui em cima.

## Como debugar falhas

1. **Workflow falhou com erro de secret**: confira `APP_URL` e
   `CRON_SECRET` em `Settings → Secrets`. O step `Fire ...` faz validação
   antes do curl.
2. **Workflow rodou mas endpoint retornou erro**: `curl -fsS` faz fail-fast
   em status >= 400. Veja o stderr do step pra status code, e cheque os
   logs do app (Sentry / `console.error`) pra stack trace.
3. **Schedule não está disparando**: GitHub Actions não garante execução
   no minuto exato — pode atrasar 5-15 min em horários de pico. Se passar
   muito disso, veja se o repo está marcado como inativo (sem push há
   60+ dias desabilita os schedules — é só dar push pra reativar).
4. **Trabalho duplicado**: o `concurrency.group` é por schedule, então
   duas execuções do mesmo cron não rodam em paralelo. Mas dois schedules
   diferentes podem rodar juntos — endpoints precisam ser thread-safe.
5. **Falha intermitente**: o `curl --retry 2 --retry-delay 5` cobre
   timeouts curtos. Pra falhas persistentes, ative alerta de workflow
   failure (`Settings → Notifications`) ou use o `Notify on failure` step
   (igual ao `backup.yml`).

## Monitoring

Os 4 cron handlers são instrumentados com `Sentry.withMonitor` (Fase 7.3).
Cada execução manda check-in pro Sentry Crons:

- `in_progress` quando começa
- `ok` quando termina sem exception
- `error` quando lança
- `missed` quando o schedule passou e não houve check-in (calculado pelo
  Sentry com base no `schedule` declarado no handler)
- `timeout` quando excede `maxRuntime`

| Endpoint | Monitor slug | maxRuntime | checkinMargin |
|---|---|---|---|
| `/api/cron/sla-check`          | `cron-sla-check`          | 10 min | 5 min  |
| `/api/cron/recurring-tickets`  | `cron-recurring-tickets`  | 10 min | 5 min  |
| `/api/cron/sprint-rollover`    | `cron-sprint-rollover`    | 10 min | 10 min |
| `/api/cron/project-updates`    | `cron-project-updates`    | 15 min | 10 min |

### Dashboard Sentry Crons

Acesse: `https://<seu-org>.sentry.io/crons/` (substituir `<seu-org>` pela
slug da org Sentry — preencher após primeiro deploy com DSN ativo).

### Alertas configurados (configurar no Sentry UI)

Para cada monitor, configurar em `Settings → Crons → <slug> → Alerts`:

- **Missed**: 1 missed check-in → notificar Slack `#incidents`
- **Late**: check-in atrasou > `checkinMargin` → notificar `#incidents`
- **Failed**: 1 erro → notificar `#incidents`
- **Recovered**: 1 OK consecutivo → resolver issue automaticamente

> **Quando não há DSN configurado** (`NEXT_PUBLIC_SENTRY_DSN` /
> `SENTRY_DSN` vazios), `Sentry.withMonitor` degrada pra no-op gracioso —
> roda o callback direto sem instrumentação. Não quebra dev nem ambientes
> sem Sentry.

### Verificar última execução real (sem Sentry)

```bash
# Lista as últimas runs do workflow (qualquer endpoint)
gh run list -w cron.yml --limit 10

# Detalhe de uma run específica
gh run view <RUN_ID>

# Logs de falha
gh run view <RUN_ID> --log-failed
```

## Limites importantes

- **Timeout do workflow**: 15 min (`timeout-minutes`). Endpoints longos
  devem fazer batches (`BATCH_LIMIT`) e contar com a próxima execução.
- **Timeout do curl**: 600s (`--max-time 600`). Se um endpoint demora mais
  que isso, ele precisa virar um job assíncrono (BullMQ, Inngest, etc.).
- **Não cancela em progresso**: `cancel-in-progress: false` — preferimos
  serializar a perder trabalho parcial.
