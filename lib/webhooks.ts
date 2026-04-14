import { query } from './db';

export async function dispatchWebhook(event: string, data: Record<string, unknown>) {
  // Fetch all active subscriptions that include this event
  const result = await query(
    `SELECT url, secret FROM webhook_subscriptions WHERE is_active = true AND $1 = ANY(events)`,
    [event]
  );

  // Fire-and-forget: send to each subscriber
  for (const sub of result.rows) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (sub.secret) headers['X-Webhook-Secret'] = sub.secret;

    fetch(sub.url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ event, data, timestamp: new Date().toISOString() }),
    }).catch((err) => console.error(`Webhook dispatch failed for ${sub.url}:`, err));
  }
}
