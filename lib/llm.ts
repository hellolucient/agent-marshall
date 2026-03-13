import OpenAI from 'openai';

let _openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!_openai) {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error('OPENAI_API_KEY is required');
    _openai = new OpenAI({ apiKey: key });
  }
  return _openai;
}

export type Message = { role: 'system' | 'user' | 'assistant'; content: string };

/**
 * Single completion. Use for swarm roles, scoring, and short generations.
 */
export async function complete(messages: Message[], options?: { model?: string; temperature?: number }): Promise<string> {
  const model = options?.model ?? 'gpt-4o-mini';
  const temperature = options?.temperature ?? 0.7;
  const res = await getOpenAI().chat.completions.create({
    model,
    messages,
    temperature,
    max_tokens: 2048,
  });
  const content = res.choices[0]?.message?.content;
  if (!content) throw new Error('Empty completion');
  return content.trim();
}

/**
 * JSON completion. Asks for valid JSON and parses it.
 */
export async function completeJson<T>(messages: Message[], options?: { model?: string }): Promise<T> {
  const system = messages.find((m) => m.role === 'system');
  const augmented: Message[] = system
    ? [
        { ...system, content: system.content + '\n\nRespond with valid JSON only. No markdown, no explanation.' },
        ...messages.filter((m) => m.role !== 'system'),
      ]
    : [
        { role: 'system', content: 'Respond with valid JSON only. No markdown, no explanation.' },
        ...messages,
      ];
  const raw = await complete(augmented, { ...options, temperature: 0.3 });
  const cleaned = raw.replace(/^```json?\s*|\s*```$/g, '').trim();
  return JSON.parse(cleaned) as T;
}

export { getOpenAI as openai };
