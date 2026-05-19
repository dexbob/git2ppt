import type { RepositoryMetadata } from './types.js';
import { JSON_RESPONSE_ERROR } from './formatUserFacingError.js';
import { completeJsonText } from './llmCompleteJson.js';

export type GenerateSpecResult = {
  techSpecMarkdown: string;
  readmeMarkdown: string;
};

export async function generateRepositorySpec(
  metadata: RepositoryMetadata,
  instruction: string | undefined,
): Promise<GenerateSpecResult> {
  const system = `You are a senior software architect. Given repository scan data, produce:
1) A professional technical specification in Markdown (Korean preferred for prose). Use clear headings: 프로젝트 개요, 기술 스택, 시스템 아키텍처, 주요 기능, 디렉토리 구조, 실행·배포, 향후 개선.
2) A concise project README in Markdown (Korean): purpose, quick start, scripts if known, repo URL.

Output MUST be valid JSON with exactly two string fields: "tech_spec_md" and "readme_md". No markdown fences around the JSON.`;

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
  });

  let parsed: { tech_spec_md?: string; readme_md?: string };
  try {
    parsed = JSON.parse(raw) as { tech_spec_md?: string; readme_md?: string };
  } catch {
    throw new Error(JSON_RESPONSE_ERROR);
  }
  if (!parsed.tech_spec_md || !parsed.readme_md) {
    throw new Error('기술명세서 생성 실패: 필드 누락');
  }
  return {
    techSpecMarkdown: parsed.tech_spec_md,
    readmeMarkdown: parsed.readme_md,
  };
}

/** @deprecated 이름 호환용 — `generateRepositorySpec`과 동일합니다. */
export const generateSpecWithOpenAI = generateRepositorySpec;
