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

export class AnalyzeTimeoutError extends Error {
  timeoutMs: number;

  constructor(timeoutMs: number) {
    super(
      `저장소 용량 또는 네트워크 상태로 인해 ${Math.round(timeoutMs / 1000)}초 내 스캔을 완료하지 못했습니다.`,
    );
    this.name = 'AnalyzeTimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

type AnalyzeRepoOptions = {
  cloneTimeoutMs?: number;
};

function isTimeoutLikeError(err: unknown): boolean {
  const raw = err instanceof Error ? err.message : String(err ?? '');
  return /timed out|timeout|ETIMEDOUT|ECONNRESET|aborted/i.test(raw);
}

async function withAnalyzeTimeout<T>(work: Promise<T>, timeoutMs: number): Promise<T> {
  return await new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => {
      reject(new AnalyzeTimeoutError(timeoutMs));
    }, timeoutMs);
    work.then(
      (value) => {
        clearTimeout(t);
        resolve(value);
      },
      (err) => {
        clearTimeout(t);
        reject(err);
      },
    );
  });
}

async function runAnalyzeAttempt(
  parsed: ParsedGithubRepo,
  timeoutMs: number,
  useToken: boolean,
): Promise<RepositoryMetadata> {
  const { repoDir, cleanupRoot } = await cloneGithubRepo(parsed, {
    timeoutMs,
    useToken,
  });
  try {
    return await scanWithOwnerProfile(repoDir, parsed.webUrl, parsed);
  } finally {
    await removeCloneDir(cleanupRoot).catch(() => undefined);
  }
}

async function runZipAnalyzeAttempt(
  parsed: ParsedGithubRepo,
  timeoutMs: number,
): Promise<RepositoryMetadata> {
  const { repoDir, cleanupRoot } = await downloadGithubRepoZip(parsed, { timeoutMs });
  try {
    return await scanWithOwnerProfile(repoDir, parsed.webUrl, parsed);
  } finally {
    await removeCloneDir(cleanupRoot).catch(() => undefined);
  }
}

export async function analyzeGithubRepository(
  repoUrl: string,
  options?: AnalyzeRepoOptions,
): Promise<RepositoryMetadata> {
  const parsed = parseGithubRepoUrl(repoUrl);
  if (!parsed) {
    throw new Error('유효한 GitHub HTTPS URL이 아닙니다. (예: https://github.com/owner/repo)');
  }

  const timeoutMs = options?.cloneTimeoutMs ?? Number(process.env.GIT_CLONE_TIMEOUT_MS ?? 120_000);
  if (process.env.VERCEL === '1') {
    try {
      return await withAnalyzeTimeout(runZipAnalyzeAttempt(parsed, timeoutMs), timeoutMs);
    } catch (err) {
      if (err instanceof AnalyzeTimeoutError || isTimeoutLikeError(err)) {
        throw new AnalyzeTimeoutError(timeoutMs);
      }
      throw err instanceof Error ? err : new Error('저장소 분석에 실패했습니다.');
    }
  }

  const tokenExists = Boolean(process.env.GITHUB_TOKEN?.trim());
  const startedAt = Date.now();
  let firstError: unknown = null;
  let finalError: unknown = null;

  const remainingMs = (): number => timeoutMs - (Date.now() - startedAt);
  const currentBudget = (): number => {
    const left = remainingMs();
    if (left <= 0) throw new AnalyzeTimeoutError(timeoutMs);
    return left;
  };

  try {
    const budget = currentBudget();
    return await withAnalyzeTimeout(runAnalyzeAttempt(parsed, budget, false), budget);
  } catch (err) {
    firstError = err;
  }

  // 정책: 무토큰 clone 시도가 "시간 초과"로 끝난 경우 토큰 fallback을 타지 않는다.
  // 바로 +1분 재시도 안내 흐름으로 보낸다.
  if (firstError instanceof AnalyzeTimeoutError || isTimeoutLikeError(firstError)) {
    throw new AnalyzeTimeoutError(timeoutMs);
  }

  if (tokenExists) {
    try {
      const budget = currentBudget();
      return await withAnalyzeTimeout(runAnalyzeAttempt(parsed, budget, true), budget);
    } catch (err) {
      finalError = err;
    }
  }

  if (finalError instanceof AnalyzeTimeoutError || isTimeoutLikeError(finalError)) {
    throw new AnalyzeTimeoutError(timeoutMs);
  }

  const errToThrow = finalError ?? firstError;
  throw errToThrow instanceof Error ? errToThrow : new Error('저장소 분석에 실패했습니다.');
}

// Legacy: kept for optional/manual diagnostics.
export async function analyzeGithubRepositoryWithZipFallback(
  repoUrl: string,
): Promise<RepositoryMetadata> {
  const parsed = parseGithubRepoUrl(repoUrl);
  if (!parsed) {
    throw new Error('유효한 GitHub HTTPS URL이 아닙니다. (예: https://github.com/owner/repo)');
  }
  const timeoutMs = Number(process.env.GITHUB_ZIP_TIMEOUT_MS ?? 120_000);
  return await runZipAnalyzeAttempt(parsed, timeoutMs);
}
