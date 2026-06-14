const COZE_API_TOKEN = process.env.COZE_API_TOKEN;
const BOT_ID = '7648595128042389547';

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
  if (!message) return res.status(400).json({ error: 'message required' });

  if (!COZE_API_TOKEN) {
    return res.status(500).json({ error: 'COZE_API_TOKEN not configured' });
  }

  try {
    const apiRes = await fetch('https://api.coze.cn/v3/chat', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + COZE_API_TOKEN,
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream'
      },
      body: JSON.stringify({
        bot_id: BOT_ID,
        user_id: session_id || 'lum_' + Date.now().toString(36),
        query: message,
        stream: true,
        auto_save: true,
        additional_messages: [],
        conversation_id: session_id || null
      })
    });

    if (!apiRes.ok) {
      const errText = await apiRes.text();
      console.error('Coze API error:', apiRes.status, errText.substring(0, 500));
      return res.status(502).json({ error: 'AI service error (' + apiRes.status + ')' });
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });

    const reader = apiRes.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    function processStream() {
      reader.read().then(({ done, value }) => {
        if (done) {
          if (buffer.trim()) processBuffer(buffer);
          res.end();
          return;
        }
        buffer += decoder.decode(value, { stream: true });
        processBuffer(buffer);
        processStream();
      }).catch((err) => {
        console.error('Stream error:', err);
        res.end();
      });
    }

    function processBuffer(buf) {
      var idx = buf.lastIndexOf('\n');
      if (idx === -1) return;
      var complete = buf.substring(0, idx).trim();
      buffer = buf.substring(idx);
      var lines = complete.split('\n');
      for (var i = 0; i < lines.length; i++) {
        var ln = lines[i].trim();
        if (ln.startsWith('event:')) continue;
        if (ln.startsWith('id:')) continue;
        if (ln.startsWith(':')) continue;
        if (!ln.length) continue;

        if (ln.startsWith('data:')) {
          var jsonPart = ln.substring(5).trim();
          if (jsonPart === '[DONE]') continue;
          try {
            var parsed = JSON.parse(jsonPart);

            // Handle 'answer' type (simpler format)
            if (parsed.type === 'answer') {
              var answer = parsed.content
                ? (typeof parsed.content === 'string' ? parsed.content : (parsed.content.answer || parsed.content.text || ''))
                : parsed.answer || '';
              if (answer) {
                res.write('data: ' + JSON.stringify({ type: 'answer', content: { answer: answer } }) + '\n');
              }
            }

            // Handle Coze v3 delta events (streaming tokens)
            if (parsed.event === 'conversation.message.delta' && parsed.content) {
              var deltaText = typeof parsed.content === 'string' ? parsed.content : (parsed.content.text || parsed.content.content || '');
              if (deltaText) {
                res.write('data: ' + JSON.stringify({ type: 'answer', content: { answer: deltaText } }) + '\n');
              }
            }

            // Handle Coze v3 completed message
            if (parsed.event === 'conversation.message.completed' && parsed.content) {
              var fullText = typeof parsed.content === 'string' ? parsed.content : (parsed.content.answer || '');
              if (fullText) {
                res.write('data: ' + JSON.stringify({ type: 'answer', content: { answer: fullText } }) + '\n');
              }
            }

            // Handle Coze v3 chat completed (fallback)
            if (parsed.event === 'conversation.chat.completed') {
              var chatContent = parsed.content ? (typeof parsed.content === 'string' ? parsed.content : '') : '';
              if (!chatContent && parsed.messages && parsed.messages.length) {
                chatContent = parsed.messages.map(function(m) { return m.content; }).join('');
              }
              if (chatContent) {
                res.write('data: ' + JSON.stringify({ type: 'answer', content: { answer: chatContent } }) + '\n');
              }
            }
          } catch (e) {
            res.write(ln + '\n');
          }
        }
      }
    }

    processStream();
  } catch (err) {
    console.error('Chat API error:', err);
    res.status(500).json({ error: 'Failed: ' + err.message });
  }
}
