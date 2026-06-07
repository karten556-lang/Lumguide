const COZE_API_TOKEN = 'eyJhbGciOiJSUzI1NiIsImtpZCI6ImNmMjZkN2M0LWM0NDctNGQwMS1hMGIwLWVhYjViNGY1ZDU5MCJ9.eyJpc3MiOiJodHRwczovL2FwaS5jb3plLmNuIiwiYXVkIjpbIldSQmNSckplU3R1TXNQd1ozQ2libHdBZEE4SURjOVJWIl0sImV4cCI6ODIxMDI2Njg3Njc5OSwiaWF0IjoxNzgwODM5NjQzLCJzdWIiOiJzcGlmZmU6Ly9hcGkuY296ZS5jbi93b3JrbG9hZF9pZGVudGl0eS9pZDo3NjQ4NjE1MTQ2MTYzNTM1OTE0Iiwic3JjIjoiaW5ib3VuZF9hdXRoX2FjY2Vzc190b2tlbl9pZDo3NjQ4NjQ4MDI5MzY0Mjg5NTcwIn0.NDmadZ7FJIEDraDjFQiL2QRuo92J1vNIDnQrSGE_2fcI-sBh2nj17Kp8A4lmZYL_lqH2w3QOglArxGXyYopJqlLBJasqLaeyHd3SzLeMhHzq1OoI7UM7iRh5NO0F1Je-KXCrjsyei18CsDNNORXmaVhtOA_igdVIx3d5EzwvgUtLQKvxL4o5fXTk3ODbb0Ghi0OQ_TEmTfd8GEM6WGOGTDWLASwXDRgRpg6uG5mh8IX3tmTO-cBAJeUeQkhG2cpZ3DOQ_JyrvTRE1vkuSPeqgbinareSQZt-PVN0DAolj-jIHUNh--MgRO4JfkEKEkLp3OZPQ90gTrmV1nfuH0mrkg';
const BOT_ID = '7648605237338718250';

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

  const body = JSON.stringify({
    content: { query: { prompt: [{ type: 'text', content: { text: message } }] } },
    type: 'query',
    session_id: session_id || 'lum_' + Date.now().toString(36),
    project_id: parseInt(BOT_ID)
  });

  try {
    const apiRes = await fetch('https://m9jyy5369h.coze.site/stream_run', {
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
    function pushChunk() {
      reader.read().then(({ done, value }) => {
        if (done) { res.end(); return; }
        res.write(decoder.decode(value, { stream: true }));
        pushChunk();
      }).catch(() => { res.end(); });
    }
    pushChunk();
  } catch (err) {
    res.status(502).json({ error: 'Failed: ' + err.message });
  }
}
