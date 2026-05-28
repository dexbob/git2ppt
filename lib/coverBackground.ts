import { createHash, randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, unlink } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DetectedSignals } from './types.js';

export type CoverBgCategory =
  | 'security'
  | 'web'
  | 'backend'
  | 'ai'
  | 'infra'
  | 'mobile'
  | 'data'
  | 'general';

export type CoverBackgroundResult = {
  path: string;
  source: 'dynamic' | 'template';
  category: CoverBgCategory;
};

const DYNAMIC_TIMEOUT_MS = 3000;
const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TEMPLATE_DIR = resolve(PROJECT_ROOT, 'public', 'cover-bg');
const LEGACY_COVER_BG = resolve(PROJECT_ROOT, 'public', 'cover-right-bg.png');
const RENDER_SCRIPT = resolve(PROJECT_ROOT, 'scripts', 'render_cover_bg.py');

function hashSeed(input: string): number {
  const hex = createHash('sha256').update(input).digest('hex').slice(0, 8);
  return Number.parseInt(hex, 16);
}

/** 저장소 신호·토픽으로 표지 배경 카테고리 분류 */
export function classifyCoverCategory(
  detected?: DetectedSignals | null,
  githubTopics: string[] = [],
): CoverBgCategory {
  const blob = [
    detected?.frontend ?? '',
    detected?.backend ?? '',
    detected?.deployment ?? '',
    detected?.database ?? '',
    ...(detected?.aiApis ?? []),
    ...(detected?.features ?? []),
    ...githubTopics,
  ]
    .join(' ')
    .toLowerCase();

  if (/\bosint\b|security|cyber|investigation|blueteam|pentest/.test(blob)) return 'security';
  if (/\bopenai\b|\bgemini\b|\bllm\b|\bai\b|machine.?learning|pytorch|tensorflow/.test(blob))
    return 'ai';
  if (/docker|kubernetes|k8s|terraform|ansible|devops|deploy|ci\/cd|helm/.test(blob))
    return 'infra';
  if (/react.?native|flutter|ios\b|android|mobile|expo/.test(blob)) return 'mobile';
  if (/postgres|mysql|mongo|redis|database|analytics|data.?warehouse|spark/.test(blob))
    return 'data';
  if (/react|vue|svelte|next\.?js|nuxt|frontend|vite|tailwind/.test(blob)) return 'web';
  if (/express|fastapi|django|spring|nestjs|backend|graphql|api\b/.test(blob)) return 'backend';
  return 'general';
}

export function templateCoverPath(category: CoverBgCategory): string {
  const primary = resolve(TEMPLATE_DIR, `${category}.png`);
  if (existsSync(primary)) return primary;
  const general = resolve(TEMPLATE_DIR, 'general.png');
  if (existsSync(general)) return general;
  if (existsSync(LEGACY_COVER_BG)) return LEGACY_COVER_BG;
  return primary;
}

export function secondaryTemplateCoverPath(category: CoverBgCategory): string {
  const fallbackByCategory: Record<CoverBgCategory, CoverBgCategory> = {
    security: 'ai',
    ai: 'security',
    web: 'infra',
    infra: 'web',
    backend: 'data',
    data: 'backend',
    mobile: 'general',
    general: 'security',
  };
  return templateCoverPath(fallbackByCategory[category]);
}

function runPythonRender(args: string[], timeoutMs: number): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn('python3', [RENDER_SCRIPT, ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`cover background render timeout (${timeoutMs}ms)`));
    }, timeoutMs);

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      const out = stdout.trim();
      if (code !== 0 || !out) {
        reject(new Error(stderr.trim() || `render script exited with code ${code ?? 'unknown'}`));
        return;
      }
      if (!existsSync(out)) {
        reject(new Error(`render script output missing: ${out}`));
        return;
      }
      resolvePromise(out);
    });
  });
}

async function tryDynamicCover(
  category: CoverBgCategory,
  repoUrl: string,
  projectName?: string,
): Promise<string | null> {
  if (!existsSync(RENDER_SCRIPT)) return null;

  // 같은 저장소라도 매 실행마다 배경이 변형되도록 랜덤 salt를 섞는다.
  const baseSeed = hashSeed(`${repoUrl}|${projectName ?? ''}|${category}`);
  const runSalt = randomBytes(4).readUInt32BE(0);
  const seed = (baseSeed ^ runSalt) >>> 0;
  const outPath = resolve(TEMPLATE_DIR, `.tmp-${seed.toString(16)}.png`);
  await mkdir(TEMPLATE_DIR, { recursive: true });

  try {
    const rendered = await runPythonRender(
      ['--mode', 'dynamic', '--category', category, '--seed', String(seed), '--out', outPath],
      DYNAMIC_TIMEOUT_MS,
    );
    return rendered;
  } catch {
    try {
      await unlink(outPath);
    } catch {
      /* ignore */
    }
    return null;
  }
}

/**
 * 표지 배경: 저장소 맞춤 동적 생성 시도 → 실패/지연 시 카테고리 템플릿.
 * (환경변수 ON/OFF 없음 — 항상 자동)
 */
export async function resolveCoverBackgroundPath(input: {
  repoUrl: string;
  projectName?: string;
  detected?: DetectedSignals | null;
  githubTopics?: string[];
}): Promise<CoverBackgroundResult> {
  const category = classifyCoverCategory(input.detected, input.githubTopics ?? []);
  const dynamic = await tryDynamicCover(category, input.repoUrl, input.projectName);
  if (dynamic) {
    return { path: dynamic, source: 'dynamic', category };
  }
  const templatePath = templateCoverPath(category);
  return {
    path: templatePath,
    source: 'template',
    category,
  };
}

export async function cleanupDynamicCoverPath(result: CoverBackgroundResult): Promise<void> {
  if (result.source !== 'dynamic') return;
  try {
    await unlink(result.path);
  } catch {
    /* ignore */
  }
}
