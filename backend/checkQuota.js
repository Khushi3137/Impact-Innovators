require('dotenv').config();

async function checkGroq() {
  const apiKey = process.env.GROQ_API_KEY?.trim();

  console.log('Groq API status check');
  console.log('Current time:', new Date().toLocaleString());

  if (!apiKey) {
    console.log('GROQ_API_KEY is not configured in backend/.env');
    return;
  }

  try {
    const response = await fetch('https://api.groq.com/openai/v1/models', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.log(`Groq check failed with status ${response.status}`);
      console.log(data.error?.message || data.message || 'No error details returned');
      return;
    }

    const activeModels = Array.isArray(data.data)
      ? data.data.filter((model) => model.active !== false).map((model) => model.id)
      : [];

    console.log('Groq API key is working.');
    console.log('Configured model:', process.env.GROQ_MODEL?.trim() || 'openai/gpt-oss-20b');
    console.log('Available models:', activeModels.slice(0, 10).join(', ') || 'No models returned');
  } catch (error) {
    console.log('Status check error:', error.message);
  }
}

checkGroq();
