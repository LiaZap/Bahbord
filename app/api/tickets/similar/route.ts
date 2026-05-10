import { NextResponse } from 'next/server';
import { getAuthMember } from '@/lib/api-auth';
import { hasProjectAccess } from '@/lib/access-check';
import { findSimilarTickets, isEmbeddingAvailable } from '@/lib/embeddings';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MIN_INTERVAL_MS = 400;

// Rate limit por usuário (mín 400ms entre chamadas) — in-memory, single-instance.
const lastCallByUser = new Map<string, number>();

interface SimilarBody {
  title?: unknown;
  description?: unknown;
  project_id?: unknown;
}

export async function POST(request: Request) {
  try {
    const auth = await getAuthMember();
    if (!auth) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    let raw: SimilarBody;
    try {
      raw = (await request.json()) as SimilarBody;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const title = typeof raw.title === 'string' ? raw.title.trim() : '';
    const description =
      typeof raw.description === 'string' ? raw.description.trim() : '';
    const projectId = typeof raw.project_id === 'string' ? raw.project_id : '';

    if (title.length < 3) {
      return NextResponse.json(
        { error: 'title deve ter ao menos 3 caracteres' },
        { status: 400 }
      );
    }
    if (!UUID_RE.test(projectId)) {
      return NextResponse.json(
        { error: 'project_id inválido' },
        { status: 400 }
      );
    }

    // Rate limit: mín 400ms entre chamadas do mesmo usuário
    const now = Date.now();
    const last = lastCallByUser.get(auth.id) ?? 0;
    if (now - last < MIN_INTERVAL_MS) {
      return NextResponse.json(
        { matches: [], reason: 'rate_limited' },
        { status: 429 }
      );
    }
    lastCallByUser.set(auth.id, now);

    // Permissão de projeto
    const allowed = await hasProjectAccess(auth, projectId);
    if (!allowed) {
      return NextResponse.json({ error: 'Sem acesso ao projeto' }, { status: 403 });
    }

    // Sem chave da OpenAI — devolve resposta degradada em vez de 500
    if (!isEmbeddingAvailable()) {
      return NextResponse.json({ matches: [], reason: 'embedding_unavailable' });
    }

    const inputText = description ? `${title} ${description}` : title;

    try {
      const matches = await findSimilarTickets(inputText, projectId, {
        limit: 5,
        minScore: 0.75,
      });
      return NextResponse.json({ matches });
    } catch (err) {
      console.error('POST /api/tickets/similar embedding error:', err);
      return NextResponse.json({ matches: [], reason: 'embedding_error' });
    }
  } catch (err) {
    console.error('POST /api/tickets/similar error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
