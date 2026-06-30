import { HttpError } from './errors';

interface OpenAIChatResponse {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string };
}

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  error?: { message?: string };
}

interface ClaudeContentBlock {
  type: string;
  text?: string;
}

interface ClaudeMessageResponse {
  content: ClaudeContentBlock[];
}

interface ClaudeErrorBody {
  error?: { message?: string };
}

type Provider = 'groq' | 'gemini' | 'anthropic';

function getProvider(): Provider {
  const raw = (process.env.LLM_PROVIDER || 'groq').toLowerCase();
  if (raw === 'gemini' || raw === 'anthropic') return raw;
  return 'groq';
}

async function callGroq(system: string, userPrompt: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new HttpError(
      'Missing GROQ_API_KEY. Get a free key at console.groq.com and add it to your environment variables.',
      500
    );
  }

  const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 1000,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const body: OpenAIChatResponse = await res.json().catch(() => ({}));
    const msg = body?.error?.message || `Groq API error (${res.status})`;
    if (res.status === 401) {
      throw new HttpError('The Groq API key on the server is invalid.', 500);
    }
    if (res.status === 429) {
      throw new HttpError('Rate limit hit — Groq free tier is busy. Try again in a minute.', 429);
    }
    throw new HttpError('Groq API error: ' + msg, 502);
  }

  const data: OpenAIChatResponse = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) {
    throw new HttpError('Groq returned an empty response. Try again.', 502);
  }
  return text;
}

async function callGemini(system: string, userPrompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new HttpError(
      'Missing GEMINI_API_KEY. Get a free key at aistudio.google.com and add it to your environment variables.',
      500
    );
  }

  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: { maxOutputTokens: 1000 },
      }),
    }
  );

  if (!res.ok) {
    const body: GeminiResponse = await res.json().catch(() => ({}));
    const msg = body?.error?.message || `Gemini API error (${res.status})`;
    if (res.status === 401 || res.status === 403) {
      throw new HttpError('The Gemini API key on the server is invalid.', 500);
    }
    if (res.status === 429) {
      throw new HttpError('Rate limit hit — Gemini free tier is busy. Try again in a minute.', 429);
    }
    throw new HttpError('Gemini API error: ' + msg, 502);
  }

  const data: GeminiResponse = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new HttpError('Gemini returned an empty response. Try again.', 502);
  }
  return text;
}

async function callAnthropic(system: string, userPrompt: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new HttpError(
      'Missing ANTHROPIC_API_KEY. Set it in your hosting environment variables, or switch to a free provider with LLM_PROVIDER=groq.',
      500
    );
  }

  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1000,
      system,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!res.ok) {
    const body: ClaudeErrorBody = await res.json().catch(() => ({}));
    const msg = body?.error?.message || `Claude API error (${res.status})`;
    if (res.status === 401) {
      throw new HttpError('The Claude API key on the server is invalid.', 500);
    }
    if (res.status === 429) {
      throw new HttpError('Claude is getting hit hard right now. Try again in a moment.', 429);
    }
    throw new HttpError('Claude API error: ' + msg, 502);
  }

  const data: ClaudeMessageResponse = await res.json();
  const text = data.content?.find((c) => c.type === 'text')?.text;
  if (!text) {
    throw new HttpError('Claude returned an empty response. Try again.', 502);
  }
  return text;
}

export async function callLLM(system: string, userPrompt: string): Promise<string> {
  const provider = getProvider();
  switch (provider) {
    case 'gemini':
      return callGemini(system, userPrompt);
    case 'anthropic':
      return callAnthropic(system, userPrompt);
    default:
      return callGroq(system, userPrompt);
  }
}
