import type { RepositoryMetadata } from './types.js';

const README_PATHS = ['README.md', 'readme.md'] as const;

/** 저장소 스캔 결과에서 원본 README 본문을 꺼냅니다. */
export function extractRepoReadme(metadata: RepositoryMetadata): string | null {
  for (const name of README_PATHS) {
    const entry = metadata.priorityFileSummaries.find((p) => p.path === name);
    const text = entry?.excerpt?.trim();
    if (text) return text;
  }
  return null;
}
