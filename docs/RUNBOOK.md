# Runbook — manual de incidentes

Manual operacional pra incidentes em produção do Bah!Flow. Cada cenário
abaixo segue o mesmo formato:

- **Sintomas** — o que o usuário ou monitoramento vê.
- **Diagnóstico** — comandos / queries pra confirmar a hipótese.
- **Mitigação** — passos pra restaurar o serviço (rollback, workaround).
- **Comunicação** — quem avisar enquanto o incidente está aberto.
- **Pós-incidente** — o que registrar depois que o fogo apagou.

> Severidade default: tudo que afeta usuário externo é **SEV-1** (acordar
> on-call). Degradação parcial (cron parando, IA fora) é **SEV-2** (notificar
> em horário comercial). Use bom senso — quando em dúvida, escale.

Convenções:

- `APP_URL` = `https://projetos.bahtech.com.br`
- Slack `#incidents` é o canal default. Se ainda não existe, use o canal
  configurado em `webhook_subscriptions` do workspace `bahtech`.
- Comandos `psql` rodam contra o `DATABASE_URL` de produção — exporte o
  env primeiro, NUNCA cole credencial inline.

---

## Índice

1. [App caído (502/503 no EasyPanel)](#1-app-caído-502503-no-easypanel)
2. [Banco de dados indisponível](#2-banco-de-dados-indisponível)
3. [OpenAI fora do ar](#3-openai-fora-do-ar)
4. [Clerk fora do ar (todos requests 401)](#4-clerk-fora-do-ar-todos-requests-401)
5. [Supabase Realtime parado (notificações atrasam)](#5-supabase-realtime-parado-notificações-atrasam)
6. [Cron parou de rodar](#6-cron-parou-de-rodar)
7. [Backup falhou](#7-backup-falhou)
8. [Latência alta em listings](#8-latência-alta-em-listings)
9. [Spam no triage_inbox via webhook](#9-spam-no-triage_inbox-via-webhook)
10. [Vazamento de secret no Git](#10-vazamento-de-secret-no-git)

---

## 1. App caído (502/503 no EasyPanel)

### Sintomas
- `GET https://projetos.bahtech.com.br` retorna 502/503.
- Healthcheck do EasyPanel marca o serviço `unhealthy`.
- Sentry recebe burst de erros `ECONNREFUSED` ou `Service Unavailable`.

### Diagnóstico
```bash
# 1) Healthcheck público (rápido — só SELECT 1 no DB)
curl -i https://projetos.bahtech.com.br/api/health

# 2) Status do container no EasyPanel UI
#    Projects → Bahjira → bahjira-app → Logs / Metrics

# 3) Logs do container (últimos 200 linhas)
#    EasyPanel UI → Logs ou via SSH:
ssh deploy@<easypanel-host> "docker logs --tail=200 bahjira-app"

# 4) Uso de recursos (OOM kills aparecem como exit code 137)
ssh deploy@<easypanel-host> "docker inspect bahjira-app --format '{{.State.OOMKilled}} {{.State.ExitCode}}'"
```

### Mitigação
1. **Restart simples** — EasyPanel UI → Restart. 90% dos casos resolve.
2. **Se OOM** (ExitCode 137): aumentar limite de memória no EasyPanel ou
   reverter o último deploy (último build de container costuma ser a causa).
3. **Se não sobe**: rollback pra release anterior:
   ```bash
   # No EasyPanel UI → Deployments → escolher build anterior → Promote
   # OU via git, se deploy é por tag:
   git revert HEAD && git push origin main
   ```
4. **Se rollback não resolve**: ativar manutenção (página estática) no
   reverse proxy enquanto investiga.

### Comunicação
- Slack `#incidents`: "App fora do ar — investigando. ETA: 10 min".
- Atualizar a cada 15 min mesmo sem novidade.
- Se durar > 30 min, e-mail pro owner do workspace `bahtech` com causa
  preliminar.

### Pós-incidente
- Abrir ticket no projeto `Operações` com tag `incident`.
- Registrar timeline em `audit_log` (manual, via script de import) ou em
  comentário do ticket.
- Se OOM recorrente: abrir ticket pra revisar limite de memória / leak.

---

## 2. Banco de dados indisponível

### Sintomas
- `/api/health` retorna 503 com `db.ok = false`.
- Erros tipo `Connection terminated unexpectedly` ou
  `password authentication failed` no Sentry.
- App sobe mas qualquer request retorna 500.

### Diagnóstico
```bash
# 1) Confirma que o DB realmente caiu (não é só o app)
psql "$DATABASE_URL" -c "SELECT 1"

# 2) Status do Postgres no EasyPanel
#    Projects → Bahjira → postgres → Status / Logs

# 3) Conexões abertas (limite costuma ser 100)
psql "$DATABASE_URL" -c \
  "SELECT count(*), state FROM pg_stat_activity GROUP BY state"

# 4) Long-running queries (candidato a kill)
psql "$DATABASE_URL" -c \
  "SELECT pid, age(clock_timestamp(), query_start), query
   FROM pg_stat_activity
   WHERE state = 'active' AND query NOT ILIKE '%pg_stat_activity%'
   ORDER BY 2 DESC LIMIT 20"
```

### Mitigação
1. **Conexões esgotadas**: matar queries longas:
   ```sql
   SELECT pg_terminate_backend(<pid>);
   ```
2. **Postgres caiu**: restart no EasyPanel (Projects → postgres → Restart).
   Tempo típico de recovery: 30-90s.
3. **Disco cheio**: limpar WAL antigo (`vacuum`/`pg_archivecleanup`) — ver
   [docs/MIGRATIONS.md](MIGRATIONS.md) pra comandos seguros.
4. **Fallback read-only**: NÃO suportado hoje. Quando o DB está fora, o app
   está fora. Roadmap: apontar pra réplica via `DATABASE_URL_RO`.

### Comunicação
- Slack `#incidents` imediatamente — DB down = SEV-1.
- Se restore demorar > 5 min, status page (placeholder) deve avisar.
- Avisar o time de produto que escritas estão suspensas (perda de dados
  desde último backup é possível).

### Pós-incidente
- Verificar último backup íntegro (`scripts/backup-db.sh` rodou hoje?).
- Se houve perda de dados, abrir ticket SEV-1 e seguir
  [docs/RECOVERY.md](RECOVERY.md).
- Postmortem em `docs/incidents/<data>-db-down.md` (criar pasta se não
  existe — pedir confirmação antes).

---

## 3. OpenAI fora do ar

### Sintomas
- Endpoints `/api/ai/*` retornam 500 ou timeout (~10s).
- Triage automático no `triage_inbox` para de classificar — itens ficam
  `status='pending'`.
- Busca de tickets similares (`/api/tickets/similar`) retorna lista vazia
  ou erro.
- Backfill de embeddings (`scripts/backfill-embeddings.ts`) trava.

### Diagnóstico
```bash
# 1) Confere status oficial: https://status.openai.com/
curl -s https://status.openai.com/api/v2/status.json | jq .status.indicator

# 2) Smoke test direto contra a API
curl -s https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY" | jq .data[0].id

# 3) Quantos itens estão pendentes no inbox por causa disso
psql "$DATABASE_URL" -c \
  "SELECT count(*) FROM triage_inbox
   WHERE created_at > NOW() - interval '1 hour'
     AND triage_status = 'pending'"
```

### Mitigação
- **Bom**: o código já degrada graciosamente.
  - `lib/embeddings.ts` checa `isEmbeddingAvailable()` e tem retry (2
    tentativas) — quando falha de vez, lança e quem chamou ignora.
  - `lib/ai-triage.ts` envolve a chamada em try/catch — itens ficam
    `pending` até a IA voltar.
- **Não há ação imediata necessária**: quando a OpenAI volta, o próximo
  cron processa os pendentes.
- **Se a indisponibilidade > 4h**: rodar manualmente:
  ```bash
  # Forçar reprocessamento de tudo que ficou pendente
  curl -fsS -X POST "$APP_URL/api/cron/recurring-tickets" \
    -H "Authorization: Bearer $CRON_SECRET"
  # E backfill de embeddings nos tickets sem vetor:
  npx ts-node scripts/backfill-embeddings.ts
  ```

### Comunicação
- Slack `#incidents`: "OpenAI degradado — triage IA pausado. Tickets
  continuam sendo criados manualmente normalmente. Sem ação do usuário".
- Avisar produto se houver SLA de IA prometido a cliente (não há hoje).

### Pós-incidente
- Conferir contadores no Sentry pra dimensionar impacto.
- Se a janela foi longa, registrar no audit_log um summary do batch
  reprocessado.

---

## 4. Clerk fora do ar (todos requests 401)

### Sintomas
- 100% dos requests autenticados retornam 401 Unauthorized.
- Tela de login não carrega (Clerk hosted UI).
- Sentry mostra burst de `ClerkAPIError` ou `Failed to verify session`.

### Diagnóstico
```bash
# 1) Status oficial: https://status.clerk.com/
curl -s https://status.clerk.com/api/v2/status.json | jq .status.indicator

# 2) Smoke test do JWKS (verificação de assinatura usa isso)
curl -s -o /dev/null -w "%{http_code}" \
  "https://${CLERK_FRONTEND_API}/.well-known/jwks.json"

# 3) Se for problema de chave (não outage), checar env
#    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY e CLERK_SECRET_KEY estão setados
#    e correspondem ao mesmo app no Dashboard?
```

### Mitigação
- **Outage do Clerk**: nada a fazer no app. Esperar.
- **Chaves rotacionadas/inválidas**: atualizar env no EasyPanel e restart:
  1. Clerk Dashboard → API Keys → copiar publishable + secret atuais.
  2. EasyPanel → Bahjira → Environment → atualizar `CLERK_SECRET_KEY` e
     `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`.
  3. Restart do container.
- **Bypass de emergência**: NÃO tem. Auth é mandatório em prod.

### Comunicação
- Slack `#incidents` SEV-1 — sem auth não tem app.
- Status page (placeholder) deve indicar "problema com provedor de
  identidade".

### Pós-incidente
- Postmortem com timeline.
- Se foi rotação acidental de chave, documentar processo correto em
  [docs/ENV.md](ENV.md).

---

## 5. Supabase Realtime parado (notificações atrasam)

### Sintomas
- Notificações in-app não aparecem em tempo real (chegam só ao recarregar).
- Sininho de notificações fica desatualizado.
- Console do browser: `WebSocket connection to 'wss://...supabase.co' failed`.

### Diagnóstico
```bash
# 1) Status do Supabase: https://status.supabase.com/
curl -s https://status.supabase.com/api/v2/status.json | jq .status.indicator

# 2) Check do Realtime API
curl -s -o /dev/null -w "%{http_code}" \
  "${NEXT_PUBLIC_SUPABASE_URL}/realtime/v1/api/tenants"
```

### Mitigação
- **Bom**: existe fallback de polling — o componente de notificações faz
  refetch a cada N segundos quando o canal Realtime cai. UX degrada mas
  não quebra.
- **Sem ação imediata**: quando Realtime volta, o WebSocket reconecta
  sozinho.
- **Se demora > 1h**: avisar usuários via banner pra recarregar.

### Comunicação
- Slack `#incidents` SEV-2 (degradação, não outage).
- Sem necessidade de e-mail externo — usuário ainda consegue trabalhar.

### Pós-incidente
- Conferir métricas Supabase (uso de canais) — talvez tenhamos atingido
  limite do plano.

---

## 6. Cron parou de rodar

### Sintomas
- Tickets recorrentes não estão sendo criados.
- SLA não dispara alerta perto do vencimento.
- Sprint não rola automaticamente quando expira.
- Sentry Crons (se configurado) marca monitor como `missed`.

### Diagnóstico
```bash
# 1) Healthcheck do app primeiro (cron precisa do app vivo)
curl -i "$APP_URL/api/health"

# 2) Status das últimas execuções do workflow cron.yml
gh run list -w cron.yml --limit 10

# 3) Detalhe da última falha
gh run view <RUN_ID> --log-failed

# 4) Confere secrets do repo
gh secret list | grep -E 'APP_URL|CRON_SECRET'

# 5) Trigger manual (smoke test, sem precisar esperar schedule)
gh workflow run cron.yml -f endpoint=sla-check
```

Pontos comuns de falha:

- `CRON_SECRET` ou `APP_URL` ausentes nos secrets do repo (workflow
  aborta antes do curl).
- Repositório marcado como inativo (sem push há 60+ dias) — GitHub
  desabilita schedules. Solução: dar um push trivial pra reativar.
- `CRON_SECRET` no app difere do CRON_SECRET no repo — endpoint retorna
  401 e `curl -fsS` falha.
- Sentry Crons reporta `missed` — ver [docs/CRON.md § Monitoring](CRON.md#monitoring).

### Mitigação
1. Secret faltando: `gh secret set CRON_SECRET` (ou via UI).
2. Repo inativo: `git commit --allow-empty -m "chore: keep cron schedules alive"`
   seguido de `git push`.
3. Endpoint quebrado: ver logs, abrir hotfix, deploy. Enquanto isso,
   disparar manualmente:
   ```bash
   for ep in sla-check recurring-tickets sprint-rollover project-updates; do
     gh workflow run cron.yml -f endpoint=$ep
   done
   ```

### Comunicação
- Slack `#incidents` SEV-2.
- Avisar produto se passou da janela diária do `sprint-rollover` — pode
  precisar comunicar usuários sobre sprints não roladas.

### Pós-incidente
- Se foi schedule desabilitado por inatividade, documentar lembrete
  (cron mensal de "keepalive" no próprio repo).
- Se foi falha de endpoint, registrar nas patterns de regressão.

---

## 7. Backup falhou

### Sintomas
- Workflow `.github/workflows/backup.yml` apareceu vermelho na aba Actions.
- Slack `#incidents` recebeu mensagem `:rotating_light: Backup DB falhou`
  (configurado no step `Notify on failure`).

### Diagnóstico
```bash
# 1) Última execução
gh run list -w backup.yml --limit 5

# 2) Logs detalhados da falha
gh run view <RUN_ID> --log-failed

# 3) Bucket S3 está acessível com as credenciais atuais?
aws s3 ls "s3://$BACKUP_S3_BUCKET/postgres/" --max-items 5

# 4) Último backup válido lá em cima
aws s3 ls "s3://$BACKUP_S3_BUCKET/postgres/" --recursive \
  | sort | tail -5
```

Causas típicas:

- `AWS_ACCESS_KEY_ID` ou `AWS_SECRET_ACCESS_KEY` rotacionados sem atualizar secrets.
- Bucket sem permissão `s3:PutObject` pra IAM user usado.
- `pg_dump` falhou por conexão recusada (DB caiu junto — tratar como
  cenário 2 primeiro).
- Disco do runner cheio (raro — backup tem cap de retenção local).

### Mitigação
1. **Credencial inválida**: rotacionar AWS user, atualizar secrets do
   repo:
   ```bash
   gh secret set AWS_ACCESS_KEY_ID
   gh secret set AWS_SECRET_ACCESS_KEY
   ```
2. **Permissão**: checar policy IAM — precisa de `s3:PutObject` e
   `s3:ListBucket` no `BACKUP_S3_BUCKET`.
3. **Re-rodar manualmente**:
   ```bash
   gh workflow run backup.yml
   ```
4. Procedimento de **restore** está em [docs/RECOVERY.md](RECOVERY.md).

### Comunicação
- Slack `#incidents` SEV-2 — backup falhando uma vez é tolerável,
  duas vezes seguidas vira SEV-1.
- Owner do workspace deve saber que estamos com janela de risco.

### Pós-incidente
- Validar que próximo backup rodou OK (`gh run list -w backup.yml`).
- Se ficamos > 48h sem backup, considerar rodar restore-test pra
  garantir que último backup íntegro ainda restaura.

---

## 8. Latência alta em listings

### Sintomas
- Páginas de listagem (`/board`, `/tickets`, `/inbox`) demoram > 3s.
- Sentry `transactions` mostra spans de DB longos.
- Usuário relata "tudo travado" mesmo sem erro 5xx.

### Diagnóstico
```bash
# 1) Confere se a migration de índices está aplicada
psql "$DATABASE_URL" -c \
  "SELECT version FROM schema_migrations
   WHERE version IN ('056','057','058') ORDER BY version"
# Esperado: 3 linhas

# 2) Top queries lentas (pg_stat_statements precisa estar habilitado)
psql "$DATABASE_URL" -c \
  "SELECT round(total_exec_time::numeric, 0) AS total_ms,
          calls,
          round(mean_exec_time::numeric, 1) AS mean_ms,
          left(query, 120) AS q
   FROM pg_stat_statements
   ORDER BY total_exec_time DESC LIMIT 20"

# 3) Tabelas sem VACUUM recente (bloat causa scan ruim)
psql "$DATABASE_URL" -c \
  "SELECT relname, n_dead_tup, last_autovacuum
   FROM pg_stat_user_tables
   WHERE n_dead_tup > 10000
   ORDER BY n_dead_tup DESC LIMIT 10"

# 4) Cache hit ratio (esperado > 99%)
psql "$DATABASE_URL" -c \
  "SELECT sum(blks_hit)*100.0 / nullif(sum(blks_hit)+sum(blks_read), 0) AS hit_pct
   FROM pg_stat_database"
```

### Mitigação
1. **Migration não aplicada**: rodar:
   ```bash
   npx ts-node scripts/run-migrations.ts
   ```
   Ver [docs/MIGRATIONS.md](MIGRATIONS.md) pra detalhes.
2. **Bloat**: `VACUUM ANALYZE <tabela>` (não bloqueia leituras).
3. **Query nova ruim**: identificar via `pg_stat_statements`, abrir
   ticket pra adicionar índice ou refatorar.
4. **Cache hit baixo**: aumentar `shared_buffers` no Postgres (requer
   restart) — coordenar janela.

### Comunicação
- Slack `#incidents` SEV-2 quando p95 > 3s sustentado por 10 min.

### Pós-incidente
- Se foi por query nova: regressão coberta em CI? Adicionar teste de
  performance se possível.
- Atualizar [db/056_perf_indexes.sql](../db/056_perf_indexes.sql) ou criar
  nova migration consolidada.

---

## 9. Spam no triage_inbox via webhook

### Sintomas
- `triage_inbox` cresce 100s de itens / minuto sem motivo.
- Workspace específico recebe enxurrada de tickets duplicados.
- Sentry / logs mostram POSTs em rajada no endpoint do webhook.

### Diagnóstico
```bash
# 1) Volume nos últimos 30 min, por workspace e source
psql "$DATABASE_URL" -c \
  "SELECT workspace_id, source, count(*)
   FROM triage_inbox
   WHERE created_at > NOW() - interval '30 minutes'
   GROUP BY 1,2 ORDER BY 3 DESC LIMIT 20"

# 2) IPs de origem (se webhook loga em audit_log)
psql "$DATABASE_URL" -c \
  "SELECT actor_ip, count(*)
   FROM audit_log
   WHERE entity_type = 'triage_inbox'
     AND created_at > NOW() - interval '30 minutes'
   GROUP BY 1 ORDER BY 2 DESC LIMIT 10"
```

### Mitigação
1. **Rotacionar `WEBHOOK_SECRET_INBOX`** imediatamente:
   ```bash
   # Gerar novo secret
   openssl rand -hex 32
   ```
   - EasyPanel → Environment → atualizar `WEBHOOK_SECRET_INBOX` → restart.
   - Atualizar emissor legítimo (Zapier/N8N/etc) com o novo secret.
2. **Quarentenar entradas suspeitas**:
   ```sql
   UPDATE triage_inbox
   SET triage_status = 'discarded'
   WHERE created_at > NOW() - interval '30 minutes'
     AND source = '<source-suspeita>';
   ```
3. **Rate limit** já está ativo (Fase 7.2) — verificar se foi bypass por
   token vazado.
4. **Se rate limit não está cobrindo**: adicionar regra no EasyPanel /
   reverse proxy bloqueando o IP por 1h.

### Comunicação
- Slack `#incidents` SEV-2.
- Se for cliente externo afetado, comunicar e pedir desculpas pelo ruído
  na inbox dele.

### Pós-incidente
- Limpeza dos itens spam (já feito acima com `discarded`).
- Auditar audit_log pra entender vetor (token vazou? Brute force?).
- Considerar adicionar CAPTCHA ou IP allowlist pro webhook se for
  recorrente.

---

## 10. Vazamento de secret no Git

### Sintomas
- GitHub Secret Scanning manda alerta automático.
- Ferramenta SAST (Snyk/Dependabot) sinaliza commit com chave.
- Alguém percebeu chave hardcoded em PR que mergeou.

### Mitigação — ROTACIONAR TUDO QUE PODE TER VAZADO

Faça **em paralelo** o que conseguir. Cada serviço tem janela própria de
propagação.

#### Clerk
1. Dashboard → API Keys → criar nova `Secret Key` → marcar antiga como
   `deprecated` (não delete imediatamente).
2. EasyPanel → Environment → atualizar `CLERK_SECRET_KEY` → restart.
3. Confirmar login funciona → deletar a antiga.

#### Resend (e-mail)
1. Dashboard Resend → API Keys → revogar antiga, criar nova.
2. Atualizar `RESEND_API_KEY` no EasyPanel → restart.
3. Smoke test: enviar e-mail de convite pra você mesmo.

#### OpenAI
1. https://platform.openai.com/api-keys → revoke chave vazada.
2. Criar nova → atualizar `OPENAI_API_KEY` no EasyPanel → restart.
3. Smoke test: `curl /api/ai/triage-test` (ou recriar item no inbox).

#### Postgres
1. **Mais delicado** — exige downtime curto.
2. Conectar como superuser:
   ```sql
   ALTER USER bahjira_app WITH PASSWORD '<nova-senha-forte>';
   ```
3. Atualizar `DATABASE_URL` no EasyPanel (com a nova senha) → restart.
4. Confirmar `/api/health` volta a 200.

#### Supabase
1. Dashboard Supabase → Settings → API → reset `service_role` key e/ou
   `anon` key conforme o que vazou.
2. Atualizar `NEXT_PUBLIC_SUPABASE_ANON_KEY` e/ou `SUPABASE_SERVICE_ROLE_KEY`
   no EasyPanel → restart.
3. Smoke test: notificações realtime ainda chegam.

#### AWS (backup)
1. IAM Console → User do backup → criar novo Access Key → desativar
   antigo (não delete ainda — testar primeiro).
2. Atualizar secrets do repo:
   ```bash
   gh secret set AWS_ACCESS_KEY_ID
   gh secret set AWS_SECRET_ACCESS_KEY
   ```
3. Disparar `gh workflow run backup.yml` → confirmar sucesso → deletar
   chave antiga.

#### Outros (CRON_SECRET, WEBHOOK_SECRET_*)
- Mesmo padrão: gerar novo (`openssl rand -hex 32`), atualizar EasyPanel,
  atualizar callers (workflows, integrações externas), restart.

### Limpeza do histórico Git
- **Se commit foi pra branch `main`**: o segredo já está exposto no
  histórico — rotação é o que importa, **não** tente reescrever história
  pública sem aprovação (quebra clones/forks).
- **Se commit ficou em branch local/PR não-mergeado**: rebase pra
  remover, force-push (com aprovação do dono do PR).
- Sempre confirme com `git log -p -S "<chave-fragmento>"` antes e depois.

### Comunicação
- Slack `#incidents` SEV-1 imediato.
- E-mail pro owner do workspace `bahtech` com timeline de rotação.
- Se houve risco de exfiltração (chave AWS/DB), considerar review de
  audit_log pra atividade suspeita nos últimos N dias.

### Pós-incidente
- Postmortem obrigatório.
- Adicionar pre-commit hook (`gitleaks`, `trufflehog`) se ainda não tem.
- Revisar [docs/ENV.md](ENV.md) — todas as envs têm exemplo `.env.example`
  sem valor real?

---

## Onde colocar isso quando der ruim

- Postmortems e timelines: `docs/incidents/<YYYY-MM-DD>-<slug>.md`
  (criar a pasta se não existir — pedir confirmação no PR).
- Mudanças permanentes de processo: atualizar este runbook + abrir PR.
- Padrões de regressão: registrar em pattern via `npx claude-flow memory store --namespace patterns`.
