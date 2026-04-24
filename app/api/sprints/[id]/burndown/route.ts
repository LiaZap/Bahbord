import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthMember } from '@/lib/api-auth';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    await getAuthMember();

    // Get sprint info
    const sprint = await query(
      `SELECT id, name, start_date, end_date FROM sprints WHERE id = $1`,
      [params.id]
    );
    if (!sprint.rows[0]) {
      return NextResponse.json({ error: 'Sprint não encontrado' }, { status: 404 });
    }

    const { start_date, end_date } = sprint.rows[0];
    if (!start_date || !end_date) {
      return NextResponse.json({ error: 'Sprint sem datas definidas' }, { status: 400 });
    }

    // Total tickets in sprint
    const totalRes = await query(
      `SELECT COUNT(*)::int AS total FROM tickets WHERE sprint_id = $1 AND is_archived = false`,
      [params.id]
    );
    const total = totalRes.rows[0].total;

    // Get completion dates for tickets in this sprint
    const completions = await query(
      `SELECT DATE(completed_at) AS day, COUNT(*)::int AS done
       FROM tickets
       WHERE sprint_id = $1 AND completed_at IS NOT NULL
       GROUP BY DATE(completed_at)
       ORDER BY day ASC`,
      [params.id]
    );

    // Build days array from start to end
    const start = new Date(start_date);
    const end = new Date(end_date);
    const days: Array<{ date: string; remaining: number; ideal: number }> = [];
    const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000));
    let cumulativeDone = 0;

    for (let i = 0; i <= totalDays; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const dayStr = d.toISOString().split('T')[0];

      // Find completions on or before this day
      const doneToday = completions.rows
        .filter((r: any) => r.day && new Date(r.day).toISOString().split('T')[0] <= dayStr)
        .reduce((sum: number, r: any) => sum + r.done, 0);

      const today = new Date();
      const isPastOrToday = d <= today;

      days.push({
        date: dayStr,
        remaining: isPastOrToday ? total - doneToday : total, // stop plotting future days actual
        ideal: Math.max(0, total - (total * i / totalDays)),
      });
    }

    return NextResponse.json({
      total,
      days,
      sprint: sprint.rows[0],
    });
  } catch (err) {
    console.error('GET burndown error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
