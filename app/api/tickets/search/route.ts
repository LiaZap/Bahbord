import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim();

  if (!q || q.length < 2) {
    return NextResponse.json([]);
  }

  const result = await query(
    `SELECT
      tf.id, tf.title, tf.ticket_key,
      tf.status_name, tf.status_color,
      tf.service_name, tf.assignee_name, tf.type_icon
    FROM tickets_full tf
    WHERE tf.is_archived = false
      AND (tf.title ILIKE $1 OR tf.ticket_key ILIKE $1)
    ORDER BY tf.updated_at DESC
    LIMIT 15`,
    [`%${q}%`]
  );

  return NextResponse.json(result.rows);
}
