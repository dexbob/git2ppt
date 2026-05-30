import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import type { ParsedGithubRepo } from './types.js';
import { PRIORITY_FILES, SKIP_DIR, TEXT_EXTENSIONS } from './scanRepo.js';

const API_BASE = 'https://api.github.com';
const RAW_BASE = 'https://raw.githubusercontent.com';

/** 다운로드할 텍스트 파일 최대 개수 (스캔 스니펫 상한보다 넉넉하게) */
const MAX_FETCH_FILES = 80;
/** 동시 파일 다운로드 수 (CDN 2차 제한 회피) */
const FETCH_CONCURRENCY = 8;
/** 트리 샘플 최대 라인 수 */
const MAX_TREE_LINES = 120;

/** GitHub 트리 응답이 잘려(truncated) 전체 목록을 얻지 못한 경우 */
export class TreeTruncatedError extends Error {
  constructor() {
    super('GitHub 트리 응답이 잘려 전체 파일 목록을 가져오지 못했습니다.');
    this.name = 'TreeTruncatedError';
  }
}

export type ApiCollectResult = {
  repoDir: string;
  /** scan 후 삭제할 임시 루트 */
  cleanupRoot: string;
  defaultBranch: string;
  /** 전체 트리 기반으로 만든 디렉터리 구조 샘플 */
  treeSample: string;
};

type TreeEntry = {
  path: string;
  type: 'blob' | 'tree' | 'commit';
  size?: number;
  sha: string;
};

function tokenValue(useToken: boolean): string | undefined {
  if (!useToken) return undefined;
  return process.env.GITHUB_TOKEN?.trim() || undefined;
}

