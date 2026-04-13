import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period') || '7'; // dias

  const result = await query(
    `SELECT
      te.id, te.description, te.started_at, te.ended_at,
      te.duration_minutes, te.is_running, te.created_at,
      m.display_name AS member_name,
      tf.ticket_key, tf.title AS ticket_title
    FROM time_entries te
    LEFT JOIN members m ON m.id = te.member_id
    LEFT JOIN tickets_full tf ON tf.id = te.ticket_id
    WHERE te.started_at > NOW() - ($1 || ' days')::interval
    ORDER BY te.started_at DESC`,
    [period]
  );

  // Resumo por membro
  const summary = await query(
    `SELECT
      m.display_name AS member_name,
      SUM(te.duration_minutes)::int AS total_minutes,
      COUNT(te.id)::int AS entry_count
    FROM time_entries te
    LEFT JOIN members m ON m.id = te.member_id
    WHERE te.started_at > NOW() - ($1 || ' days')::interval
      AND te.is_running = false
    GROUP BY m.display_name
    ORDER BY total_minutes DESC`,
    [period]
  );

  return NextResponse.json({
    entries: result.rows,
    summary: summary.rows,
  });
}
