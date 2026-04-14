import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q')?.trim();
    const pageParam = searchParams.get('page');
    const limitParam = searchParams.get('limit');

    if (!q || q.length < 2) {
      return NextResponse.json([]);
    }

    const searchPattern = `%${q}%`;

    const baseQuery = `
      FROM tickets_full tf
      WHERE tf.is_archived = false
        AND (tf.title ILIKE $1 OR tf.ticket_key ILIKE $1)`;

    // If no page param, return results with default limit (backward compat)
    if (!pageParam) {
      const limit = Math.max(1, Math.min(200, parseInt(limitParam || '15') || 15));
      const result = await query(
        `SELECT
          tf.id, tf.title, tf.ticket_key,
          tf.status_name, tf.status_color,
          tf.service_name, tf.assignee_name, tf.type_icon
        ${baseQuery}
        ORDER BY tf.updated_at DESC
        LIMIT $2`,
        [searchPattern, limit]
      );
      return NextResponse.json(result.rows);
    }

    const page = Math.max(1, parseInt(pageParam) || 1);
    const limit = Math.max(1, Math.min(200, parseInt(limitParam || '50') || 50));
    const offset = (page - 1) * limit;

    const [countResult, result] = await Promise.all([
      query(`SELECT COUNT(*) AS total ${baseQuery}`, [searchPattern]),
      query(
        `SELECT
          tf.id, tf.title, tf.ticket_key,
          tf.status_name, tf.status_color,
          tf.service_name, tf.assignee_name, tf.type_icon
        ${baseQuery}
        ORDER BY tf.updated_at DESC
        LIMIT $2 OFFSET $3`,
        [searchPattern, limit, offset]
      ),
    ]);

    const total = parseInt(countResult.rows[0].total);

    return NextResponse.json({
      data: result.rows,
      pagination: { page, limit, total },
    });
  } catch (err) {
    console.error('GET /api/tickets/search error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
