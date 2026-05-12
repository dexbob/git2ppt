import type { RepositoryMetadata } from './types.js';
import { parseGithubRepoUrl } from './github.js';
import { cloneGithubRepo, removeCloneDir } from './cloneRepo.js';
import { downloadGithubRepoZip } from './downloadGithubZip.js';
import { scanRepository } from './scanRepo.js';

function useZipMode(): boolean {
  if (process.env.USE_GITHUB_ZIP === '1') return true;
  if (process.env.USE_GITHUB_ZIP === '0') return false;
  return process.env.VERCEL === '1';
}

export async function analyzeGithubRepository(repoUrl: string): Promise<RepositoryMetadata> {
  const parsed = parseGithubRepoUrl(repoUrl);
  if (!parsed) {
    throw new Error('유효한 GitHub HTTPS URL이 아닙니다. (예: https://github.com/owner/repo)');
  }

  if (useZipMode()) {
    const { repoDir, cleanupRoot } = await downloadGithubRepoZip(parsed);
    try {
      return await scanRepository(repoDir, parsed.webUrl, parsed);
    } finally {
      await removeCloneDir(cleanupRoot).catch(() => undefined);
    }
  }

  const { repoDir, cleanupRoot } = await cloneGithubRepo(parsed);
  try {
    return await scanRepository(repoDir, parsed.webUrl, parsed);
  } finally {
    await removeCloneDir(cleanupRoot).catch(() => undefined);
  }
}
