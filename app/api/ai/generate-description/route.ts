import { NextResponse } from 'next/server';
import { generateTicketDescription } from '@/lib/ai';
import { getAuthMember } from '@/lib/api-auth';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(request: Request) {
  try {
    const auth = await getAuthMember();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const rl = checkRateLimit(`ai:${auth.id}`, 20, 60000); // 20 per minute
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Muitas requisições. Aguarde.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
      );
    }

    const { title, context } = await request.json();
    if (!title) return NextResponse.json({ error: 'title obrigatório' }, { status: 400 });
    const description = await generateTicketDescription(title, context);
    return NextResponse.json({ description });
  } catch (err) {
    console.error('AI generate-description error:', err);
    return NextResponse.json({ error: 'Erro ao gerar descrição' }, { status: 500 });
  }
}
