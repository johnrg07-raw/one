// Anthropic proxy for the review generator — hardened:
//  - Origin allowlist (no more open CORS proxy)
//  - Payload caps (message count + character budget)
//  - Reduced max_tokens
const ALLOWED_ORIGINS = [
  'https://canonmomentphotography.com',
  'https://www.canonmomentphotography.com',
];

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

exports.handler = async function(event) {
  const origin = (event.headers && (event.headers.origin || event.headers.Origin)) || '';
  const headers = corsHeaders(origin);

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // Reject requests from unknown origins (browser calls always send Origin)
  if (!ALLOWED_ORIGINS.includes(origin)) {
    return { statusCode: 403, headers, body: JSON.stringify({ error: { message: 'Forbidden origin.' } }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: { message: 'API key not configured in Netlify environment variables.' } }) };
  }

  try {
    const body = JSON.parse(event.body);
    const messages = Array.isArray(body.messages) ? body.messages : [];

    // Payload caps: max 10 turns, 8k chars total
    if (messages.length === 0 || messages.length > 10) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: { message: 'Invalid message count.' } }) };
    }
    const totalChars = messages.reduce((n, m) => n + (typeof m.content === 'string' ? m.content.length : JSON.stringify(m.content || '').length), 0);
    if (totalChars > 8000) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: { message: 'Payload too large.' } }) };
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        messages,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return { statusCode: 200, headers, body: JSON.stringify({ error: { message: 'Anthropic ' + response.status + ': ' + JSON.stringify(data) } }) };
    }
    return { statusCode: 200, headers, body: JSON.stringify(data) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: { message: err.message } }) };
  }
};
