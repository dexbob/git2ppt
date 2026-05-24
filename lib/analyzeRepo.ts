import type { ParsedGithubRepo, RepositoryMetadata } from './types.js';
import { parseGithubRepoUrl } from './github.js';
import { cloneGithubRepo, removeCloneDir } from './cloneRepo.js';
import { downloadGithubRepoZip } from './downloadGithubZip.js';
import { fetchGithubRepoMeta } from './githubOwnerProfile.js';
import { scanRepository } from './scanRepo.js';

async function scanWithOwnerProfile(
  repoDir: string,
  repoUrl: string,
  parsed: ParsedGithubRepo,
): Promise<RepositoryMetadata> {
  const [metadata, repoMeta] = await Promise.all([
    scanRepository(repoDir, repoUrl, parsed),
    fetchGithubRepoMeta(parsed),
  ]);
  return {
    ...metadata,
    ownerDisplayName: repoMeta.ownerDisplayName,
    githubTopics: repoMeta.topics,
  };
}

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
      return await scanWithOwnerProfile(repoDir, parsed.webUrl, parsed);
    } finally {
      await removeCloneDir(cleanupRoot).catch(() => undefined);
    }
  }

  const { repoDir, cleanupRoot } = await cloneGithubRepo(parsed);
  try {
    return await scanWithOwnerProfile(repoDir, parsed.webUrl, parsed);
  } finally {
    await removeCloneDir(cleanupRoot).catch(() => undefined);
  }
}
