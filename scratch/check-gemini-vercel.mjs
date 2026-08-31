async function check() {
  const chatRes = await fetch('https://zonaed-personal-ai-agent-ext.vercel.app/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer 301196',
    },
    body: JSON.stringify({
      model: 'gemini-3.7-flash',
      messages: [{ role: 'user', content: 'Say hi in 1 word' }],
    }),
  });

  const text = await chatRes.text();
  console.log('Gemini 3.7 result:', text.slice(0, 150));
}

check().catch(console.error);
