import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { formatUserFacingError } from './formatUserFacingError.js';
import { resolveLlmBackend } from './llmProvider.js';

function stripJsonFences(raw: string): string {
  const t = raw.trim();
  const m = t.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  return m?.[1]?.trim() ?? t;
}

function stripMarkdownFences(raw: string): string {
  const t = raw.trim();
  const m = t.match(/^```(?:markdown|md)?\s*([\s\S]*?)```$/i);
  return m?.[1]?.trim() ?? t;
}

export type LlmSchema = {
  name: string;
  description?: string;
  schema: any;
};

async function completeJsonOpenAI(params: {
  system: string;
  user: string;
  temperature: number;
  responseSchema?: LlmSchema;
}): Promise<string> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error('OPENAI_API_KEY가 설정되어 있지 않습니다.');
  const client = new OpenAI({ apiKey: key });
  const model = process.env.OPENAI_MODEL?.trim() || 'gpt-4o';
  let completion;
  const response_format: OpenAI.Chat.Completions.ChatCompletionCreateParams['response_format'] =
    params.responseSchema
      ? {
          type: 'json_schema',
          json_schema: {
            name: params.responseSchema.name,
            strict: true,
            schema: params.responseSchema.schema,
          },
        }
      : { type: 'json_object' };

  try {
    completion = await client.chat.completions.create({
      model,
      temperature: params.temperature,
      response_format,
      messages: [
        { role: 'system', content: params.system },
        { role: 'user', content: params.user },
      ],
    });
  } catch (err) {
    throw new Error(formatUserFacingError(err, 'OpenAI 요청에 실패했습니다.'));
  }
  const raw = completion.choices[0]?.message?.content?.trim();
  if (!raw) throw new Error('LLM 응답이 비어 있습니다.');
  return stripJsonFences(raw);
}

function removeAdditionalProperties(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map(removeAdditionalProperties);
  }
  const result: any = {};
  for (const key of Object.keys(obj)) {
    if (key === 'additionalProperties') continue;
    result[key] = removeAdditionalProperties(obj[key]);
  }
  return result;
}

async function completeJsonGemini(params: {
  system: string;
  user: string;
  temperature: number;
  responseSchema?: LlmSchema;
}): Promise<string> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new Error('GEMINI_API_KEY가 설정되어 있지 않습니다.');
  const modelName = process.env.GEMINI_MODEL?.trim() || 'gemini-1.5-flash';
  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: params.system,
  });
  let result;
  try {
    const cleanedSchema = params.responseSchema
      ? removeAdditionalProperties(params.responseSchema.schema)
      : undefined;

    result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: params.user }] }],
      generationConfig: {
        temperature: params.temperature,
        responseMimeType: 'application/json',
        ...(cleanedSchema ? { responseSchema: cleanedSchema } : {}),
      },
    });
  } catch (err) {
    throw new Error(formatUserFacingError(err, 'Gemini 요청에 실패했습니다.'));
  }
  const raw = result.response.text()?.trim();
  if (!raw) throw new Error('LLM 응답이 비어 있습니다.');
  return stripJsonFences(raw);
}

/** JSON-only 텍스트 완성 (OpenAI 또는 Gemini, 환경에 따라 자동 선택). */
export async function completeJsonText(params: {
  system: string;
  user: string;
  temperature: number;
  responseSchema?: LlmSchema;
}): Promise<string> {
  const backend = resolveLlmBackend();
  if (backend === 'gemini') {
    return completeJsonGemini(params);
  }
  return completeJsonOpenAI(params);
}

async function completeMarkdownOpenAI(params: {
  system: string;
  user: string;
  temperature: number;
}): Promise<string> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error('OPENAI_API_KEY가 설정되어 있지 않습니다.');
  const client = new OpenAI({ apiKey: key });
  const model = process.env.OPENAI_MODEL?.trim() || 'gpt-4o';
  let completion;
  try {
    completion = await client.chat.completions.create({
      model,
      temperature: params.temperature,
      messages: [
        { role: 'system', content: params.system },
        { role: 'user', content: params.user },
      ],
    });
  } catch (err) {
    throw new Error(formatUserFacingError(err, 'OpenAI 요청에 실패했습니다.'));
  }
  const raw = completion.choices[0]?.message?.content?.trim();
  if (!raw) throw new Error('LLM 응답이 비어 있습니다.');
  return stripMarkdownFences(raw);
}

async function completeMarkdownGemini(params: {
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
  let result;
  try {
    result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: params.user }] }],
      generationConfig: {
        temperature: params.temperature,
      },
    });
  } catch (err) {
    throw new Error(formatUserFacingError(err, 'Gemini 요청에 실패했습니다.'));
  }
  const raw = result.response.text()?.trim();
  if (!raw) throw new Error('LLM 응답이 비어 있습니다.');
  return stripMarkdownFences(raw);
}

/** Markdown/HTML 본문 그대로 반환 (JSON 래핑 없음). */
export async function completeMarkdownText(params: {
  system: string;
  user: string;
  temperature: number;
}): Promise<string> {
  const backend = resolveLlmBackend();
  if (backend === 'gemini') {
    return completeMarkdownGemini(params);
  }
  return completeMarkdownOpenAI(params);
}
