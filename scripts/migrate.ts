#!/usr/bin/env tsx
/**
 * Migration runner pro Bah!Flow.
 *
 * Aplica migrations em db/*.sql que ainda nao estao registradas na tabela
 * schema_migrations. Calcula sha256 do conteudo e detecta drift (arquivo
 * mudou apos apply — ALERTA mas nao falha).
 *
 * Uso:
 *   tsx scripts/migrate.ts            # aplica pendentes
 *   tsx scripts/migrate.ts --dry-run  # lista pendentes sem aplicar
 *   tsx scripts/migrate.ts --check    # confirma checksum de aplicadas
 *
 * Convencoes:
 *   - Migrations vivem em ./db/
 *   - Arquivos elegiveis: schema.sql, 0XX_*.sql (ate 099), 1XX_*.sql, ...
 *   - Ordem alfanumerica (sort lexicografico)
 *   - 'manual-backfill' como checksum sentinel: NAO conta como drift
 *   - Cada migration roda em transacao propria (BEGIN/COMMIT/ROLLBACK)
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { Client } from 'pg';

const DB_DIR = path.join(process.cwd(), 'db');
const RUNNER_ID = 'scripts/migrate.ts@v1';
const BACKFILL_SENTINEL = 'manual-backfill';

interface Migration {
  filename: string;
  fullPath: string;
  checksum: string;
  content: string;
}

/**
 * Carrega todas as migrations elegiveis em ordem.
 * Inclui schema.sql + qualquer NNN_*.sql (3 digitos, sublinhado, nome).
 * Exclui FULL_SETUP.sql, seed_breakr.sql, e qualquer coisa em db/manual/.
 */
async function loadMigrations(): Promise<Migration[]> {
  const entries = await fs.readdir(DB_DIR, { withFileTypes: true });
  const files = entries
    .filter((d) => d.isFile())
    .map((d) => d.name)
    .filter((f) => f === 'schema.sql' || /^\d{3}_.*\.sql$/.test(f))
    .sort();

  const migs: Migration[] = [];
  for (const f of files) {
    const fullPath = path.join(DB_DIR, f);
    const content = await fs.readFile(fullPath, 'utf-8');
    const checksum = crypto.createHash('sha256').update(content).digest('hex');
    migs.push({ filename: f, fullPath, checksum, content });
  }
  return migs;
}

/**
 * Le o estado atual do schema_migrations. Se a tabela nao existe ainda
 * (primeira run absoluta), retorna Map vazio.
 */
async function getApplied(client: Client): Promise<Map<string, string>> {
  try {
    const r = await client.query<{ filename: string; checksum: string }>(
      'SELECT filename, checksum FROM schema_migrations'
    );
    return new Map(r.rows.map((row) => [row.filename, row.checksum]));
  } catch (err) {
    // 42P01 = undefined_table — primeira execucao, antes do 059 rodar
    if ((err as { code?: string }).code === '42P01') return new Map();
    throw err;
  }
}

/**
 * Aplica uma migration em transacao propria.
 * Se o INSERT em schema_migrations falhar (ex: tabela nao existe ainda
 * porque essa MESMA migration cria a tabela), faz fallback:
 * commit do conteudo, depois INSERT em transacao separada.
 */
async function applyMigration(client: Client, mig: Migration): Promise<number> {
  const startedAt = Date.now();
  await client.query('BEGIN');
  try {
    await client.query(mig.content);

    // Tenta registrar na MESMA transacao. Se a tabela schema_migrations
    // foi criada por essa propria migration (caso 059), ainda esta visivel
    // dentro da transacao — entao funciona.
    await client.query(
      `INSERT INTO schema_migrations (filename, checksum, duration_ms, applied_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (filename) DO UPDATE
         SET checksum = EXCLUDED.checksum,
             applied_at = NOW(),
             duration_ms = EXCLUDED.duration_ms,
             applied_by = EXCLUDED.applied_by`,
      [mig.filename, mig.checksum, Date.now() - startedAt, RUNNER_ID]
    );

    await client.query('COMMIT');
    return Date.now() - startedAt;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}

interface CliFlags {
  dryRun: boolean;
  checkOnly: boolean;
}

function parseArgs(argv: string[]): CliFlags {
  const args = new Set(argv.slice(2));
  return {
    dryRun: args.has('--dry-run'),
    checkOnly: args.has('--check'),
  };
}

async function main(): Promise<void> {
  const { dryRun, checkOnly } = parseArgs(process.argv);

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('ERRO: DATABASE_URL nao setado');
    process.exit(1);
  }

  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  try {
    const migrations = await loadMigrations();
    const applied = await getApplied(client);

    const pending = migrations.filter((m) => !applied.has(m.filename));
    const drifted = migrations.filter((m) => {
      const known = applied.get(m.filename);
      if (!known) return false;
      if (known === BACKFILL_SENTINEL) return false;
      return known !== m.checksum;
    });

    if (drifted.length > 0) {
      console.warn(
        `AVISO: ${drifted.length} migrations DRIFTED (conteudo mudou apos apply):`
      );
      drifted.forEach((m) => console.warn(`   - ${m.filename}`));
      console.warn(
        '   Drift e WARNING, nao erro. Migrations aplicadas nao sao re-executadas.'
      );
      console.warn(
        '   Para re-aplicar manualmente: DELETE FROM schema_migrations WHERE filename = ...'
      );
    }

    if (checkOnly) {
      const appliedCount = migrations.length - pending.length;
      console.log(`STATUS: ${appliedCount}/${migrations.length} aplicadas`);
      if (pending.length > 0) {
        console.log(`PENDENTES (${pending.length}):`);
        pending.forEach((m) => console.log(`   - ${m.filename}`));
      } else {
        console.log('Nenhuma pendente.');
      }
      // Exit 2 se houver drift — util pra CI
      process.exit(drifted.length > 0 ? 2 : 0);
    }

    if (pending.length === 0) {
      console.log('OK: nenhuma migration pendente');
      return;
    }

    console.log(`PENDENTES (${pending.length}):`);
    pending.forEach((m) => console.log(`   - ${m.filename}`));

    if (dryRun) {
      console.log('DRY RUN — nenhuma alteracao feita');
      return;
    }

    for (const mig of pending) {
      console.log(`APLICANDO ${mig.filename}...`);
      const ms = await applyMigration(client, mig);
      console.log(`   OK (${ms}ms)`);
    }

    console.log(`\nSUCCESS: ${pending.length} migrations aplicadas`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('FALHA no migration runner:', err);
  process.exit(1);
});
