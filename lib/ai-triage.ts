import OpenAI from 'openai';
import { query } from './db';
import { findSimilarTickets } from './embeddings';

const MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
const TIMEOUT_MS = 10_000;
const MAX_MEMBERS_IN_PROMPT = 30;
const MAX_INPUT_CHARS = 8_000;
const DUPLICATE_MIN_SCORE = 0.85;

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

// ===== Tipos públicos =====

export interface InboxItem {
  id: string;
  workspace_id: string;
  title: string;
  description?: string | null;
  source: string;
  reporter_email?: string | null;
}

export interface TriageContext {
  projects: Array<{ id: string; name: string; prefix: string }>;
  available_labels: Array<{ id: string; name: string }>;
  members: Array<{ id: string; display_name: string; role?: string }>;
}

export type TriagePriority = 'urgent' | 'high' | 'medium' | 'low';
export type TriageConfidence = 'high' | 'medium' | 'low';

export interface TriageSuggestion {
  priority: TriagePriority;
  suggested_project_id: string | null;
  suggested_labels: string[];
  suggested_assignee_id: string | null;
  duplicate_ticket_id: string | null;
  duplicate_score: number | null;
  summary: string;
  reasoning: string;
  confidence: TriageConfidence;
}

// ===== Helpers internos =====

const VALID_PRIORITIES: TriagePriority[] = ['urgent', 'high', 'medium', 'low'];
const VALID_CONFIDENCE: TriageConfidence[] = ['high', 'medium', 'low'];

function isAvailable(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

function truncate(value: string, max: number): string {
  if (!value) return '';
  return value.length > max ? value.slice(0, max) : value;
}

function fallbackSuggestion(reasoning: string): TriageSuggestion {
  return {
    priority: 'medium',
    suggested_project_id: null,
    suggested_labels: [],
    suggested_assignee_id: null,
    duplicate_ticket_id: null,
    duplicate_score: null,
    summary: '',
    reasoning,
    confidence: 'low',
  };
}

function buildPrompt(item: InboxItem, ctx: TriageContext): string {
  const description = item.description ? truncate(item.description, 4_000) : 'sem descrição';
  const reporter = item.reporter_email || 'desconhecido';

  const projectsBlock = ctx.projects.length > 0
    ? ctx.projects.map((p) => `${p.id} | ${p.name} | ${p.prefix}`).join('\n')
    : '(nenhum projeto disponível)';

  const membersList = ctx.members.length > MAX_MEMBERS_IN_PROMPT
    ? ctx.members.slice(0, 10)
    : ctx.members;
  const membersBlock = membersList.length > 0
    ? membersList.map((m) => `${m.id} | ${m.display_name} | ${m.role || ''}`).join('\n')
    : '(nenhum membro listado)';

  const labelsBlock = ctx.available_labels.length > 0
    ? ctx.available_labels.slice(0, 50).map((l) => l.name).join(', ')
    : '(use labels genéricos: bug, feature, docs, infra, ux)';

  return `Você é um assistente de triagem de tickets de suporte/dev.
Analise o item abaixo e classifique. Retorne APENAS JSON válido.

Item recebido:
- Origem: ${item.source}
- Título: ${truncate(item.title || '', 500)}
- Descrição: ${description}
- Reporter: ${reporter}

Projetos disponíveis (id | nome | prefixo):
${projectsBlock}

Membros disponíveis (id | nome | role):
${membersBlock}

Labels conhecidos no workspace:
${labelsBlock}

Instruções:
- priority: 'urgent' (perda de receita/produção parada), 'high' (impede trabalho), 'medium' (incomoda), 'low' (cosmético)
- suggested_project_id: melhor projeto pelo conteúdo (use exatamente o UUID listado, ou null se incerto)
- suggested_labels: até 3 labels curtos relevantes (ex: 'bug', 'feature', 'docs')
- suggested_assignee_id: pessoa mais provável (UUID listado ou null)
- summary: resumo em 1-2 frases (pt-BR)
- reasoning: explicação curta em 1 linha (pt-BR)
- confidence: 'high' se sinal claro, 'medium' moderado, 'low' chute

Retorne JSON com este schema exato:
{"priority":"urgent|high|medium|low","suggested_project_id":"<uuid|null>","suggested_labels":["..."],"suggested_assignee_id":"<uuid|null>","summary":"...","reasoning":"...","confidence":"high|medium|low"}`;
}

function normalizeUuid(value: unknown, allowedIds: Set<string>): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === 'null') return null;
  return allowedIds.has(trimmed) ? trimmed : null;
}

function normalizeLabels(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const raw of value) {
    if (typeof raw !== 'string') continue;
    const cleaned = raw.trim().toLowerCase().slice(0, 40);
    if (cleaned && !out.includes(cleaned)) out.push(cleaned);
    if (out.length >= 3) break;
  }
  return out;
}

interface RawAiResponse {
  priority?: unknown;
  suggested_project_id?: unknown;
  suggested_labels?: unknown;
  suggested_assignee_id?: unknown;
  summary?: unknown;
  reasoning?: unknown;
  confidence?: unknown;
}

