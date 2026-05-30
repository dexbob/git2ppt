import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import AdmZip from 'adm-zip';
import type { ParsedGithubRepo } from './types.js';

export type ZipDownloadResult = {
  repoDir: string;
  /** Directory to delete after scan (extract root) */
  cleanupRoot: string;
  /** Repository default branch resolved from the GitHub API */
  defaultBranch: string;
};

const ZIP_TIMEOUT_MS = Number(process.env.GITHUB_ZIP_TIMEOUT_MS ?? 120_000);

export async function downloadGithubRepoZip(
  parsed: ParsedGithubRepo,
  options?: { timeoutMs?: number },
): Promise<ZipDownloadResult> {
  const token = process.env.GITHUB_TOKEN?.trim();
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'git2ppt',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const timeoutMs = options?.timeoutMs ?? ZIP_TIMEOUT_MS;

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const metaRes = await fetch(
      `https://api.github.com/repos/${parsed.owner}/${parsed.repo}`,
      { headers, signal: controller.signal },
    );
    if (!metaRes.ok) {
      throw new Error(
        metaRes.status === 404
          ? '저장소를 찾을 수 없습니다. 비공개인 경우 GITHUB_TOKEN이 필요합니다.'
          : `GitHub API 오류 (${metaRes.status})`,
      );
    }
    const meta = (await metaRes.json()) as { default_branch?: string };
    const branch = meta.default_branch ?? 'main';
    const zipUrl = `https://github.com/${parsed.owner}/${parsed.repo}/archive/refs/heads/${branch}.zip`;
    const zipRes = await fetch(zipUrl, { headers, signal: controller.signal });
    if (!zipRes.ok) {
      throw new Error(`ZIP 다운로드 실패 (${zipRes.status})`);
    }
    const buf = Buffer.from(await zipRes.arrayBuffer());
    const zip = new AdmZip(buf);
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'ghzip-'));
    zip.extractAllTo(tmp, true);
    const entries = await fs.readdir(tmp);
    if (entries.length !== 1) {
      await fs.rm(tmp, { recursive: true, force: true });
      throw new Error('ZIP 구조를 해석할 수 없습니다.');
    }
    const repoDir = path.join(tmp, entries[0]!);
    return { repoDir, cleanupRoot: tmp, defaultBranch: branch };
  } finally {
    clearTimeout(t);
  }
}
