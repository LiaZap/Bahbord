import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import crypto from 'crypto';

// GitHub webhook endpoint.
// Configure in GitHub repo → Settings → Webhooks:
//   Payload URL: https://your-domain.com/api/webhooks/github
//   Content type: application/json
//   Secret: value of GITHUB_WEBHOOK_SECRET
//   Events: Pull requests, Pushes (at minimum).

function verifySignature(payload: string, signature: string | null): boolean {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected =
    'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex');
  const expectedBuf = Buffer.from(expected);
  const signatureBuf = Buffer.from(signature);
  if (expectedBuf.length !== signatureBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, signatureBuf);
}

function extractKeys(text: string): string[] {
  if (!text) return [];
  const matches = text.matchAll(/\b([A-Z]{2,10}-\d+)\b/g);
  return Array.from(new Set(Array.from(matches).map((m) => m[1])));
}

async function findTicketByKey(key: string): Promise<string | null> {
  const [prefix, numStr] = key.split('-');
  const num = parseInt(numStr, 10);
  if (!prefix || Number.isNaN(num)) return null;
  const res = await query<{ id: string }>(
    `SELECT t.id FROM tickets t
     JOIN workspaces w ON w.id = t.workspace_id
     WHERE w.prefix = $1 AND t.sequence_number = $2 LIMIT 1`,
    [prefix, num]
  );
  return res.rows[0]?.id || null;
}

export async function POST(request: Request) {
  try {
    const payload = await request.text();
    const signature = request.headers.get('x-hub-signature-256');

    if (process.env.GITHUB_WEBHOOK_SECRET && !verifySignature(payload, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const event = request.headers.get('x-github-event');
    const data = JSON.parse(payload);

    if (event === 'pull_request') {
      const pr = data.pull_request;
      if (!pr) return NextResponse.json({ ok: true });

      const keys = [
        ...extractKeys(pr.title || ''),
        ...extractKeys(pr.body || ''),
        ...extractKeys(pr.head?.ref || ''),
      ];
      const uniqueKeys = Array.from(new Set(keys));
      const state = pr.merged ? 'merged' : pr.state;

      for (const key of uniqueKeys) {
        const ticketId = await findTicketByKey(key);
        if (!ticketId) continue;
        await query(
          `INSERT INTO github_links (ticket_id, type, url, title, state, number, author)
           VALUES ($1, 'pr', $2, $3, $4, $5, $6)
           ON CONFLICT (ticket_id, url) DO UPDATE
             SET state = EXCLUDED.state,
                 title = EXCLUDED.title,
                 number = EXCLUDED.number,
                 author = EXCLUDED.author`,
          [ticketId, pr.html_url, pr.title, state, pr.number, pr.user?.login]
        );
      }
    }

    if (event === 'push') {
      for (const commit of data.commits || []) {
        const keys = extractKeys(commit.message || '');
        for (const key of keys) {
          const ticketId = await findTicketByKey(key);
          if (!ticketId) continue;
          await query(
            `INSERT INTO github_links (ticket_id, type, url, title, author)
             VALUES ($1, 'commit', $2, $3, $4)
             ON CONFLICT (ticket_id, url) DO NOTHING`,
            [
              ticketId,
              commit.url,
              (commit.message || '').split('\n')[0],
              commit.author?.name,
            ]
          );
        }
      }
    }

    if (event === 'issues') {
      const issue = data.issue;
      if (issue) {
        const keys = [
          ...extractKeys(issue.title || ''),
          ...extractKeys(issue.body || ''),
        ];
        const uniqueKeys = Array.from(new Set(keys));
        for (const key of uniqueKeys) {
          const ticketId = await findTicketByKey(key);
          if (!ticketId) continue;
          await query(
            `INSERT INTO github_links (ticket_id, type, url, title, state, number, author)
             VALUES ($1, 'issue', $2, $3, $4, $5, $6)
             ON CONFLICT (ticket_id, url) DO UPDATE
               SET state = EXCLUDED.state,
                   title = EXCLUDED.title`,
            [
              ticketId,
              issue.html_url,
              issue.title,
              issue.state,
              issue.number,
              issue.user?.login,
            ]
          );
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('GitHub webhook error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
