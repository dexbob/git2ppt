import OpenAI from 'openai';

export type LlmBackend = 'gemini' | 'openai' | 'openrouter';

export type OpenAiCompatibleBackend = Extract<LlmBackend, 'openai' | 'openrouter'>;

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

function hasKey(name: string): boolean {
  return Boolean(process.env[name]?.trim());
}

/**
 * Which LLM backend to use.
 * - `auto` (default): GOOGLE_API_KEY가 있으면 Gemini(Vertex express), 없으면 OpenAI.
 * - `gemini` / `openai` / `openrouter`: 해당 제공자만 사용 (키 없으면 에러).
 * - `openrouter`는 LLM_PROVIDER에 명시할 때만 사용 (`auto`에서는 선택되지 않음).
 */
export function resolveLlmBackend(): LlmBackend {
  const mode = (process.env.LLM_PROVIDER ?? 'auto').toLowerCase().trim();
  const gemini = hasKey('GOOGLE_API_KEY');
  const openai = hasKey('OPENAI_API_KEY');
  const openrouter = hasKey('OPENROUTER_API_KEY');

  if (mode === 'gemini') {
    if (!gemini) throw new Error('LLM_PROVIDER=gemini 인데 GOOGLE_API_KEY가 비어 있습니다.');
    return 'gemini';
  }
  if (mode === 'openai') {
    if (!openai) throw new Error('LLM_PROVIDER=openai 인데 OPENAI_API_KEY가 비어 있습니다.');
    return 'openai';
  }
  if (mode === 'openrouter') {
    if (!openrouter) {
      throw new Error('LLM_PROVIDER=openrouter 인데 OPENROUTER_API_KEY가 비어 있습니다.');
    }
    return 'openrouter';
  }
  if (mode !== 'auto') {
    throw new Error(
      `LLM_PROVIDER는 auto, gemini, openai, openrouter 중 하나여야 합니다. (현재: ${mode})`,
    );
  }
  if (gemini) return 'gemini';
  if (openai) return 'openai';
  throw new Error('GOOGLE_API_KEY 또는 OPENAI_API_KEY 중 하나 이상을 설정하세요.');
}

/** OpenAI SDK client — native OpenAI or OpenRouter (fixed base URL). */
export function createOpenAiCompatibleClient(backend: OpenAiCompatibleBackend): OpenAI {
  if (backend === 'openrouter') {
    const key = process.env.OPENROUTER_API_KEY?.trim();
    if (!key) throw new Error('OPENROUTER_API_KEY가 설정되어 있지 않습니다.');
    return new OpenAI({
      apiKey: key,
      baseURL: OPENROUTER_BASE_URL,
      defaultHeaders: {
        'HTTP-Referer':
          process.env.OPENROUTER_HTTP_REFERER?.trim() || 'http://localhost:8787',
        'X-Title': process.env.OPENROUTER_APP_TITLE?.trim() || 'git2ppt',
      },
    });
  }
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error('OPENAI_API_KEY가 설정되어 있지 않습니다.');
  return new OpenAI({ apiKey: key });
}

export function resolveChatModel(backend: OpenAiCompatibleBackend): string {
  if (backend === 'openrouter') {
    return process.env.OPENROUTER_MODEL?.trim() || 'openrouter/free';
  }
  return process.env.OPENAI_MODEL?.trim() || 'gpt-4o';
}

export function chatProviderLabel(backend: OpenAiCompatibleBackend): string {
  return backend === 'openrouter' ? 'OpenRouter' : 'OpenAI';
}
