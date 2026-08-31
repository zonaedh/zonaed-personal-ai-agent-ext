const modelsToTest = [
  'qwen/qwen3.6-27b',
  'qwen/qwen3.8-27b',
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'meta-llama/llama-3.3-70b-instruct',
  'llama-3.3-70b-specdec',
  'meta-llama/llama-guard-3-8b',
];

async function check() {
  for (const m of modelsToTest) {
    const chatRes = await fetch('https://zonaed-personal-ai-agent-ext.vercel.app/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer 301196',
      },
      body: JSON.stringify({
        model: `groq:${m}`,
        messages: [{ role: 'user', content: 'Say hello in 1 word' }],
      }),
    });

    const text = await chatRes.text();
    console.log(`Model: ${m} =>`, text.slice(0, 150));
  }
}

check().catch(console.error);
