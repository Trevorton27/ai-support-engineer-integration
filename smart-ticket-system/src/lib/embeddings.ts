import OpenAI from 'openai';

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}
const openai = new Proxy({} as OpenAI, {
  get(_target, prop) {
    const client = getOpenAI() as unknown as Record<string | symbol, unknown>;
    return client[prop];
  },
});

const EMBEDDING_MODEL = 'text-embedding-3-small';
const MAX_INPUT_LENGTH = 8000; // Conservative limit for token budget

export async function generateEmbedding(text: string): Promise<number[]> {
  const truncated = text.slice(0, MAX_INPUT_LENGTH);

  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: truncated,
  });

  return response.data[0].embedding;
}
