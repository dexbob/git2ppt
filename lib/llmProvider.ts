export type LlmBackend = 'gemini' | 'openai';

function hasKey(name: string): boolean {
  return Boolean(process.env[name]?.trim());
}

/**
 * Which LLM backend to use.
 * - `auto` (default): GEMINI_API_KEY가 있으면 Gemini, 없으면 OpenAI.
 * - `gemini` / `openai`: 해당 제공자만 사용 (키 없으면 에러).
 */
export function resolveLlmBackend(): LlmBackend {
  const mode = (process.env.LLM_PROVIDER ?? 'auto').toLowerCase().trim();
  const gemini = hasKey('GEMINI_API_KEY');
  const openai = hasKey('OPENAI_API_KEY');

  if (mode === 'gemini') {
    if (!gemini) throw new Error('LLM_PROVIDER=gemini 인데 GEMINI_API_KEY가 비어 있습니다.');
    return 'gemini';
  }
  if (mode === 'openai') {
    if (!openai) throw new Error('LLM_PROVIDER=openai 인데 OPENAI_API_KEY가 비어 있습니다.');
    return 'openai';
  }
  if (mode !== 'auto') {
    throw new Error(`LLM_PROVIDER는 auto, gemini, openai 중 하나여야 합니다. (현재: ${mode})`);
  }
  if (gemini) return 'gemini';
  if (openai) return 'openai';
  throw new Error('GEMINI_API_KEY 또는 OPENAI_API_KEY 중 하나 이상을 설정하세요.');
}
