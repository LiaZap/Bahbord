import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthMember, isAdmin } from '@/lib/api-auth';
import { decryptSecret } from '@/lib/doc-secrets';
import { logAudit, extractRequestMeta } from '@/lib/audit';

// POST /api/docs/credentials/reveal
// Body: { id, intent?: 'view'|'copy' } — descriptografa, grava audit, retorna
// o secret em memória. Nunca cacheável. Resposta com Cache-Control: no-store.
export async function POST(request: Request) {
  try {
    const auth = await getAuthMember();
    if (!auth || !isAdmin(auth.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const body = await request.json();
    const { id, intent } = body;
    if (!id) {
      return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
    }

    const result = await query<{
      page_id: string;
      label: string;
      secret_ciphertext: string;
      secret_iv: string;
      secret_auth_tag: string;
    }>(
      `SELECT page_id, label, secret_ciphertext, secret_iv, secret_auth_tag
       FROM doc_credentials WHERE id = $1`,
      [id]
    );
    const row = result.rows[0];
    if (!row) {
      return NextResponse.json({ error: 'Credencial não encontrada' }, { status: 404 });
    }

    let secret: string;
    try {
      secret = decryptSecret({
        ciphertext: row.secret_ciphertext,
        iv: row.secret_iv,
        authTag: row.secret_auth_tag,
      });
    } catch (err) {
      console.error('decrypt failed:', err);
      return NextResponse.json(
        { error: 'Falha ao descriptografar — chave inválida ou dado corrompido' },
        { status: 500 }
      );
    }

    const meta = extractRequestMeta(request);
    await logAudit({
      workspaceId: auth.workspace_id,
      actorId: auth.id,
      action: intent === 'copy' ? 'doc_credential.copy' : 'doc_credential.reveal',
      entityType: 'doc_credential',
      entityId: id,
      changes: { page_id: row.page_id, label: row.label },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return new NextResponse(JSON.stringify({ secret }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, private',
        Pragma: 'no-cache',
      },
    });
  } catch (err) {
    console.error('POST /api/docs/credentials/reveal error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
