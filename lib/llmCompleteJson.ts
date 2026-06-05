import OpenAI from 'openai';
import type { GenerateContentConfig } from '@google/genai';
import { formatUserFacingError } from './formatUserFacingError.js';
import { createGeminiClient, resolveGeminiModel } from './geminiClient.js';
import {
  chatProviderLabel,
  createOpenAiCompatibleClient,
  resolveChatModel,
  resolveLlmBackend,
  type OpenAiCompatibleBackend,
} from './llmProvider.js';

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

type JsonCompletionParams = {
  system: string;
  user: string;
  temperature: number;
  responseSchema?: LlmSchema;
};

function buildJsonResponseFormat(
  responseSchema: LlmSchema | undefined,
  strictSchema: boolean,
): OpenAI.Chat.Completions.ChatCompletionCreateParams['response_format'] {
  if (!responseSchema) return { type: 'json_object' };
  if (strictSchema) {
    return {
      type: 'json_schema',
      json_schema: {
        name: responseSchema.name,
        strict: true,
        schema: responseSchema.schema,
      },
    };
  }
  return { type: 'json_object' };
}

async function requestJsonCompletion(
  backend: OpenAiCompatibleBackend,
  params: JsonCompletionParams,
  strictSchema: boolean,
): Promise<string> {
  const client = createOpenAiCompatibleClient(backend);
  const model = resolveChatModel(backend);
  const label = chatProviderLabel(backend);
  let completion;
  try {
    completion = await client.chat.completions.create({
      model,
      temperature: params.temperature,
      response_format: buildJsonResponseFormat(params.responseSchema, strictSchema),
      messages: [
        { role: 'system', content: params.system },
        { role: 'user', content: params.user },
      ],
    });
  } catch (err) {
    throw new Error(formatUserFacingError(err, `${label} 요청에 실패했습니다.`));
  }
  const raw = completion.choices[0]?.message?.content?.trim();
  if (!raw) throw new Error('LLM 응답이 비어 있습니다.');
  return stripJsonFences(raw);
}

async function completeJsonOpenAiCompatible(
  backend: OpenAiCompatibleBackend,
  params: JsonCompletionParams,
): Promise<string> {
  if (params.responseSchema) {
    try {
      return await requestJsonCompletion(backend, params, true);
    } catch (firstErr) {
      if (backend !== 'openrouter') throw firstErr;
      return requestJsonCompletion(backend, params, false);
    }
  }
  return requestJsonCompletion(backend, params, false);
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

async function generateGeminiText(
  params: { system: string; user: string; temperature: number },
  extraConfig?: Pick<GenerateContentConfig, 'responseMimeType' | 'responseSchema'>,
): Promise<string> {
  const ai = createGeminiClient();
  const model = resolveGeminiModel();
  let response;
  try {
    response = await ai.models.generateContent({
      model,
      contents: params.user,
      config: {
        systemInstruction: params.system,
        temperature: params.temperature,
        ...extraConfig,
      },
    });
  } catch (err) {
    throw new Error(formatUserFacingError(err, 'Gemini 요청에 실패했습니다.'));
  }
  const raw = response.text?.trim();
  if (!raw) throw new Error('LLM 응답이 비어 있습니다.');
  return raw;
}

async function completeJsonGemini(params: JsonCompletionParams): Promise<string> {
  const cleanedSchema = params.responseSchema
    ? removeAdditionalProperties(params.responseSchema.schema)
    : undefined;
  const raw = await generateGeminiText(params, {
    responseMimeType: 'application/json',
    ...(cleanedSchema ? { responseSchema: cleanedSchema } : {}),
  });
  return stripJsonFences(raw);
}

/** JSON-only 텍스트 완성 (Gemini, OpenAI, OpenRouter). */
export async function completeJsonText(params: JsonCompletionParams): Promise<string> {
  const backend = resolveLlmBackend();
  if (backend === 'gemini') {
    return completeJsonGemini(params);
  }
  return completeJsonOpenAiCompatible(backend, params);
}

async function completeMarkdownOpenAiCompatible(
  backend: OpenAiCompatibleBackend,
  params: { system: string; user: string; temperature: number },
): Promise<string> {
  const client = createOpenAiCompatibleClient(backend);
  const model = resolveChatModel(backend);
  const label = chatProviderLabel(backend);
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
    throw new Error(formatUserFacingError(err, `${label} 요청에 실패했습니다.`));
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
  const raw = await generateGeminiText(params);
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
  return completeMarkdownOpenAiCompatible(backend, params);
}
