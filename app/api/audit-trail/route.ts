import { NextResponse } from 'next/server';
import { v4 as uuid4 } from 'uuid';
import { getDb, COLLECTIONS } from '@/lib/mongodb';
import type { AuditTrailDoc } from '@/lib/mongo-schemas';
import { getAuthMember } from '@/lib/api-auth';

export async function GET(request: Request) {
  try {
    await getAuthMember();
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id');
    const workspaceId = searchParams.get('workspace_id');
    const entityType = searchParams.get('entity_type');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
    const page = Math.max(parseInt(searchParams.get('page') || '1'), 1);

    const db = await getDb();
    const col = db.collection<AuditTrailDoc>(COLLECTIONS.AUDIT_TRAIL);

    const filter: Record<string, unknown> = {};
    if (projectId) filter.project_id = projectId;
    if (workspaceId) filter.workspace_id = workspaceId;
    if (entityType) filter.entity_type = entityType;

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
    console.error('GET /api/audit-trail error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await getAuthMember();
    const body = await request.json();
    const { workspace_id, project_id, member_id, member_name, entity_type, entity_id, entity_name, action, changes, commit_hash } = body;

    if (!workspace_id || !entity_type || !action) {
      return NextResponse.json({ error: 'workspace_id, entity_type e action são obrigatórios' }, { status: 400 });
    }

    const db = await getDb();
    const col = db.collection<AuditTrailDoc>(COLLECTIONS.AUDIT_TRAIL);

    const doc: AuditTrailDoc = {
      _id: uuid4(),
      workspace_id,
      project_id: project_id || undefined,
      member_id: member_id || '',
      member_name: member_name || 'Sistema',
      entity_type,
      entity_id: entity_id || '',
      entity_name,
      action,
      changes,
      commit_hash,
      created_at: new Date(),
    };

    await col.insertOne(doc);
    return NextResponse.json(doc, { status: 201 });
  } catch (err) {
    console.error('POST /api/audit-trail error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
