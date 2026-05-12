import fs from 'node:fs/promises';
import path from 'node:path';
import type { Dirent } from 'node:fs';
import type {
  DetectedSignals,
  ParsedGithubRepo,
  PriorityFileSummary,
  RepositoryMetadata,
} from './types.js';

const PRIORITY_FILES = [
  'package.json',
  'requirements.txt',
  'README.md',
  'readme.md',
  'vite.config.ts',
  'vite.config.js',
  'next.config.js',
  'next.config.mjs',
  'Dockerfile',
  '.env.example',
  'pyproject.toml',
  'go.mod',
];

const TEXT_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.md',
  '.yml',
  '.yaml',
  '.toml',
  '.py',
  '.go',
  '.rs',
  '.java',
  '.kt',
  '.sql',
  '.env',
  '.example',
]);

const SKIP_DIR = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  'coverage',
  '.turbo',
  '.vercel',
  '__pycache__',
  'vendor',
]);

const MAX_FILE_READ = 48_000;
const MAX_TOTAL_SNIPPET_FILES = 40;
const MAX_TREE_LINES = 120;
const MAX_WALK_DIRS = 400;

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}\n\n… (truncated)`;
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function readTextSafe(filePath: string): Promise<string | null> {
  try {
    const buf = await fs.readFile(filePath);
    const text = buf.toString('utf8');
    return truncate(text, MAX_FILE_READ);
  } catch {
    return null;
  }
}

async function walkDirs(root: string): Promise<string[]> {
  const dirs: string[] = [];
  const queue: string[] = [root];
  while (queue.length && dirs.length < MAX_WALK_DIRS) {
    const dir = queue.shift()!;
    let entries: Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    dirs.push(dir);
    for (const ent of entries) {
      if (!ent.isDirectory()) continue;
      if (SKIP_DIR.has(ent.name)) continue;
      queue.push(path.join(dir, ent.name));
    }
  }
  return dirs;
}

async function buildTreeSample(repoDir: string): Promise<string> {
  const dirs = await walkDirs(repoDir);
  dirs.sort((a, b) => a.length - b.length || a.localeCompare(b));
  const lines: string[] = [];
  const rootName = path.basename(repoDir);
  lines.push(`${rootName}/`);
  let count = 1;
  for (const dir of dirs) {
    const rel = path.relative(repoDir, dir);
    if (!rel || rel.startsWith('..')) continue;
    const indent = rel.split(path.sep).length;
    const prefix = `${'  '.repeat(indent)}${path.basename(dir)}/`;
    lines.push(prefix);
    let entries: Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    const files = entries
      .filter((e) => e.isFile())
      .map((e) => e.name)
      .sort()
      .slice(0, 12);
    for (const f of files) {
      if (count >= MAX_TREE_LINES) break;
      lines.push(`${'  '.repeat(indent + 1)}${f}`);
      count++;
    }
    if (count >= MAX_TREE_LINES) break;
  }
  if (lines.length > MAX_TREE_LINES) {
    return lines.slice(0, MAX_TREE_LINES).join('\n') + '\n…';
  }
  return lines.join('\n');
}

function extOf(filePath: string): string {
  return path.extname(filePath).toLowerCase();
}

function detectFromPackageJson(text: string | null): Partial<DetectedSignals> {
  if (!text) return {};
  let pkg: Record<string, unknown>;
  try {
    pkg = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {};
  }
  const deps: Record<string, string> = {
    ...((pkg.dependencies as Record<string, string>) ?? {}),
    ...((pkg.devDependencies as Record<string, string>) ?? {}),
  };
  const keys = Object.keys(deps);
  const out: Partial<DetectedSignals> = { aiApis: [], features: [] };

  if (keys.some((k) => k === 'react')) out.frontend = 'React';
  if (keys.some((k) => k === 'next')) out.frontend = 'Next.js';
  if (keys.some((k) => k === 'vite')) {
    out.frontend = out.frontend ? `${out.frontend} + Vite` : 'Vite';
  }
  if (keys.some((k) => k === 'vue')) out.frontend = out.frontend ? `${out.frontend}, Vue` : 'Vue';
  if (keys.some((k) => k === 'express')) out.backend = 'Express';
  if (keys.some((k) => k === 'fastify')) out.backend = 'Fastify';
  if (keys.some((k) => k === 'zustand')) out.stateManagement = 'Zustand';
  if (keys.some((k) => k === '@reduxjs/toolkit' || k === 'redux')) {
    out.stateManagement = 'Redux';
  }
  if (keys.some((k) => k === 'openai')) out.aiApis!.push('OpenAI');
  if (keys.some((k) => k === '@anthropic-ai/sdk')) out.aiApis!.push('Anthropic');
  if (keys.some((k) => k.includes('google') && k.includes('generative'))) {
    out.aiApis!.push('Gemini');
  }
  if (keys.some((k) => k === 'prisma' || k === 'drizzle-orm' || k === 'mongoose')) {
    out.database = 'ORM/DB layer detected';
  }
  if (keys.some((k) => k === '@vercel/node' || k === 'vercel')) out.deployment = 'Vercel';
  if (keys.some((k) => k === 'docker')) out.deployment = out.deployment ?? 'Docker';

  return out;
}

function mergeDetected(base: DetectedSignals, partial: Partial<DetectedSignals>): DetectedSignals {
  return {
    frontend: partial.frontend ?? base.frontend,
    backend: partial.backend ?? base.backend,
    stateManagement: partial.stateManagement ?? base.stateManagement,
    deployment: partial.deployment ?? base.deployment,
    aiApis: [...new Set([...(base.aiApis ?? []), ...(partial.aiApis ?? [])])],
    database: partial.database ?? base.database,
    features:
      partial.features && partial.features.length
        ? [...new Set([...base.features, ...partial.features])]
        : base.features,
  };
}

async function collectSnippets(repoDir: string): Promise<PriorityFileSummary[]> {
  const summaries: PriorityFileSummary[] = [];
  const seen = new Set<string>();

  for (const rel of PRIORITY_FILES) {
    const fp = path.join(repoDir, rel);
    if (!(await exists(fp))) continue;
    const text = await readTextSafe(fp);
    if (text) summaries.push({ path: rel, excerpt: text });
    seen.add(rel);
  }

  async function walkFiles(dir: string): Promise<void> {
    if (summaries.length >= MAX_TOTAL_SNIPPET_FILES) return;
    let entries: Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      if (summaries.length >= MAX_TOTAL_SNIPPET_FILES) return;
      const full = path.join(dir, ent.name);
      const rel = path.relative(repoDir, full);
      if (ent.isDirectory()) {
        if (SKIP_DIR.has(ent.name)) continue;
        await walkFiles(full);
        continue;
      }
      if (seen.has(rel)) continue;
      const ext = extOf(full);
      if (!TEXT_EXTENSIONS.has(ext)) continue;
      if (rel.includes('lock') && (rel.endsWith('.json') || rel.endsWith('.yaml'))) continue;
      const text = await readTextSafe(full);
      if (!text) continue;
      summaries.push({ path: rel, excerpt: text });
      seen.add(rel);
    }
  }

  await walkFiles(repoDir);
  return summaries;
}

export async function scanRepository(
  repoDir: string,
  repoUrl: string,
  parsed: ParsedGithubRepo,
): Promise<RepositoryMetadata> {
  const priorityFileSummaries = await collectSnippets(repoDir);
  const tree = await buildTreeSample(repoDir);

  let detected: DetectedSignals = {
    aiApis: [],
    features: [],
  };
  const pkgSummary = priorityFileSummaries.find((p) => p.path === 'package.json');
  if (pkgSummary) {
    detected = mergeDetected(detected, detectFromPackageJson(pkgSummary.excerpt));
  }
  if (!detected.features?.length) {
    detected.features = ['Repository analysis (auto)'];
  }

  let defaultBranch = 'main';
  const headPath = path.join(repoDir, '.git', 'HEAD');
  if (await exists(headPath)) {
    const head = await readTextSafe(headPath);
    const m = head?.match(/ref: refs\/heads\/(.+)/);
    if (m?.[1]) defaultBranch = m[1].trim();
  }

  return {
    repoUrl,
    parsed,
    defaultBranch,
    directoryTreeSample: tree,
    priorityFileSummaries,
    detected,
    scannedAt: new Date().toISOString(),
  };
}