function apiHeaders(useToken: boolean): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'git2ppt',
  };
  const token = tokenValue(useToken);
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function rawHeaders(useToken: boolean): Record<string, string> {
  const headers: Record<string, string> = { 'User-Agent': 'git2ppt' };
  const token = tokenValue(useToken);
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function basename(p: string): string {
  const i = p.lastIndexOf('/');
  return i < 0 ? p : p.slice(i + 1);
}

function extOf(p: string): string {
  const name = basename(p);
  const dot = name.lastIndexOf('.');
  return dot <= 0 ? '' : name.slice(dot).toLowerCase();
}

function encodeRef(ref: string): string {
  return ref.split('/').map(encodeURIComponent).join('/');
}

function inSkippedDir(p: string): boolean {
  const parts = p.split('/');
  for (let i = 0; i < parts.length - 1; i++) {
    if (SKIP_DIR.has(parts[i]!)) return true;
  }
  return false;
}

function isCandidateTextFile(p: string): boolean {
  if (inSkippedDir(p)) return false;
  if (PRIORITY_FILES.includes(basename(p))) return true;
  const ext = extOf(p);
  if (!TEXT_EXTENSIONS.has(ext)) return false;
  if (p.includes('lock') && (p.endsWith('.json') || p.endsWith('.yaml'))) return false;
  return true;
}

function selectFiles(blobs: TreeEntry[]): TreeEntry[] {
  const candidates = blobs.filter((b) => isCandidateTextFile(b.path));
  candidates.sort((a, b) => {
    const ap = PRIORITY_FILES.includes(basename(a.path)) ? 0 : 1;
    const bp = PRIORITY_FILES.includes(basename(b.path)) ? 0 : 1;
    if (ap !== bp) return ap - bp;
    const ad = a.path.split('/').length;
    const bd = b.path.split('/').length;
    if (ad !== bd) return ad - bd;
    return a.path.localeCompare(b.path);
  });
  return candidates.slice(0, MAX_FETCH_FILES);
}

/** 전체 blob 경로 목록으로 디렉터리 구조 샘플을 만든다 (clone 결과와 유사한 형태). */
function buildTreeSampleFromPaths(blobs: TreeEntry[], rootName: string): string {
  const files = blobs.filter((b) => b.type === 'blob' && !inSkippedDir(b.path)).map((b) => b.path);

  const dirFiles = new Map<string, string[]>();
  const dirSet = new Set<string>(['']);
  for (const f of files) {
    const slash = f.lastIndexOf('/');
    const dir = slash < 0 ? '' : f.slice(0, slash);
    const name = slash < 0 ? f : f.slice(slash + 1);
    if (!dirFiles.has(dir)) dirFiles.set(dir, []);
    dirFiles.get(dir)!.push(name);
    const parts = dir ? dir.split('/') : [];
    let acc = '';
    for (const part of parts) {
      acc = acc ? `${acc}/${part}` : part;
      dirSet.add(acc);
    }
  }

  const dirs = [...dirSet].sort((a, b) => {
    const ad = a === '' ? 0 : a.split('/').length;
    const bd = b === '' ? 0 : b.split('/').length;
    if (ad !== bd) return ad - bd;
    return a.localeCompare(b);
  });

  const lines: string[] = [`${rootName}/`];
  let count = 1;
  for (const dir of dirs) {
    if (count >= MAX_TREE_LINES) break;
    const depth = dir === '' ? 0 : dir.split('/').length;
    if (dir !== '') {
      lines.push(`${'  '.repeat(depth)}${basename(dir)}/`);
      count++;
    }
    const fnames = (dirFiles.get(dir) ?? []).sort().slice(0, 12);
    for (const f of fnames) {
      if (count >= MAX_TREE_LINES) break;
      lines.push(`${'  '.repeat(depth + 1)}${f}`);
      count++;
    }
  }
  if (lines.length > MAX_TREE_LINES) {
    return `${lines.slice(0, MAX_TREE_LINES).join('\n')}\n…`;
  }
  return lines.join('\n');
}

async function fetchRawFile(
  parsed: ParsedGithubRepo,
  branch: string,
  filePath: string,
  useToken: boolean,
  signal: AbortSignal,
): Promise<string | null> {
  const encodedPath = filePath.split('/').map(encodeURIComponent).join('/');
  const url = `${RAW_BASE}/${parsed.owner}/${parsed.repo}/${encodeRef(branch)}/${encodedPath}`;
  try {
    const res = await fetch(url, { headers: rawHeaders(useToken), signal });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function fetchSelectedFiles(
  parsed: ParsedGithubRepo,
  branch: string,
  repoDir: string,
  selected: TreeEntry[],
  useToken: boolean,
  signal: AbortSignal,
): Promise<void> {
  let cursor = 0;
  async function worker(): Promise<void> {
    while (cursor < selected.length) {
      const entry = selected[cursor++]!;
      const content = await fetchRawFile(parsed, branch, entry.path, useToken, signal);
      if (content == null) continue;
      const dest = path.join(repoDir, entry.path);
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.writeFile(dest, content, 'utf8');
    }
  }
  const workers = Array.from({ length: Math.min(FETCH_CONCURRENCY, selected.length) }, () =>
    worker(),
  );
  await Promise.all(workers);
}

/**
 * GitHub REST API(트리 + raw)로 텍스트 파일만 선택적으로 받아 임시 디렉터리에 펼친다.
 * git 바이너리가 필요 없어 로컬·Vercel 모두에서 동작한다.
 */
export async function collectRepoViaApi(
  parsed: ParsedGithubRepo,
  options: { timeoutMs: number; useToken: boolean },
): Promise<ApiCollectResult> {
  const { timeoutMs, useToken } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const repoRes = await fetch(`${API_BASE}/repos/${parsed.owner}/${parsed.repo}`, {
      headers: apiHeaders(useToken),
      signal: controller.signal,
    });
    if (!repoRes.ok) {
      throw new Error(
        repoRes.status === 404
          ? '저장소를 찾을 수 없습니다. 비공개인 경우 GITHUB_TOKEN이 필요합니다.'
          : `GitHub API 오류 (${repoRes.status})`,
      );
    }
    const repoMeta = (await repoRes.json()) as { default_branch?: string };
    const branch = repoMeta.default_branch?.trim() || 'main';

    const treeRes = await fetch(
      `${API_BASE}/repos/${parsed.owner}/${parsed.repo}/git/trees/${encodeRef(branch)}?recursive=1`,
      { headers: apiHeaders(useToken), signal: controller.signal },
    );
    if (!treeRes.ok) {
      throw new Error(`GitHub 트리 조회 실패 (${treeRes.status})`);
    }
    const treeJson = (await treeRes.json()) as { tree?: TreeEntry[]; truncated?: boolean };
    if (treeJson.truncated) {
      throw new TreeTruncatedError();
    }
    const blobs = (treeJson.tree ?? []).filter((e) => e.type === 'blob');

    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'ghapi-'));
    const repoDir = path.join(tmp, `${parsed.owner}__${parsed.repo}`);
    await fs.mkdir(repoDir, { recursive: true });

    const selected = selectFiles(blobs);
    await fetchSelectedFiles(parsed, branch, repoDir, selected, useToken, controller.signal);

    const treeSample = buildTreeSampleFromPaths(blobs, path.basename(repoDir));
    return { repoDir, cleanupRoot: tmp, defaultBranch: branch, treeSample };
  } finally {
    clearTimeout(timer);
  }
}
