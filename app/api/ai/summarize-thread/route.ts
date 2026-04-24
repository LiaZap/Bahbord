import { NextResponse } from 'next/server';
import { summarizeThread } from '@/lib/ai';
import { getAuthMember } from '@/lib/api-auth';
import { query } from '@/lib/db';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(request: Request) {
  try {
    const auth = await getAuthMember();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const rl = checkRateLimit(`ai:${auth.id}`, 20, 60000); // 20 per minute
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Muitas requisições. Aguarde.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
      );
    }

    const { ticket_id } = await request.json();
    if (!ticket_id) return NextResponse.json({ error: 'ticket_id obrigatório' }, { status: 400 });

    const result = await query<{ body: string }>(
      `SELECT body
       FROM comments
       WHERE ticket_id = $1
       ORDER BY created_at ASC`,
      [ticket_id]
    );

    const comments = result.rows.map((row) => (row.body || '').trim()).filter(Boolean);
    if (comments.length === 0) {
      return NextResponse.json({ summary: '', count: 0 });
    }

    const summary = await summarizeThread(comments);
    return NextResponse.json({ summary, count: comments.length });
  } catch (err) {
    console.error('AI summarize-thread error:', err);
    return NextResponse.json({ error: 'Erro ao resumir thread' }, { status: 500 });
  }
}
