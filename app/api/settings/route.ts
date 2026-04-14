import { NextResponse } from 'next/server';
import { query, getDefaultWorkspaceId } from '@/lib/db';

// GET workspace settings
export async function GET() {
  const result = await query(
    `SELECT id, name, slug, prefix, description, avatar_url, created_at, updated_at
    FROM workspaces LIMIT 1`
  );
  return NextResponse.json(result.rows[0] || null);
}

// PATCH workspace settings
export async function PATCH(request: Request) {
  const body = await request.json();
  const { table, id, ...fields } = body;

  // Generic CRUD para tabelas de configuração
  if (table) {
    const allowedTables = ['statuses', 'services', 'categories', 'ticket_types', 'quick_reactions', 'members'];
    if (!allowedTables.includes(table)) {
      return NextResponse.json({ error: 'Tabela não permitida' }, { status: 400 });
    }

    const sets: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    for (const [key, val] of Object.entries(fields)) {
      sets.push(`${key} = $${idx}`);
      values.push(val);
      idx++;
    }

    if (sets.length === 0) {
      return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 });
    }

    values.push(id);
    const result = await query(
      `UPDATE ${table} SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    return NextResponse.json(result.rows[0]);
  }

  // Update workspace
  const sets: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  for (const [key, val] of Object.entries(body)) {
    if (['name', 'description', 'prefix'].includes(key)) {
      sets.push(`${key} = $${idx}`);
      values.push(val);
      idx++;
    }
  }

  if (sets.length === 0) {
    return NextResponse.json({ error: 'Nenhum campo' }, { status: 400 });
  }

  sets.push(`updated_at = NOW()`);
  const wsId = await getDefaultWorkspaceId();
  values.push(wsId);
  const result = await query(
    `UPDATE workspaces SET ${sets.join(', ')} WHERE id = $${idx + 1} RETURNING *`,
    values
  );

  return NextResponse.json(result.rows[0]);
}

// POST - criar novo item em tabelas de configuração
export async function POST(request: Request) {
  const body = await request.json();
  const { table, ...fields } = body;

  const allowedTables = ['statuses', 'services', 'categories', 'ticket_types', 'quick_reactions'];
  if (!table || !allowedTables.includes(table)) {
    return NextResponse.json({ error: 'Tabela não permitida' }, { status: 400 });
  }

  let workspaceId: string;
  try {
    workspaceId = await getDefaultWorkspaceId();
  } catch {
    return NextResponse.json({ error: 'Workspace não encontrado' }, { status: 400 });
  }

  const allFields = { ...fields, workspace_id: workspaceId };
  const columns = Object.keys(allFields);
  const placeholders = columns.map((_, i) => `$${i + 1}`);
  const values = Object.values(allFields);

  const result = await query(
    `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
    values
  );

  return NextResponse.json(result.rows[0], { status: 201 });
}

// DELETE
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const table = searchParams.get('table');
  const id = searchParams.get('id');

  const allowedTables = ['statuses', 'services', 'categories', 'ticket_types', 'quick_reactions'];
  if (!table || !id || !allowedTables.includes(table)) {
    return NextResponse.json({ error: 'table e id obrigatórios' }, { status: 400 });
  }

  // Verificar se tem tickets associados (para statuses e services)
  if (table === 'statuses') {
    const check = await query(`SELECT COUNT(*) AS cnt FROM tickets WHERE status_id = $1`, [id]);
    if (parseInt(check.rows[0].cnt) > 0) {
      return NextResponse.json({ error: 'Não é possível remover: existem tickets com este status' }, { status: 409 });
    }
  }

  if (table === 'services') {
    const check = await query(`SELECT COUNT(*) AS cnt FROM tickets WHERE service_id = $1`, [id]);
    if (parseInt(check.rows[0].cnt) > 0) {
      return NextResponse.json({ error: 'Não é possível remover: existem tickets com este serviço' }, { status: 409 });
    }
  }

  await query(`DELETE FROM ${table} WHERE id = $1`, [id]);
  return NextResponse.json({ ok: true });
}
