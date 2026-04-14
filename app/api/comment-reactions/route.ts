import { NextResponse } from 'next/server';
import { query, getDefaultMemberId } from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const commentId = searchParams.get('comment_id');

  if (!commentId) {
    return NextResponse.json({ error: 'comment_id obrigatório' }, { status: 400 });
  }

  const result = await query(
    `SELECT cr.emoji, COUNT(*)::int AS count,
      array_agg(m.display_name) AS members
    FROM comment_reactions cr
    JOIN members m ON m.id = cr.member_id
    WHERE cr.comment_id = $1
    GROUP BY cr.emoji
    ORDER BY count DESC`,
    [commentId]
  );

  return NextResponse.json(result.rows);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { comment_id, emoji } = body;

  if (!comment_id || !emoji) {
    return NextResponse.json({ error: 'comment_id e emoji são obrigatórios' }, { status: 400 });
  }

  let memberId: string;
  try {
    memberId = await getDefaultMemberId();
  } catch {
    return NextResponse.json({ error: 'Nenhum membro encontrado' }, { status: 400 });
  }

  // Toggle: se já tem a reação, remove; se não, adiciona
  const existing = await query(
    `SELECT id FROM comment_reactions WHERE comment_id = $1 AND member_id = $2 AND emoji = $3`,
    [comment_id, memberId, emoji]
  );

  if (existing.rowCount && existing.rowCount > 0) {
    await query(
      `DELETE FROM comment_reactions WHERE comment_id = $1 AND member_id = $2 AND emoji = $3`,
      [comment_id, memberId, emoji]
    );
    return NextResponse.json({ action: 'removed' });
  }

  await query(
    `INSERT INTO comment_reactions (comment_id, member_id, emoji) VALUES ($1, $2, $3)`,
    [comment_id, memberId, emoji]
  );

  return NextResponse.json({ action: 'added' }, { status: 201 });
}
