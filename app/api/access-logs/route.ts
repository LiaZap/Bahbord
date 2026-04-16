import { NextResponse } from 'next/server';
import { v4 as uuid4 } from 'uuid';
import { getDb, COLLECTIONS } from '@/lib/mongodb';
import type { AccessLogDoc } from '@/lib/mongo-schemas';
import { getAuthMember } from '@/lib/api-auth';

export async function GET(request: Request) {
  try {
    await getAuthMember();
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspace_id');
    const memberId = searchParams.get('member_id');
    const action = searchParams.get('action');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
    const page = Math.max(parseInt(searchParams.get('page') || '1'), 1);

    const db = await getDb();
    const col = db.collection<AccessLogDoc>(COLLECTIONS.ACCESS_LOGS);

    const filter: Record<string, unknown> = {};
    if (workspaceId) filter.workspace_id = workspaceId;
    if (memberId) filter.member_id = memberId;
    if (action) filter.action = action;

    const [docs, total] = await Promise.all([
      col.find(filter)
        .sort({ created_at: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
      col.countDocuments(filter),
    ]);

    return NextResponse.json({ data: docs, pagination: { page, limit, total } });
  } catch (err) {
    console.error('GET /api/access-logs error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await getAuthMember();
    const body = await request.json();
    const { workspace_id, member_id, member_name, action, resource, ip_address, user_agent, metadata } = body;

    if (!workspace_id || !action) {
      return NextResponse.json({ error: 'workspace_id e action são obrigatórios' }, { status: 400 });
    }

    const db = await getDb();
    const col = db.collection<AccessLogDoc>(COLLECTIONS.ACCESS_LOGS);

    const doc: AccessLogDoc = {
      _id: uuid4(),
      workspace_id,
      member_id: member_id || '',
      member_name: member_name || 'Anônimo',
      action,
      resource: resource || '',
      ip_address,
      user_agent,
      metadata,
      created_at: new Date(),
    };

    await col.insertOne(doc);
    return NextResponse.json(doc, { status: 201 });
  } catch (err) {
    console.error('POST /api/access-logs error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
