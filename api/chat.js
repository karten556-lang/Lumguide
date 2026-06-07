const COZE_API_TOKEN = 'pat_peLZUA1MPgx2K7AeLoobajYchQvhIzmtj3cKMUCqhaUelbAsqmuPSYMft6GEsvCl';
const BOT_ID = '7648681998207197207';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message, session_id } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'message is required' });
  }

  const userId = session_id || 'lum_' + Date.now().toString(36);

  const body = JSON.stringify({
    bot_id: BOT_ID,
    user_id: userId,
    stream: true,
    additional_messages: [{
      role: 'user',
      content: message,
      content_type: 'text'
    }]
  });

  try {
    const apiRes = await fetch('https://api.coze.cn/v3/chat', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + COZE_API_TOKEN,
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream'
      },
      body: body
    });

    if (!apiRes.ok) {
      const errText = await apiRes.text();
      return res.status(502).json({ error: 'API error', detail: errText.substring(0, 300) });
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const reader = apiRes.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    function pushChunk() {
      reader.read().then(({ done, value }) => {
        if (done) { res.end(); return; }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line.startsWith('data:')) {
            try {
              const parsed = JSON.parse(line.substring(5).trim());
              if (parsed.event === 'conversation.message.delta' || 
                  parsed.event === 'conversation.message.completed') {
                const content = parsed.data?.content || parsed.data?.msg?.content || '';
                if (content) {
                  res.write(line + '\n\n');
                }
              }
            } catch(e) {}
          }
        }
        pushChunk();
      }).catch(() => { res.end(); });
    }
    pushChunk();
  } catch (err) {
    res.status(502).json({ error: 'Failed: ' + err.message });
  }
}