function parseAndValidate(raw: string, ctx: TriageContext): TriageSuggestion {
  let parsed: RawAiResponse;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Resposta do modelo não é JSON válido');
  }

  const projectIds = new Set(ctx.projects.map((p) => p.id));
  const memberIds = new Set(ctx.members.map((m) => m.id));

  const priority = VALID_PRIORITIES.includes(parsed.priority as TriagePriority)
    ? (parsed.priority as TriagePriority)
    : 'medium';
  const confidence = VALID_CONFIDENCE.includes(parsed.confidence as TriageConfidence)
    ? (parsed.confidence as TriageConfidence)
    : 'low';

  const summary = typeof parsed.summary === 'string' ? truncate(parsed.summary.trim(), 500) : '';
  const reasoning = typeof parsed.reasoning === 'string' ? truncate(parsed.reasoning.trim(), 400) : '';

  return {
    priority,
    suggested_project_id: normalizeUuid(parsed.suggested_project_id, projectIds),
    suggested_labels: normalizeLabels(parsed.suggested_labels),
    suggested_assignee_id: normalizeUuid(parsed.suggested_assignee_id, memberIds),
    duplicate_ticket_id: null,
    duplicate_score: null,
    summary,
    reasoning,
    confidence,
  };
}

async function callOpenAi(prompt: string): Promise<string> {
  const completion = await client.chat.completions.create(
    {
      model: MODEL,
      max_tokens: 600,
      response_format: { type: 'json_object' as const },
      messages: [{ role: 'user', content: prompt }],
    },
    { signal: AbortSignal.timeout(TIMEOUT_MS) }
  );
  return completion.choices[0]?.message?.content || '';
}

async function attachDuplicateMatch(
  item: InboxItem,
  suggestion: TriageSuggestion
): Promise<TriageSuggestion> {
  if (!suggestion.suggested_project_id) return suggestion;

  const text = truncate(`${item.title || ''} ${item.description || ''}`.trim(), MAX_INPUT_CHARS);
  if (!text) return suggestion;

  try {
    const matches = await findSimilarTickets(text, suggestion.suggested_project_id, {
      limit: 1,
      minScore: DUPLICATE_MIN_SCORE,
    });
    if (matches.length > 0) {
      const top = matches[0];
      return {
        ...suggestion,
        duplicate_ticket_id: top.ticket_id,
        duplicate_score: Number(top.score.toFixed(4)),
      };
    }
  } catch (err) {
    console.error('[ai-triage] similarity lookup falhou:', err);
  }
  return suggestion;
}

// ===== API pública =====

/**
 * Classifica um item da inbox de triagem usando IA.
 * Sempre retorna uma sugestão (fallback seguro em caso de erro/timeout).
 */
export async function classifyInboxItem(
  item: InboxItem,
  ctx: TriageContext
): Promise<TriageSuggestion> {
  if (!isAvailable()) {
    return fallbackSuggestion('IA indisponível');
  }

  const safeCtx: TriageContext = {
    projects: ctx.projects ?? [],
    available_labels: ctx.available_labels ?? [],
    members: ctx.members ?? [],
  };

  if (safeCtx.projects.length === 0) {
    // Mesmo sem projetos, vale tentar classificar prioridade/summary
    // mas marcamos confidence baixo e suggested_project_id null
  }

  let raw: string;
  try {
    raw = await callOpenAi(buildPrompt(item, safeCtx));
  } catch (err) {
    console.error('[ai-triage] chamada OpenAI falhou:', err);
    return fallbackSuggestion('IA indisponível');
  }

  let suggestion: TriageSuggestion;
  try {
    suggestion = parseAndValidate(raw, safeCtx);
  } catch (err) {
    console.error('[ai-triage] parse JSON falhou:', err);
    return fallbackSuggestion('IA indisponível');
  }

  if (safeCtx.projects.length === 0) {
    suggestion.suggested_project_id = null;
    suggestion.confidence = 'low';
  }

  return attachDuplicateMatch(item, suggestion);
}

interface ProjectRow {
  id: string;
  name: string;
  prefix: string;
}
interface MemberRow {
  id: string;
  display_name: string;
  role: string | null;
}
interface CategoryRow {
  id: string;
  name: string;
}

async function loadContext(workspaceId: string): Promise<TriageContext> {
  const [projectsRes, membersRes, labelsRes] = await Promise.all([
    query<ProjectRow>(
      `SELECT id, name, prefix
         FROM projects
        WHERE workspace_id = $1 AND is_archived = false
        ORDER BY name
        LIMIT 200`,
      [workspaceId]
    ),
    query<MemberRow>(
      `SELECT id, display_name, role
         FROM members
        WHERE workspace_id = $1
        ORDER BY display_name
        LIMIT 100`,
      [workspaceId]
    ),
    query<CategoryRow>(
      `SELECT id, name
         FROM categories
        WHERE workspace_id = $1
        ORDER BY name
        LIMIT 100`,
      [workspaceId]
    ),
  ]);

  return {
    projects: projectsRes.rows,
    members: membersRes.rows.map((m) => ({
      id: m.id,
      display_name: m.display_name,
      role: m.role || undefined,
    })),
    available_labels: labelsRes.rows,
  };
}

/**
 * Helper fire-and-forget: carrega contexto, classifica e salva em triage_inbox.ai_suggestion.
 * Pensado pra ser chamado sem await pelo backend após inserir o item.
 * Erros são logados mas não relançados.
 */
export async function classifyAndSave(
  itemId: string,
  workspaceId: string,
  item: InboxItem
): Promise<void> {
  try {
    const ctx = await loadContext(workspaceId);
    const suggestion = await classifyInboxItem(item, ctx);
    await query(
      `UPDATE triage_inbox SET ai_suggestion = $1::jsonb WHERE id = $2`,
      [JSON.stringify(suggestion), itemId]
    );
  } catch (err) {
    console.error('[ai-triage] classifyAndSave falhou:', err);
  }
}
