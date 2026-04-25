import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getAuthMember } from '@/lib/api-auth';

export async function GET() {
  try {
    const auth = await getAuthMember();
    if (!auth) return NextResponse.json({ inbox: 0, my_tasks: 0, this_week: 0 });

    const [inbox, myTasks, thisWeek] = await Promise.all([
      query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM notifications WHERE recipient_id = $1 AND is_read = false`,
        [auth.id]
      ),
      query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM tickets_full
         WHERE assignee_id = $1 AND is_archived = false AND is_done = false`,
        [auth.id]
      ),
      query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM tickets_full
         WHERE assignee_id = $1
           AND is_archived = false AND is_done = false
           AND due_date IS NOT NULL
           AND due_date >= date_trunc('week', NOW())
           AND due_date < date_trunc('week', NOW()) + INTERVAL '7 days'`,
        [auth.id]
      ),
    ]);

    return NextResponse.json({
      inbox: parseInt(inbox.rows[0]?.count || '0'),
      my_tasks: parseInt(myTasks.rows[0]?.count || '0'),
      this_week: parseInt(thisWeek.rows[0]?.count || '0'),
    });
  } catch (err) {
    console.error('GET /api/personal/counts error:', err);
    return NextResponse.json({ inbox: 0, my_tasks: 0, this_week: 0 });
  }
}
