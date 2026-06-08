export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { items, orderId } = req.body;
  if (!items) return res.status(400).json({ error: 'items required' });

  const contact = items.contact || 'unknown';
  const details = Object.entries(items)
    .filter(([k, v]) => v && k !== 'contact' && k !== 'description')
    .map(([k, v]) => `${k}: ${v}`).join('\n');
  const desc = items.description ? `\n\nDescription:\n${items.description}` : '';

  const text = `New Sourcing Request: ${orderId}\nFrom: ${contact}\n\n${details}${desc}`;

  // Forward via free email service (FormSubmit.co)
  try {
    await fetch('https://formsubmit.co/ajax/karten556@gmail.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        _subject: `New Sourcing Request: ${orderId}`,
        _captcha: 'false',
        message: text,
        name: items.product_type || 'Unknown product',
        email: contact
      })
    });
  } catch (err) {
    console.error('Email notification failed:', err.message);
  }

  res.json({ success: true });
}
