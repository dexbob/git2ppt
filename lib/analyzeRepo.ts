import type { ParsedGithubRepo, RepositoryMetadata } from './types.js';
import { parseGithubRepoUrl } from './github.js';
import { cloneGithubRepo, removeCloneDir } from './cloneRepo.js';
import { downloadGithubRepoZip } from './downloadGithubZip.js';
import { collectRepoViaApi } from './githubApiCollect.js';
import { fetchGithubRepoMeta } from './githubOwnerProfile.js';
import { scanRepository, type ScanOptions } from './scanRepo.js';

const DEFAULT_ATTEMPT_TIMEOUT_MS = Number(process.env.GIT_CLONE_TIMEOUT_MS ?? 120_000);
/** 일시적 오류 시 같은 방식으로 재시도하기 전 대기(ms) */
const TRANSIENT_RETRY_DELAY_MS = 800;

async function scanWithOwnerProfile(
  repoDir: string,
  repoUrl: string,
  parsed: ParsedGithubRepo,
  scanOptions?: ScanOptions,
): Promise<RepositoryMetadata> {
  const [metadata, repoMeta] = await Promise.all([
    scanRepository(repoDir, repoUrl, parsed, scanOptions),
    fetchGithubRepoMeta(parsed),
  ]);
  return {
    ...metadata,
    ownerDisplayName: repoMeta.ownerDisplayName,
    githubTopics: repoMeta.topics,
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientError(err: unknown): boolean {
  const raw = err instanceof Error ? err.message : String(err ?? '');
  return /\b50\d\b|\b429\b|timeout|timed out|ETIMEDOUT|ECONNRESET|ECONNREFUSED|EAI_AGAIN|network|fetch failed|aborted|secondary rate|rate limit/i.test(
    raw,
  );
}

/** 인증 누락 등 재시도/대체 방식으로도 해결되지 않는 치명적 오류 */
function isFatalError(err: unknown): boolean {
  const raw = err instanceof Error ? err.message : String(err ?? '');
  return /유효한 GitHub HTTPS URL이 아닙니다|저장소를 찾을 수 없습니다/.test(raw);
}

function withTimeout<T>(work: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => {
      reject(new Error(`${label} 제한시간(${Math.round(ms / 1000)}초)을 초과했습니다.`));
    }, ms);
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

async function attemptApi(
  parsed: ParsedGithubRepo,
  timeoutMs: number,
  useToken: boolean,
): Promise<RepositoryMetadata> {
  const collected = await collectRepoViaApi(parsed, { timeoutMs, useToken });
  try {
    return await scanWithOwnerProfile(collected.repoDir, parsed.webUrl, parsed, {
      defaultBranch: collected.defaultBranch,
      treeSample: collected.treeSample,
    });
  } finally {
    await removeCloneDir(collected.cleanupRoot).catch(() => undefined);
  }
}

async function attemptClone(
  parsed: ParsedGithubRepo,
  timeoutMs: number,
  useToken: boolean,
): Promise<RepositoryMetadata> {
  const { repoDir, cleanupRoot } = await cloneGithubRepo(parsed, { timeoutMs, useToken });
  try {
    return await scanWithOwnerProfile(repoDir, parsed.webUrl, parsed);
  } finally {
    await removeCloneDir(cleanupRoot).catch(() => undefined);
  }
}

async function attemptZip(
  parsed: ParsedGithubRepo,
  timeoutMs: number,
): Promise<RepositoryMetadata> {
  const { repoDir, cleanupRoot, defaultBranch } = await downloadGithubRepoZip(parsed, {
    timeoutMs,
  });
  try {
    return await scanWithOwnerProfile(repoDir, parsed.webUrl, parsed, { defaultBranch });
  } finally {
    await removeCloneDir(cleanupRoot).catch(() => undefined);
  }
}

type Attempt = {
  label: string;
  run: () => Promise<RepositoryMetadata>;
};

/**
 * 저장소를 분석한다.
 *
 * 기본 경로: GitHub Tree+blob API (git 불필요, 로컬·Vercel 공통).
 * 안전망: git clone(로컬 전용) → GitHub ZIP. 앞 방식이 실패하면 자동으로 다음 방식으로
 * 넘어가며(정보성 로그만 남김), 모든 방식이 실패할 때만 오류를 던진다.
 */
export async function analyzeGithubRepository(repoUrl: string): Promise<RepositoryMetadata> {
  const parsed = parseGithubRepoUrl(repoUrl);
  if (!parsed) {
    throw new Error('유효한 GitHub HTTPS URL이 아닙니다. (예: https://github.com/owner/repo)');
  }

  const timeoutMs = DEFAULT_ATTEMPT_TIMEOUT_MS;
  const tokenExists = Boolean(process.env.GITHUB_TOKEN?.trim());
  const onVercel = process.env.VERCEL === '1';

  const attempts: Attempt[] = [
    {
      label: 'GitHub API(tree+blob)',
      run: () => withTimeout(attemptApi(parsed, timeoutMs, tokenExists), timeoutMs, 'API 수집'),
    },
  ];
  // git 바이너리가 보장되지 않는 Vercel에서는 clone을 건너뛴다.
  if (!onVercel) {
    attempts.push({
      label: 'git clone',
      run: () => withTimeout(attemptClone(parsed, timeoutMs, tokenExists), timeoutMs, 'clone'),
    });
  }
  attempts.push({
    label: 'GitHub ZIP',
    run: () => withTimeout(attemptZip(parsed, timeoutMs), timeoutMs, 'ZIP'),
  });

  let lastError: unknown = null;
  for (const attempt of attempts) {
    try {
      return await attempt.run();
    } catch (err) {
      lastError = err;
      if (isFatalError(err)) {
        throw err instanceof Error ? err : new Error('저장소 분석에 실패했습니다.');
      }
      // 일시적 오류면 같은 방식으로 한 번 더 가볍게 재시도한다.
      if (isTransientError(err)) {
        try {
          await delay(TRANSIENT_RETRY_DELAY_MS);
          return await attempt.run();
        } catch (retryErr) {
          lastError = retryErr;
          if (isFatalError(retryErr)) {
            throw retryErr instanceof Error
              ? retryErr
              : new Error('저장소 분석에 실패했습니다.');
          }
        }
      }
      console.warn(
        `[analyzeRepo] '${attempt.label}' 수집 실패 → 다음 방식으로 진행:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('저장소 분석에 실패했습니다. 잠시 후 다시 시도해 주세요.');
}
