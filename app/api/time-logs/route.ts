import { NextResponse } from 'next/server';
import { v4 as uuid4 } from 'uuid';
import { getDb, COLLECTIONS } from '@/lib/mongodb';
import type { TimeLogDoc } from '@/lib/mongo-schemas';
import { getAuthMember } from '@/lib/api-auth';

export async function GET(request: Request) {
  try {
    await getAuthMember();
    const { searchParams } = new URL(request.url);
    const ticketId = searchParams.get('ticket_id');
    const memberId = searchParams.get('member_id');
    const workspaceId = searchParams.get('workspace_id');
    const isBillable = searchParams.get('is_billable');
    const period = searchParams.get('period'); // days
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500);
    const page = Math.max(parseInt(searchParams.get('page') || '1'), 1);

    const db = await getDb();
    const col = db.collection<TimeLogDoc>(COLLECTIONS.TIME_LOGS);

    const filter: Record<string, unknown> = {};
    if (ticketId) filter.ticket_id = ticketId;
    if (memberId) filter.member_id = memberId;
    if (workspaceId) filter.workspace_id = workspaceId;
    if (isBillable === 'true') filter.is_billable = true;
    if (isBillable === 'false') filter.is_billable = false;
    if (period) {
      filter.started_at = { $gte: new Date(Date.now() - parseInt(period) * 86400000) };
    }

    const [docs, total] = await Promise.all([
      col.find(filter)
        .sort({ created_at: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
      col.countDocuments(filter),
    ]);

    // Summary aggregation
    const summary = await col.aggregate([
      { $match: { ...filter, is_running: false } },
      {
        $group: {
          _id: '$member_name',
          total_minutes: { $sum: '$duration_minutes' },
          billable_minutes: { $sum: { $cond: ['$is_billable', '$duration_minutes', 0] } },
          non_billable_minutes: { $sum: { $cond: ['$is_billable', 0, '$duration_minutes'] } },
          entry_count: { $sum: 1 },
        },
      },
      { $sort: { total_minutes: -1 } },
    ]).toArray();

    return NextResponse.json({
      data: docs,
      summary: summary.map((s) => ({
        member_name: s._id,
        total_minutes: s.total_minutes,
        billable_minutes: s.billable_minutes,
        non_billable_minutes: s.non_billable_minutes,
        entry_count: s.entry_count,
      })),
      pagination: { page, limit, total },
    });
  } catch (err) {
    console.error('GET /api/time-logs error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await getAuthMember();
    const body = await request.json();
    const { workspace_id, ticket_id, ticket_key, member_id, member_name, started_at, ended_at, duration_minutes, description, is_billable, action } = body;

    if (!workspace_id || !ticket_id) {
      return NextResponse.json({ error: 'workspace_id e ticket_id são obrigatórios' }, { status: 400 });
    }

    const db = await getDb();
    const col = db.collection<TimeLogDoc>(COLLECTIONS.TIME_LOGS);

    if (action === 'start') {
      // Stop any running timers for this ticket
      await col.updateMany(
        { ticket_id, is_running: true },
        { $set: { is_running: false, ended_at: new Date(), duration_minutes: 0 } }
      );

      const doc: TimeLogDoc = {
        _id: uuid4(),
        workspace_id,
        ticket_id,
        ticket_key,
        member_id: member_id || '',
        member_name: member_name || '',
        started_at: new Date(),
        is_billable: is_billable !== false,
        is_running: true,
        duration_minutes: 0,
        created_at: new Date(),
      };
      await col.insertOne(doc);
      return NextResponse.json(doc, { status: 201 });
    }

    if (action === 'stop') {
      const running = await col.findOneAndUpdate(
        { ticket_id, is_running: true },
        {
          $set: {
            is_running: false,
            ended_at: new Date(),
            duration_minutes: Math.floor((Date.now() - new Date(started_at || Date.now()).getTime()) / 60000),
          },
        },
        { returnDocument: 'after' }
      );
      return NextResponse.json(running || { ok: true });
    }

    // Manual log
    const doc: TimeLogDoc = {
      _id: uuid4(),
      workspace_id,
      ticket_id,
      ticket_key,
      member_id: member_id || '',
      member_name: member_name || '',
      started_at: started_at ? new Date(started_at) : new Date(),
      ended_at: ended_at ? new Date(ended_at) : new Date(),
      duration_minutes: duration_minutes || 0,
      description,
      is_billable: is_billable !== false,
      is_running: false,
      created_at: new Date(),
    };
    await col.insertOne(doc);
    return NextResponse.json(doc, { status: 201 });
  } catch (err) {
    console.error('POST /api/time-logs error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await getAuthMember();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });
    }

    const db = await getDb();
    const col = db.collection<TimeLogDoc>(COLLECTIONS.TIME_LOGS);

    const result = await col.deleteOne({ _id: id, is_running: false });
    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Entrada não encontrada ou timer em execução' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/time-logs error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
