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
      `INSERT INTO notifications (member_id, ticket_id, type, message)
       VALUES ($1, $2, $3, $4)`,
      [memberId, data.ticketId || null, event, data.message]
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
