export async function sendWhatsApp(phone: string, message: string) {
  const apiUrl = process.env.WHATSAPP_API_URL;
  const apiToken = process.env.WHATSAPP_API_TOKEN;

  if (!apiUrl || !apiToken) {
    console.warn('WhatsApp API not configured');
    return;
  }

  try {
    await fetch(`${apiUrl}/send-message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiToken}`,
      },
      body: JSON.stringify({ phone, message }),
    });
  } catch (err) {
    console.error('WhatsApp send failed:', err);
  }
}
