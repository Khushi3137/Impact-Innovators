const fetch = (...args) =>
  import('node-fetch').then(({ default: fetch }) => fetch(...args));

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'openai/gpt-oss-20b';

function getGroqApiKey() {
  const apiKey = process.env.GROQ_API_KEY?.trim();

  if (!apiKey) {
    const error = new Error('GROQ_API_KEY is not configured');
    error.statusCode = 503;
    throw error;
  }

  return apiKey;
}

function getGroqModel() {
  return process.env.GROQ_MODEL?.trim() || DEFAULT_MODEL;
}

async function callGroq(prompt, options = {}) {
  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getGroqApiKey()}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: getGroqModel(),
      messages: [
        {
          role: 'system',
          content: options.systemPrompt || 'You are a helpful academic tutor.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2048
    })
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data.error?.message || `Groq request failed with status ${response.status}`;
    const error = new Error(message);
    error.statusCode = response.status;
    throw error;
  }

  const text = data.choices?.[0]?.message?.content;

  if (!text) {
    throw new Error('Groq returned an empty response');
  }

  return text;
}

function hasGroqApiKey() {
  return Boolean(process.env.GROQ_API_KEY?.trim());
}

module.exports = {
  callGroq,
  hasGroqApiKey,
  getGroqModel
};
