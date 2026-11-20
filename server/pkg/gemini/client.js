export async function generateGeminiText({ apiKey, model, prompt, timeoutMs = 30_000 }) {
  if (!apiKey) {
    const err = new Error('Server GEMINI_API_KEY is not configured.');
    err.statusCode = 503;
    throw err;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const err = new Error(`Upstream Gemini API returned status ${response.status}`);
      err.statusCode = 502;
      throw err;
    }
    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text || !text.trim()) {
      const err = new Error('Generated CV text is empty.');
      err.statusCode = 502;
      throw err;
    }
    return text.replace(/^```[a-zA-Z]*\n/, '').replace(/\n```$/, '').trim();
  } finally {
    clearTimeout(timer);
  }
}

