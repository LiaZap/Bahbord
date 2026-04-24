import { query } from '@/lib/db';
import { sendWhatsApp } from '@/lib/whatsapp';

interface NotifyData {
  title: string;
  message: string;
  ticketId?: string;
}

/**
 * Notify a member about an event.
 * - Always creates an in-app notification.
 * - If WhatsApp is enabled for this event, sends via WhatsApp (fire-and-forget).
 */
export function notifyMember(memberId: string, event: string, data: NotifyData) {
  // Fire-and-forget: run async but don't block the caller
  _doNotify(memberId, event, data).catch((err) =>
    console.error('notifyMember error:', err)
  );
}

async function _doNotify(memberId: string, event: string, data: NotifyData) {
  // 1. Always create in-app notification
  try {
    await query(
      `INSERT INTO notifications (member_id, recipient_id, ticket_id, type, title, message)
       VALUES ($1, $1, $2, $3, $4, $5)`,
      [memberId, data.ticketId || null, event, data.title, data.message]
    );
  } catch (err) {
    console.error('Failed to create in-app notification:', err);
  }

  // 2. Check WhatsApp preference
  try {
    const prefResult = await query(
      `SELECT is_enabled FROM notification_preferences
       WHERE member_id = $1 AND channel = 'whatsapp' AND event = $2`,
      [memberId, event]
    );

    const whatsappEnabled = prefResult.rows[0]?.is_enabled === true;

    if (whatsappEnabled) {
      // Get member phone
      const memberResult = await query(
        `SELECT phone FROM members WHERE id = $1`,
        [memberId]
      );

      const phone = memberResult.rows[0]?.phone;
      if (phone) {
        const whatsappMessage = `*${data.title}*\n${data.message}`;
        // Fire-and-forget WhatsApp send
        sendWhatsApp(phone, whatsappMessage).catch((err) =>
          console.error('WhatsApp send error:', err)
        );
      }
    }
  } catch (err) {
    console.error('Failed to check WhatsApp preferences:', err);
  }
}

/**
 * Cria uma notificação in-app diretamente (API rica com entidade, link e actor).
 * Usada para eventos estruturados como 'mention', 'assigned', 'comment', 'approval'.
 *
 * - Não notifica o próprio ator (actor_id === recipient_id é ignorado).
 * - Popula member_id legado com o recipient_id para compatibilidade retroativa.
 * - Silencioso em caso de erro (não bloqueia o fluxo principal).
 */
export async function createNotification({
  workspace_id,
  recipient_id,
  actor_id,
  type,
  entity_type,
  entity_id,
  title,
  message,
  link,
}: {
  workspace_id: string;
  recipient_id: string;
  actor_id?: string;
  type: string;
  entity_type?: string;
  entity_id?: string;
  title: string;
  message?: string;
  link?: string;
}) {
  // Não notifica a si mesmo
  if (actor_id && actor_id === recipient_id) return;
  if (!recipient_id) return;

  try {
    // Derivar ticket_id para compatibilidade com views/JOINs e UI existente.
    // - Se entity_type === 'ticket' e entity_id é UUID de ticket, usa diretamente.
    // - Caso contrário, tenta extrair do link no formato /ticket/<uuid>.
    let ticketId: string | null = null;
    if (entity_type === 'ticket' && entity_id) {
      ticketId = entity_id;
    } else if (link) {
      const m = link.match(/\/ticket\/([0-9a-f-]{36})/i);
      if (m) ticketId = m[1];
    }

    await query(
      `INSERT INTO notifications (
        workspace_id, recipient_id, member_id, actor_id,
        type, entity_type, entity_id, ticket_id,
        title, message, link
      ) VALUES ($1, $2, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        workspace_id,
        recipient_id,
        actor_id || null,
        type,
        entity_type || null,
        entity_id || null,
        ticketId,
        title,
        message || null,
        link || null,
      ]
    );
  } catch (err) {
    console.error('createNotification error:', err);
  }
}

/**
 * Extrai @menções de um texto de comentário.
 *
 * Aceita:
 *  - @Nome (uma palavra): "Oi @João, veja isto"
 *  - @Nome Sobrenome (duas palavras, entre colchetes ou delimitador explícito):
 *    "olha aqui @João Silva" (pega apenas "João" por ambiguidade) ou
 *    "olha aqui @[João Silva]" (pega "João Silva").
 *
 * Retorna os nomes extraídos (sem o @), em ordem de aparição.
 */
export function extractMentions(text: string): string[] {
  if (!text) return [];
  const mentions = new Set<string>();

  // Formato explícito: @[Nome Completo]
  const bracketRe = /@\[([^\]]+?)\]/g;
  for (const m of text.matchAll(bracketRe)) {
    const name = m[1]?.trim();
    if (name) mentions.add(name);
  }

  // Formato simples: @palavra (aceita letras acentuadas, dígitos, _ e -)
  const simpleRe = /@([A-Za-zÀ-ÿ0-9_-]+)/g;
  for (const m of text.matchAll(simpleRe)) {
    const name = m[1]?.trim();
    if (name) mentions.add(name);
  }

  return Array.from(mentions);
}
