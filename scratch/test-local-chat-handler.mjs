import handler from '../api/chat.ts';

const req = {
  method: 'POST',
  headers: {
    authorization: 'Bearer 301196',
  },
  body: {
    model: 'groq:llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: 'hello' }],
  },
};

const res = {
  status(code) {
    console.log('Status:', code);
    return this;
  },
  json(data) {
    console.log('JSON:', data);
    return this;
  },
  writeHead(code, headers) {
    console.log('writeHead:', code, headers);
  },
  write(chunk) {
    console.log('write:', chunk);
  },
  end() {
    console.log('end');
  },
};

try {
  await handler(req, res);
} catch (e) {
  console.error('Error running handler:', e);
}
