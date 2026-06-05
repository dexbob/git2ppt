import { GoogleGenAI } from '@google/genai';

/** Vertex AI express mode API key (GOOGLE_API_KEY). */
export function hasGeminiApiKey(): boolean {
  return Boolean(process.env.GOOGLE_API_KEY?.trim());
}

export function createGeminiClient(): GoogleGenAI {
  const key = process.env.GOOGLE_API_KEY?.trim();
  if (!key) {
    throw new Error('GOOGLE_API_KEY가 설정되어 있지 않습니다. (Vertex AI express mode)');
  }
  return new GoogleGenAI({ apiKey: key });
}

export function resolveGeminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash';
}
