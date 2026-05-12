import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthMember, isAdmin } from '@/lib/api-auth';
import { encryptSecret, isDocSecretsConfigured } from '@/lib/doc-secrets';
import { logAudit, extractRequestMeta } from '@/lib/audit';

// Lista credenciais de uma página — NUNCA retorna o secret decifrado.
export async function GET(request: Request) {
  try {
    const auth = await getAuthMember();
    if (!auth || !isAdmin(auth.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const pageId = searchParams.get('page_id');
    if (!pageId) {
      return NextResponse.json({ error: 'page_id é obrigatório' }, { status: 400 });
    }

    const result = await query(
      `SELECT c.id, c.page_id, c.label, c.username, c.url, c.notes, c.position,
              c.created_at, c.updated_at,
              m1.display_name AS created_by_name,
              m2.display_name AS updated_by_name
       FROM doc_credentials c
       LEFT JOIN members m1 ON m1.id = c.created_by
       LEFT JOIN members m2 ON m2.id = c.updated_by
       WHERE c.page_id = $1
       ORDER BY c.position ASC, c.created_at ASC`,
      [pageId]
    );
    return NextResponse.json(result.rows);
  } catch (err) {
    console.error('GET /api/docs/credentials error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getAuthMember();
    if (!auth || !isAdmin(auth.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }
    if (!isDocSecretsConfigured()) {
      return NextResponse.json(
        { error: 'DOC_SECRETS_KEY não configurada no servidor' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { page_id, label, username, url, notes, secret } = body;

    if (!page_id || !label?.trim() || !secret) {
      return NextResponse.json(
        { error: 'page_id, label e secret são obrigatórios' },
        { status: 400 }
      );
    }

    const enc = encryptSecret(String(secret));
    const result = await query(
      `INSERT INTO doc_credentials
        (page_id, label, username, url, notes, secret_ciphertext, secret_iv, secret_auth_tag, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
       RETURNING id, page_id, label, username, url, notes, position, created_at, updated_at`,
      [
        page_id,
        String(label).trim(),
        username || null,
        url || null,
        notes || null,
        enc.ciphertext,
        enc.iv,
        enc.authTag,
        auth.id,
      ]
    );

    const meta = extractRequestMeta(request);
    await logAudit({
      workspaceId: auth.workspace_id,
      actorId: auth.id,
      action: 'doc_credential.create',
      entityType: 'doc_credential',
      entityId: result.rows[0].id,
      changes: { page_id, label: String(label).trim() },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err) {
    console.error('POST /api/docs/credentials error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await getAuthMember();
    if (!auth || !isAdmin(auth.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const body = await request.json();
    const { id, label, username, url, notes, secret } = body;
    if (!id) {
      return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
    }

    const sets: string[] = ['updated_at = NOW()', `updated_by = $1`];
    const params: unknown[] = [auth.id];
    let idx = 2;

    if (label !== undefined) {
      sets.push(`label = $${idx++}`);
      params.push(String(label).trim());
    }
    if (username !== undefined) {
      sets.push(`username = $${idx++}`);
      params.push(username || null);
    }
    if (url !== undefined) {
      sets.push(`url = $${idx++}`);
      params.push(url || null);
    }
    if (notes !== undefined) {
      sets.push(`notes = $${idx++}`);
      params.push(notes || null);
    }
    if (secret !== undefined && secret !== '') {
      if (!isDocSecretsConfigured()) {
        return NextResponse.json(
          { error: 'DOC_SECRETS_KEY não configurada no servidor' },
          { status: 503 }
        );
      }
      const enc = encryptSecret(String(secret));
      sets.push(`secret_ciphertext = $${idx++}`);
      params.push(enc.ciphertext);
      sets.push(`secret_iv = $${idx++}`);
      params.push(enc.iv);
      sets.push(`secret_auth_tag = $${idx++}`);
      params.push(enc.authTag);
    }

    params.push(id);
    const result = await query(
      `UPDATE doc_credentials SET ${sets.join(', ')}
       WHERE id = $${idx}
       RETURNING id, page_id, label, username, url, notes, position, created_at, updated_at`,
      params
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Credencial não encontrada' }, { status: 404 });
    }

    const meta = extractRequestMeta(request);
    await logAudit({
      workspaceId: auth.workspace_id,
      actorId: auth.id,
      action: 'doc_credential.update',
      entityType: 'doc_credential',
      entityId: id,
      changes: { fields: Object.keys(body).filter(k => k !== 'id' && k !== 'secret'), secret_changed: secret !== undefined && secret !== '' },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json(result.rows[0]);
  } catch (err) {
    console.error('PATCH /api/docs/credentials error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await getAuthMember();
    if (!auth || !isAdmin(auth.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
    }

    const result = await query(
      `DELETE FROM doc_credentials WHERE id = $1 RETURNING page_id, label`,
      [id]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Credencial não encontrada' }, { status: 404 });
    }

    const meta = extractRequestMeta(request);
    await logAudit({
      workspaceId: auth.workspace_id,
      actorId: auth.id,
      action: 'doc_credential.delete',
      entityType: 'doc_credential',
      entityId: id,
      changes: { page_id: result.rows[0].page_id, label: result.rows[0].label },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/docs/credentials error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
