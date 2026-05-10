import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getAuthMember, isAdmin } from '@/lib/api-auth';
import {
  QUERY_CATALOG,
  getCatalogForLLM,
  findCatalogEntry,
} from '@/lib/ai-query-catalog';
import { logAudit, extractRequestMeta } from '@/lib/audit';
import { checkRateLimit } from '@/lib/rate-limit';

const MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';

/**
 * POST /api/ai/chat — assistente conversacional do admin sobre os dados do
 * workspace.
 *
 * SEGURANÇA (Fase 7.1):
 *   A versão antiga aceitava SQL gerado pelo LLM e tentava sanitizar via
 *   regex (SELECT-only + allowlist de tabelas). Esse approach é
 *   fundamentalmente quebrado:
 *     - CTEs com UPDATE: `WITH x AS (UPDATE ...) SELECT * FROM x`
 *     - Comentários: `/* UPDATE * / SELECT ...`
 *     - Funções privilegiadas: `pg_read_server_files()`, `pg_sleep()` (timing oracle)
 *     - Ataques de side-channel via `pg_stat_*`, `current_setting('...')`
 *
 *   A nova abordagem usa **function calling com query catalog**: o LLM só
 *   pode invocar funções pré-aprovadas de QUERY_CATALOG, cujo SQL é fixo,
 *   parametrizado e SEMPRE escopado por workspace_id (vindo do auth, NUNCA
 *   dos params do LLM). Não há SQL livre em nenhum caminho.
 */
export async function POST(request: Request) {
  try {
    const auth = await getAuthMember();
    if (!auth) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }
    if (!isAdmin(auth.role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    // Rate limit por usuário (defesa contra abuso de tokens OpenAI)
    const rl = checkRateLimit(`ai-chat:${auth.id}`, 30, 60_000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Muitas requisições. Aguarde.' },
        { status: 429 },
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'IA não configurada' }, { status: 503 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      question?: unknown;
      message?: unknown;
    };
    // Aceita "question" (novo) ou "message" (compat com UI antigo)
    const raw = body.question ?? body.message;
    if (typeof raw !== 'string' || raw.trim().length === 0) {
      return NextResponse.json(
        { error: 'question obrigatório' },
        { status: 400 },
      );
    }
    const question = raw.trim().slice(0, 2000);

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const tools = getCatalogForLLM().map((t) => ({
      type: 'function' as const,
      function: t,
    }));

    const completion = await client.chat.completions.create({
      model: MODEL,
      max_tokens: 1024,
      messages: [
        {
          role: 'system',
          content:
            'Você é um assistente do Bah!Flow que responde perguntas do admin sobre os dados do workspace usando APENAS as funções disponíveis. NUNCA escreva SQL nem invente nomes de função. Se a pergunta não for respondível com nenhuma função, diga isso explicitamente em português. Use list_members / list_projects pra descobrir UUIDs antes de chamar funções que pedem ID.',
        },
        { role: 'user', content: question },
      ],
      tools,
      tool_choice: 'auto',
    });

    const msg = completion.choices[0]?.message;
    const toolCalls = msg?.tool_calls ?? [];

    // Executa cada tool call. Função desconhecida ou args inválidos viram
    // erro estruturado (não derrubam o request).
    const results: Array<{
      name: string;
      args?: Record<string, unknown>;
      result?: { columns: string[]; rows: unknown[][] };
      error?: string;
    }> = [];

    for (const tc of toolCalls) {
      if (tc.type !== 'function') continue;
      const fnName = tc.function.name;
      const def = findCatalogEntry(fnName);
      if (!def) {
        results.push({ name: fnName, error: 'Função desconhecida' });
        continue;
      }

      let parsedArgs: Record<string, unknown> = {};
      try {
        parsedArgs = tc.function.arguments
          ? (JSON.parse(tc.function.arguments) as Record<string, unknown>)
          : {};
      } catch {
        results.push({ name: fnName, error: 'Argumentos inválidos (JSON malformado)' });
        continue;
      }

      try {
        const out = await def.execute(parsedArgs, auth.workspace_id);
        results.push({ name: fnName, args: parsedArgs, result: out });
      } catch (err) {
        // NUNCA vaza err.message pro cliente (pode conter detalhes de schema/conn)
        console.error(`[ai-chat] erro executando ${fnName}:`, err);
        results.push({
          name: fnName,
          args: parsedArgs,
          error: 'Erro ao executar função',
        });
      }
    }

    // Audit log: registra a pergunta + funções chamadas (sem rows pra não inflar).
    // Fire-and-forget — auditoria não pode quebrar o request.
    const meta = extractRequestMeta(request);
    void logAudit({
      workspaceId: auth.workspace_id,
      actorId: auth.id,
      action: 'ai_chat.query',
      entityType: 'ai_chat',
      entityId: null,
      changes: {
        question,
        functions_called: results.map((r) => ({
          name: r.name,
          ok: !r.error,
          error: r.error,
        })),
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return NextResponse.json({
      text: msg?.content ?? '',
      function_results: results,
      catalog_size: QUERY_CATALOG.length,
    });
  } catch (err) {
    console.error('POST /api/ai/chat error:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
