import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import simpleGit from 'simple-git';
import type { ParsedGithubRepo } from './types.js';
import { buildCloneUrl } from './github.js';

const CLONE_TIMEOUT_MS = Number(process.env.GIT_CLONE_TIMEOUT_MS ?? 120_000);

export type CloneResult = {
  /** Absolute path to repository root */
  repoDir: string;
  /** Path removed in cleanup (defaults to repoDir for git clone) */
  cleanupRoot: string;
};

function pickTempRoot(): string {
  const fromEnv = process.env.CLONE_TMP_DIR?.trim();
  if (fromEnv) return fromEnv;
  return process.env.VERCEL ? os.tmpdir() : path.join(process.cwd(), 'temp', 'clones');
}

export async function cloneGithubRepo(parsed: ParsedGithubRepo): Promise<CloneResult> {
  const root = pickTempRoot();
  await fs.mkdir(root, { recursive: true });
  const unique = `${parsed.owner}__${parsed.repo}__${Date.now()}`;
  const repoDir = path.join(root, unique);
  const cloneUrl = buildCloneUrl(parsed);
  const git = simpleGit({
    timeout: { block: CLONE_TIMEOUT_MS },
  });
  await git.clone(cloneUrl, repoDir, [
    '--depth',
    '1',
    '--single-branch',
    '--no-tags',
  ]);
  return { repoDir, cleanupRoot: repoDir };
}

export async function removeCloneDir(cleanupRoot: string): Promise<void> {
  await fs.rm(cleanupRoot, { recursive: true, force: true });
}
