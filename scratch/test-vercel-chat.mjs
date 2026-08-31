async function test() {
  const authRes = await fetch('https://zonaed-personal-ai-agent-ext.vercel.app/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin: '301196' }),
  });
  console.log('Auth status:', authRes.status);
  const authData = await authRes.json();
  console.log('Auth data:', authData);

  if (!authData.token) {
    console.log('No token returned');
    return;
  }

  const chatRes = await fetch('https://zonaed-personal-ai-agent-ext.vercel.app/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authData.token}`,
    },
    body: JSON.stringify({
      model: 'groq:llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: 'Hi, are you working?' }],
    }),
  });

  console.log('Chat status:', chatRes.status);
  const text = await chatRes.text();
  console.log('Chat response:', text);
}

test().catch(console.error);
