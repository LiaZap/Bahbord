# Recovery — playbook de restore de backup

Procedimento para restaurar o banco de dados a partir dos dumps diários
em S3 produzidos por [scripts/backup-db.sh](../scripts/backup-db.sh) via
workflow [.github/workflows/backup.yml](../.github/workflows/backup.yml).

> **REGRA DE OURO**: nunca restaurar direto em produção sem teste em
> staging. Restore é destrutivo e desfaz qualquer escrita feita depois
> do dump.

## Pré-requisitos

- AWS CLI configurada com user que tem permissão `s3:GetObject` no
  bucket `$BACKUP_S3_BUCKET`.
- `pg_restore` instalado (vem com `postgresql-client`).
- Acesso ao Postgres de staging (env separado de prod).
- Janela de manutenção combinada se a destinação for prod.

```bash
# Sanity check rápido
aws sts get-caller-identity
pg_restore --version
psql --version
```

## 1. Listar backups disponíveis

```bash
# Últimos 10 backups, mais recente em baixo
aws s3 ls "s3://$BACKUP_S3_BUCKET/postgres/" --recursive \
  | sort | tail -10
```

Saída esperada:

```
2026-05-08 03:00:21  142857921 postgres/backup-2026-05-08-0300.dump
2026-05-09 03:00:18  143918274 postgres/backup-2026-05-09-0300.dump
2026-05-10 03:00:25  144052819 postgres/backup-2026-05-10-0300.dump
```

Critérios pra escolher:

- **Último backup íntegro** (default): o mais recente. Se incidente foi
  às 04:00, o backup das 03:00 é o ideal.
- **Backup pré-incidente**: se a corrupção começou ontem, vá pro backup
  de antes de ontem.
- **Tamanho coerente**: dumps que pulam muito de tamanho (10× menor que
  os outros) indicam dump incompleto — pular.

## 2. Baixar o backup

```bash
LATEST="postgres/backup-2026-05-10-0300.dump"
aws s3 cp "s3://$BACKUP_S3_BUCKET/$LATEST" "/tmp/restore.dump"

# Sanity check do tamanho — confere se bate com o ls do passo 1
ls -lh /tmp/restore.dump
```

## 3. Restaurar em STAGING primeiro (obrigatório)

```bash
# Use o DATABASE_URL de staging — nunca o de prod aqui.
export STAGING_DB_URL="postgres://bahjira_app:***@staging-db:5432/bahjira_staging"

# 3a) DROP + CREATE schema (limpa o staging)
psql "$STAGING_DB_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# 3b) Restore (formato custom = -Fc, default do nosso pg_dump)
pg_restore \
  --dbname="$STAGING_DB_URL" \
  --no-owner \
  --no-acl \
  --jobs=4 \
  --verbose \
  /tmp/restore.dump
```

Tempo esperado: 5-15 min para um dump de 150 MB. Se estourar 30 min,
abortar e investigar (provavelmente CPU/disco do staging fraco).

## 4. Sanidade dos dados restaurados

Rode estas queries — os números devem bater com produção (com a
defasagem do horário do dump):

```sql
-- Contagens-chave
SELECT 'workspaces' AS t, count(*) FROM workspaces
UNION ALL SELECT 'members', count(*) FROM members
UNION ALL SELECT 'projects', count(*) FROM projects
UNION ALL SELECT 'tickets', count(*) FROM tickets
UNION ALL SELECT 'sprints', count(*) FROM sprints
UNION ALL SELECT 'audit_log', count(*) FROM audit_log;

-- Último audit_log (timestamp do "fim" do dump)
SELECT created_at, action, entity_type, entity_id
FROM audit_log
ORDER BY created_at DESC
LIMIT 5;

-- Últimos tickets criados (sanity de ordem cronológica)
SELECT id, title, created_at
FROM tickets
ORDER BY created_at DESC
LIMIT 5;

-- Schema migrations aplicadas
SELECT version, applied_at
FROM schema_migrations
ORDER BY version DESC
LIMIT 5;
```

Compare com produção (rode as mesmas queries em prod e tire diff). Se
algum count estiver zerado quando não deveria, o restore quebrou — não
prossiga.

## 5. Subir o app apontado pro DB restaurado (smoke)

```bash
# Localmente, só pra confirmar que o schema "abre"
DATABASE_URL="$STAGING_DB_URL" npm run build
DATABASE_URL="$STAGING_DB_URL" npm start

# Em outra janela
curl -i http://localhost:3000/api/health
# Esperado: 200 com db.ok = true
```

Se o build / health passa, o backup está funcional.

## 6. Promover para produção (se for o caso)

> **Só faça isso em janela combinada**. Restore em prod = data loss
> entre o último backup e agora.

