import { NextResponse } from 'next/server';
import { query, getDefaultWorkspaceId, getDefaultMemberId } from '@/lib/db';

// Webhook endpoint para integrações externas (n8n, Zapier, etc.)
// Recebe eventos e pode disparar ações no BahBoard

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  const webhookSecret = process.env.WEBHOOK_SECRET;

  // Validar secret (obrigatório)
  if (!webhookSecret) {
    return NextResponse.json({ error: 'Webhook não configurado' }, { status: 503 });
  }
  if (authHeader !== `Bearer ${webhookSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { event, data } = body;

  if (!event) {
    return NextResponse.json({ error: 'event é obrigatório' }, { status: 400 });
  }

  try {
    switch (event) {
      case 'ticket.create': {
        const { title, service_id, priority, status_id, ticket_type_id } = data;
        if (!title) return NextResponse.json({ error: 'title é obrigatório' }, { status: 400 });

        const wsId = await getDefaultWorkspaceId();
        const result = await query(
          `INSERT INTO tickets (workspace_id, title, service_id, priority, status_id, ticket_type_id, created_at, updated_at)
           VALUES ($1, $2, $3, $4,
             COALESCE($5, (SELECT id FROM statuses ORDER BY position ASC LIMIT 1)),
             COALESCE($6, (SELECT id FROM ticket_types ORDER BY position ASC LIMIT 1)),
             NOW(), NOW())
           RETURNING id, title`,
          [wsId, title, service_id || null, priority || 'medium', status_id || null, ticket_type_id || null]
        );
        return NextResponse.json({ ok: true, ticket: result.rows[0] }, { status: 201 });
      }

      case 'ticket.update': {
        const { ticket_id, ...fields } = data;
        if (!ticket_id) return NextResponse.json({ error: 'ticket_id é obrigatório' }, { status: 400 });

        const allowedFields = ['title', 'priority', 'status_id', 'assignee_id', 'service_id', 'description'];
        const sets: string[] = [];
        const values: unknown[] = [];
        let idx = 1;

        for (const [key, val] of Object.entries(fields)) {
          if (allowedFields.includes(key)) {
            sets.push(`${key} = $${idx}`);
            values.push(val);
            idx++;
          }
        }

        if (sets.length === 0) return NextResponse.json({ error: 'Nenhum campo válido' }, { status: 400 });

        sets.push(`updated_at = NOW()`);
        values.push(ticket_id);

        await query(`UPDATE tickets SET ${sets.join(', ')} WHERE id = $${idx}`, values);
        return NextResponse.json({ ok: true });
      }

      case 'ticket.comment': {
        const { ticket_id, content } = data;
        if (!ticket_id || !content) return NextResponse.json({ error: 'ticket_id e content obrigatórios' }, { status: 400 });

        const memberId = await getDefaultMemberId();

        await query(
          `INSERT INTO comments (ticket_id, author_id, body) VALUES ($1, $2, $3)`,
          [ticket_id, memberId, content]
        );
        return NextResponse.json({ ok: true }, { status: 201 });
      }

      case 'notification.create': {
        const { recipient_id, title, message, ticket_id, type } = data;
        if (!title) return NextResponse.json({ error: 'title obrigatório' }, { status: 400 });

        const workspaceId = await getDefaultWorkspaceId();

        await query(
          `INSERT INTO notifications (workspace_id, recipient_id, title, message, ticket_id, type, is_read)
           VALUES ($1, $2, $3, $4, $5, $6, false)`,
          [workspaceId, recipient_id || null, title, message || null, ticket_id || null, type || 'webhook']
        );
        return NextResponse.json({ ok: true }, { status: 201 });
      }

      default:
        return NextResponse.json({ error: `Evento desconhecido: ${event}` }, { status: 400 });
    }
  } catch (err) {
    console.error('Webhook error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET - lista eventos suportados (documentação)
export async function GET() {
  return NextResponse.json({
    events: [
      {
        name: 'ticket.create',
        description: 'Criar um novo ticket',
        fields: { title: 'required', service_id: 'optional', priority: 'optional', status_id: 'optional', ticket_type_id: 'optional' }
      },
      {
        name: 'ticket.update',
        description: 'Atualizar um ticket existente',
        fields: { ticket_id: 'required', title: 'optional', priority: 'optional', status_id: 'optional', assignee_id: 'optional' }
      },
      {
        name: 'ticket.comment',
        description: 'Adicionar comentário a um ticket',
        fields: { ticket_id: 'required', content: 'required' }
      },
      {
        name: 'notification.create',
        description: 'Criar uma notificação',
        fields: { title: 'required', message: 'optional', ticket_id: 'optional', recipient_id: 'optional', type: 'optional' }
      }
    ],
    auth: 'Bearer token via Authorization header (WEBHOOK_SECRET env var)',
    example: {
      event: 'ticket.create',
      data: { title: 'Novo ticket via webhook', priority: 'high' }
    }
  });
}
