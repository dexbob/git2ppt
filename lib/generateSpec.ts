import type { RepositoryMetadata } from './types.js';
import { JSON_RESPONSE_ERROR } from './formatUserFacingError.js';
import { completeJsonText, type LlmSchema } from './llmCompleteJson.js';
import { logJsonParseFailure } from './logJsonParseFailure.js';
import { parseJsonWithRecovery } from './parseJsonWithRecovery.js';

export type GenerateSpecResult = {
  techSpecMarkdown: string;
};

const specSchema: LlmSchema = {
  name: 'generate_spec',
  schema: {
    type: 'object',
    properties: {
      tech_spec_md: {
        type: 'string',
        description: '생성된 마크다운 포맷의 기술명세서 내용',
      },
    },
    required: ['tech_spec_md'],
    additionalProperties: false,
  },
};

export async function generateRepositorySpec(
  metadata: RepositoryMetadata,
  instruction: string | undefined,
): Promise<GenerateSpecResult> {
  const system = `You are a senior software architect. Given repository scan data, produce a professional technical specification in Markdown (Korean preferred for prose). Use clear headings: 프로젝트 개요, 기술 스택, 시스템 아키텍처, 주요 기능, 디렉토리 구조, 실행·배포, 향후 개선.

Output MUST be valid JSON with exactly one string field: "tech_spec_md". No markdown fences around the JSON.`;

  const userPayload = {
    repoUrl: metadata.repoUrl,
    defaultBranch: metadata.defaultBranch,
    treeSample: metadata.directoryTreeSample,
    priorityFiles: metadata.priorityFileSummaries,
    detected: metadata.detected,
    instruction: instruction?.trim() || undefined,
  };

  const raw = await completeJsonText({
    system,
    user: `Repository data (JSON):\n${JSON.stringify(userPayload, null, 2)}`,
    temperature: 0.3,
    responseSchema: specSchema,
  });

  let parsed: { tech_spec_md?: string };
  try {
    parsed = parseJsonWithRecovery<{ tech_spec_md?: string }>(raw);
  } catch (parseErr) {
    logJsonParseFailure('generateSpec', raw, parseErr);
    throw new Error(JSON_RESPONSE_ERROR);
  }
  if (!parsed.tech_spec_md?.trim()) {
    console.error('[generateSpec] missing tech_spec_md:', { rawResponse: raw });
    throw new Error('기술명세서 생성 실패: 필드 누락');
  }
  return {
    techSpecMarkdown: parsed.tech_spec_md,
  };
}

/** @deprecated 이름 호환용 — `generateRepositorySpec`과 동일합니다. */
export const generateSpecWithOpenAI = generateRepositorySpec;
