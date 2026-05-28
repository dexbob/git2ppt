import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import simpleGit from 'simple-git';
import type { ParsedGithubRepo } from './types.js';
import { buildCloneUrl } from './github.js';

const DEFAULT_CLONE_TIMEOUT_MS = Number(process.env.GIT_CLONE_TIMEOUT_MS ?? 120_000);

export type CloneResult = {
  /** Absolute path to repository root */
  repoDir: string;
  /** Path removed in cleanup (defaults to repoDir for git clone) */
  cleanupRoot: string;
};

export type CloneOptions = {
  timeoutMs?: number;
  useToken?: boolean;
};

const SPARSE_PATTERNS = [
  '/*',
  '!/*/',
  '/README*',
  '/readme*',
  '/package.json',
  '/requirements.txt',
  '/pyproject.toml',
  '/go.mod',
  '/Dockerfile',
  '/.env.example',
  '/**/*.md',
  '/**/*.mdx',
  '/**/*.txt',
  '/**/*.json',
  '/**/*.yml',
  '/**/*.yaml',
  '/**/*.toml',
  '/**/*.ini',
  '/**/*.cfg',
  '/**/*.conf',
  '/**/*.ts',
  '/**/*.tsx',
  '/**/*.js',
  '/**/*.jsx',
  '/**/*.mjs',
  '/**/*.cjs',
  '/**/*.py',
  '/**/*.go',
  '/**/*.rs',
  '/**/*.java',
  '/**/*.kt',
  '/**/*.sql',
  '/**/*.sh',
  '/**/*.ps1',
  '/**/*.hcl',
  '/**/*.lock',
];

function pickTempRoot(): string {
  const fromEnv = process.env.CLONE_TMP_DIR?.trim();
  if (fromEnv) return fromEnv;
  return process.env.VERCEL ? os.tmpdir() : path.join(process.cwd(), 'temp', 'clones');
}

export async function cloneGithubRepo(
  parsed: ParsedGithubRepo,
  options?: CloneOptions,
): Promise<CloneResult> {
  const root = pickTempRoot();
  await fs.mkdir(root, { recursive: true });
  const unique = `${parsed.owner}__${parsed.repo}__${Date.now()}`;
  const repoDir = path.join(root, unique);
  const cloneUrl = buildCloneUrl(parsed, options?.useToken === true);
  const timeoutMs = options?.timeoutMs ?? DEFAULT_CLONE_TIMEOUT_MS;
  const git = simpleGit({
    timeout: { block: timeoutMs },
  });
  await git.clone(cloneUrl, repoDir, [
    '--depth',
    '1',
    '--single-branch',
    '--no-tags',
    '--filter=blob:none',
    '--sparse',
    '--no-checkout',
  ]);
  const repoGit = simpleGit({
    baseDir: repoDir,
    timeout: { block: timeoutMs },
  });
  await repoGit.raw(['sparse-checkout', 'init', '--no-cone']);
  await repoGit.raw(['sparse-checkout', 'set', ...SPARSE_PATTERNS]);
  await repoGit.checkout(['--force', 'HEAD']);
  return { repoDir, cleanupRoot: repoDir };
}

export async function removeCloneDir(cleanupRoot: string): Promise<void> {
  await fs.rm(cleanupRoot, { recursive: true, force: true });
}
