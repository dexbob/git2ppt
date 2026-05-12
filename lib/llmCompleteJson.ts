import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { resolveLlmBackend } from './llmProvider';

function stripJsonFences(raw: string): string {
  const t = raw.trim();
  const m = t.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  return m?.[1]?.trim() ?? t;
}

async function completeJsonOpenAI(params: {
  system: string;
  user: string;
  temperature: number;
}): Promise<string> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error('OPENAI_API_KEY가 설정되어 있지 않습니다.');
  const client = new OpenAI({ apiKey: key });
  const model = process.env.OPENAI_MODEL?.trim() || 'gpt-4o';
  const completion = await client.chat.completions.create({
    model,
    temperature: params.temperature,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: params.system },
      { role: 'user', content: params.user },
    ],
  });
  const raw = completion.choices[0]?.message?.content?.trim();
  if (!raw) throw new Error('LLM 응답이 비어 있습니다.');
  return stripJsonFences(raw);
}

async function completeJsonGemini(params: {
  system: string;
  user: string;
  temperature: number;
}): Promise<string> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new Error('GEMINI_API_KEY가 설정되어 있지 않습니다.');
  const modelName = process.env.GEMINI_MODEL?.trim() || 'gemini-1.5-flash';
  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: params.system,
  });
  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: params.user }] }],
    generationConfig: {
      temperature: params.temperature,
      responseMimeType: 'application/json',
    },
  });
  const raw = result.response.text()?.trim();
  if (!raw) throw new Error('LLM 응답이 비어 있습니다.');
  return stripJsonFences(raw);
}

/** JSON-only 텍스트 완성 (OpenAI 또는 Gemini, 환경에 따라 자동 선택). */
export async function completeJsonText(params: {
  system: string;
  user: string;
  temperature: number;
}): Promise<string> {
  const backend = resolveLlmBackend();
  if (backend === 'gemini') {
    return completeJsonGemini(params);
  }
  return completeJsonOpenAI(params);
}