```bash
# 6a) Avisar Slack #incidents que vai começar — congelar escritas
#     (idealmente subir o app em modo manutenção via reverse proxy)

# 6b) Apontar pro DB de prod
export PROD_DB_URL="postgres://bahjira_app:***@prod-db:5432/bahjira"

# 6c) Backup do estado atual de prod (mesmo que corrompido — é seguro ter)
pg_dump -Fc "$PROD_DB_URL" -f "/tmp/prod-pre-restore-$(date +%s).dump"
aws s3 cp "/tmp/prod-pre-restore-$(date +%s).dump" \
  "s3://$BACKUP_S3_BUCKET/postgres/manual-pre-restore-$(date +%s).dump"

# 6d) DROP + CREATE schema (DESTRUTIVO)
psql "$PROD_DB_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# 6e) Restore
pg_restore \
  --dbname="$PROD_DB_URL" \
  --no-owner \
  --no-acl \
  --jobs=4 \
  --verbose \
  /tmp/restore.dump

# 6f) Repetir queries de sanidade do passo 4 contra prod

# 6g) Restart do app (EasyPanel UI ou CLI)
#     Tirar do modo manutenção
```

## 7. Reverter restore (se o restore em prod falhar)

Se o restore em prod produziu estado inconsistente:

```bash
# Voltar pro snapshot pré-restore criado em 6c
psql "$PROD_DB_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
pg_restore \
  --dbname="$PROD_DB_URL" \
  --no-owner --no-acl --jobs=4 --verbose \
  /tmp/prod-pre-restore-<timestamp>.dump
```

Se nem isso funcionar:

1. Identificar último backup automático **anterior** ao incidente
   (passo 1 — listar).
2. Repetir do passo 2 com esse outro arquivo.
3. Se nenhum backup automático recente é íntegro: SEV-1 escalado, abrir
   ticket no provedor (EasyPanel/Postgres host) imediatamente.

## 8. Pós-restore

- Validar funcionalidades críticas: criar ticket, criar comentário,
  ver notificação chegar, login OK, busca semântica responde.
- Avisar Slack `#incidents` que o app voltou + janela de dados perdidos
  (ex.: "tudo entre 03:00 e 09:30 de hoje precisa ser refeito").
- Atualizar postmortem em `docs/incidents/<data>-<slug>.md`.
- Atualizar este RECOVERY.md se algum passo foi diferente do escrito.

---

## Test de restore mensal (sugestão — automatizar)

Hoje **não temos** validação periódica de que o backup é restaurável.
Sugestão: workflow mensal que:

1. Spinup de Postgres efêmero (container Docker).
2. Pega o backup mais recente do S3.
3. Restaura nele.
4. Roda as queries de sanidade (passo 4).
5. Falha o workflow se algum count vier zerado.
6. Notifica Slack `#incidents` em sucesso E em falha.

Esqueleto de workflow (não-implementado ainda):

```yaml
# .github/workflows/restore-test.yml  (a criar)
name: Restore test (mensal)

on:
  schedule:
    - cron: '0 6 1 * *'   # dia 1 de cada mês, 06:00 UTC
  workflow_dispatch: {}

permissions:
  contents: read

jobs:
  restore-test:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: testpass
          POSTGRES_DB: bahjira_restore_test
        options: >-
          --health-cmd pg_isready --health-interval 5s
          --health-timeout 3s --health-retries 10
        ports: ['5432:5432']
    steps:
      - uses: actions/checkout@v4

      - name: Install postgresql-client
        run: |
          sudo apt-get update
          sudo apt-get install -y --no-install-recommends postgresql-client

      - name: Configure AWS
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ secrets.AWS_REGION || 'us-east-1' }}

      - name: Download latest backup
        run: |
          LATEST=$(aws s3 ls "s3://${{ secrets.BACKUP_S3_BUCKET }}/postgres/" \
            | sort | tail -1 | awk '{print $4}')
          echo "Latest: $LATEST"
          aws s3 cp "s3://${{ secrets.BACKUP_S3_BUCKET }}/postgres/$LATEST" \
            /tmp/restore.dump

      - name: Restore
        env:
          PGPASSWORD: testpass
        run: |
          pg_restore --dbname="postgres://postgres:testpass@localhost:5432/bahjira_restore_test" \
            --no-owner --no-acl --jobs=4 --verbose /tmp/restore.dump

      - name: Sanity queries
        env:
          PGPASSWORD: testpass
        run: |
          psql "postgres://postgres:testpass@localhost:5432/bahjira_restore_test" \
            -c "SELECT 'tickets' AS t, count(*) FROM tickets" \
            -c "SELECT count(*) FROM workspaces" \
            -c "SELECT count(*) FROM members"
          # Falhar se tickets = 0 (proxy de "restore vazio")
          COUNT=$(psql "postgres://postgres:testpass@localhost:5432/bahjira_restore_test" \
            -tAc "SELECT count(*) FROM tickets")
          if [ "$COUNT" -lt 1 ]; then
            echo "::error::Restore vazio — backup pode estar corrompido"
            exit 1
          fi

      - name: Notify
        if: always()
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
        run: |
          if [ -z "$SLACK_WEBHOOK_URL" ]; then exit 0; fi
          STATUS_EMOJI=":white_check_mark:"
          [ "${{ job.status }}" != "success" ] && STATUS_EMOJI=":rotating_light:"
          curl -fsS -X POST -H 'Content-Type: application/json' \
            --data "{\"text\":\"$STATUS_EMOJI Restore test mensal: ${{ job.status }}\"}" \
            "$SLACK_WEBHOOK_URL" || true
```

Ao adotar, não esqueça de atualizar [docs/CRON.md](CRON.md) com o novo
schedule.
