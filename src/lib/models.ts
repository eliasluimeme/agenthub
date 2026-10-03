import 'server-only';
import { decrypt } from './crypto';
import type { Agent } from './types';

/**
 * Model provider adapters. Agents can use any provider with an HTTP API; Anthropic, OpenAI,
 * Mistral (OpenAI-compatible) and Google are built in. Live calls only happen when
 * AGENTHUB_LIVE_MODELS=1 and the agent has its own API key. Otherwise the runner simulates.
 */

export class RateLimited extends Error {
  constructor(readonly retryAfterSec: number) {
    super(`Rate limited, retry after ${retryAfterSec}s`);
  }
}

export interface ModelResult {
  text: string;
  tokensIn: number;
  tokensOut: number;
}

const PLACEHOLDER = 'demo-key-not-a-real-credential';

export function liveModelAvailable(agent: Agent & { api_key_enc?: string | null }, apiKeyEnc: string | null): boolean {
  if (process.env.AGENTHUB_LIVE_MODELS !== '1' || !apiKeyEnc) return false;
  const key = decrypt(apiKeyEnc);
  if (!key || key === PLACEHOLDER) return false;
  return ['Anthropic', 'OpenAI', 'Mistral', 'Google'].includes(agent.provider);
}

async function post(url: string, headers: Record<string, string>, body: unknown): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90_000);
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body), signal: controller.signal });
    if (res.status === 429 || res.status === 503) throw new RateLimited(Number(res.headers.get('retry-after')) || 60);
    if (!res.ok) throw new Error(`Model API returned ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function callModel(agent: Agent, apiKeyEnc: string, system: string, user: string): Promise<ModelResult> {
  const key = decrypt(apiKeyEnc);
  if (!key) throw new Error('The stored API key could not be decrypted.');
  const model = agent.model;
  if (agent.provider === 'Anthropic') {
    const j = (await post('https://api.anthropic.com/v1/messages', { 'x-api-key': key, 'anthropic-version': '2023-06-01' }, { model, max_tokens: 8192, system, messages: [{ role: 'user', content: user }] })) as {
      content?: { text?: string }[];
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    return { text: j.content?.map((c) => c.text ?? '').join('') ?? '', tokensIn: j.usage?.input_tokens ?? 0, tokensOut: j.usage?.output_tokens ?? 0 };
  }
  if (agent.provider === 'OpenAI' || agent.provider === 'Mistral') {
    const base = agent.provider === 'OpenAI' ? 'https://api.openai.com/v1' : 'https://api.mistral.ai/v1';
    const j = (await post(`${base}/chat/completions`, { authorization: `Bearer ${key}` }, { model, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] })) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    return { text: j.choices?.[0]?.message?.content ?? '', tokensIn: j.usage?.prompt_tokens ?? 0, tokensOut: j.usage?.completion_tokens ?? 0 };
  }
  if (agent.provider === 'Google') {
    const j = (await post(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, { 'x-goog-api-key': key }, {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
    })) as { candidates?: { content?: { parts?: { text?: string }[] } }[]; usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number } };
    return { text: j.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '', tokensIn: j.usageMetadata?.promptTokenCount ?? 0, tokensOut: j.usageMetadata?.candidatesTokenCount ?? 0 };
  }
  throw new Error(`Live calls are not supported for ${agent.provider} yet.`);
}

/** Pull a JSON object out of a model reply, tolerating code fences. */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (fenced ? fenced[1] : text).trim();
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('The model did not return JSON.');
  return JSON.parse(raw.slice(start, end + 1));
}
