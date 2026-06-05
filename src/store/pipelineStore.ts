import { create } from 'zustand';
import { extractRepoReadme } from '@lib/extractRepoReadme';
import { formatUserFacingError } from '@lib/formatUserFacingError';
import { resolveReadmeAssetUrls } from '@lib/resolveReadmeAssetUrls';
import type { RepositoryMetadata, SlideDeckSpec } from '@lib/types';

export type PipelineStep =
  | 'idle'
  | 'analyzing'
  | 'readme'
  | 'spec'
  | 'slides'
  | 'done'
  | 'error';

/** 파이프라인 실제 작업 단계 (PDF 제외) */
export type PipelineWorkStep = 'analyzing' | 'readme' | 'spec' | 'slides';

type State = {
  repoUrl: string;
  step: PipelineStep;
  /** 마지막 실패한 작업 단계 — error일 때 재개 지점 */
  failedStep: PipelineWorkStep | null;
  /** 현재 산출물이 대응하는 저장소 URL (URL 변경 시 전체 재시작) */
  pipelineRepoUrl: string | null;
  error: string | null;
  /** 일시적 오류로 재시도 진행 중일 때 사용자에게 노출할 정보성 메시지 */
  infoMessage: string | null;
  metadata: RepositoryMetadata | null;
  techSpecMarkdown: string | null;
  /** 저장소 원본 README — 복제 직후 미리보기 */
  repoReadmeMarkdown: string | null;
  /** 원문 README 한국어 번역본 — 다운로드·표지 */
  readmeMarkdown: string | null;
  pptxBase64: string | null;
  pdfBase64: string | null;
  pdfAvailable: boolean;
  pdfError: string | null;
  pdfNote: string | null;
  slideDeck: SlideDeckSpec | null;
  setRepoUrl: (v: string) => void;
  reset: () => void;
  runPipeline: () => Promise<void>;
};

const initial = {
  repoUrl: '',
  step: 'idle' as PipelineStep,
  failedStep: null as PipelineWorkStep | null,
  pipelineRepoUrl: null as string | null,
  error: null as string | null,
  infoMessage: null as string | null,
  metadata: null as RepositoryMetadata | null,
  techSpecMarkdown: null as string | null,
  repoReadmeMarkdown: null as string | null,
  readmeMarkdown: null as string | null,
  pptxBase64: null as string | null,
  pdfBase64: null as string | null,
  pdfAvailable: false,
  pdfError: null as string | null,
  pdfNote: null as string | null,
  slideDeck: null as SlideDeckSpec | null,
};

const busySteps: PipelineStep[] = ['analyzing', 'readme', 'spec', 'slides'];

async function postJsonWithRetry<T>(
  path: string,
  body: unknown,
  stepLabel: string,
  set: (state: Partial<State>) => void,
): Promise<T> {
  const retries = 3;
  let backoffMs = 1500;
  const factor = 2;

  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string } & T;
      if (!res.ok) {
        throw new Error(data.error ?? `요청 실패 (${res.status})`);
      }
      set({ infoMessage: null });
      return data as T;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err ?? '');
      const isTransient = /502|503|504|rate limit|quota|exhausted|overloaded|high demand|timeout|timed out|ETIMEDOUT|ECONNRESET/i.test(errMsg);

      if (attempt > retries || !isTransient) {
        set({ infoMessage: null });
        throw err;
      }

      const countdownSec = Math.round(backoffMs / 1000);
      set({
        infoMessage: `[${stepLabel}] AI 서비스 사용량 혼잡 등으로 인해 ${countdownSec}초 후 자동으로 다시 시도합니다... (시도 ${attempt}/${retries})`,
      });

      await new Promise((resolve) => setTimeout(resolve, backoffMs));
      backoffMs *= factor;
    }
  }
  throw new Error('재시도 한도를 초과했습니다.');
}

function stepErrorHint(step: PipelineWorkStep): string {
  switch (step) {
    case 'analyzing':
      return '저장소 분석';
    case 'readme':
      return 'README 번역';
    case 'spec':
      return '기술명세서 생성';
    case 'slides':
      return '슬라이드 생성';
    default:
      return '';
  }
}

export function resumeStepLabel(step: PipelineWorkStep): string {
  switch (step) {
    case 'analyzing':
      return '저장소 분석부터';
    case 'readme':
      return 'README 번역부터';
    case 'spec':
      return '기술명세서 생성부터';
    case 'slides':
      return '슬라이드 생성부터';
    default:
      return '실패 지점부터';
  }
}

function stripMarkdownNoise(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[#>*_\-\[\]()]/g, ' ');
}

/** README가 이미 한국어인지 가볍게 판별한다. */
function isLikelyKoreanReadme(markdown: string): boolean {
  const text = stripMarkdownNoise(markdown);
  const hangul = (text.match(/[가-힣]/g) ?? []).length;
  const latin = (text.match(/[A-Za-z]/g) ?? []).length;
  if (hangul < 40) return false;
  if (latin === 0) return true;
  return hangul / (hangul + latin) >= 0.35;
}

function needsReadmeTranslation(repoReadmeMarkdown: string | null): boolean {
  if (!repoReadmeMarkdown?.trim()) return false;
  return !isLikelyKoreanReadme(repoReadmeMarkdown);
}

/** error 상태에서 재개할 작업 단계 결정 */
function resolveResumeFrom(state: State, trimmedUrl: string): PipelineWorkStep {
  if (state.step !== 'error' || !state.failedStep) {
    return 'analyzing';
  }
  if (!state.metadata || state.pipelineRepoUrl !== trimmedUrl) {
    return 'analyzing';
  }
  if (needsReadmeTranslation(state.repoReadmeMarkdown) && !state.readmeMarkdown) {
    return 'readme';
  }
  if (state.failedStep === 'slides' && state.techSpecMarkdown) {
    return 'slides';
  }
  if (state.failedStep === 'spec' || state.failedStep === 'slides') {
    return state.techSpecMarkdown ? 'slides' : 'spec';
  }
  if (state.failedStep === 'readme') {
    return 'readme';
  }
  return 'analyzing';
}

/** 재개 지점부터 다시 만들 산출물만 초기화 */
function downstreamClear(from: PipelineWorkStep): Partial<State> {
  switch (from) {
    case 'analyzing':
      return {
        metadata: null,
        repoReadmeMarkdown: null,
        readmeMarkdown: null,
        techSpecMarkdown: null,
        slideDeck: null,
        pptxBase64: null,
        pdfBase64: null,
        pdfAvailable: false,
        pdfError: null,
        pdfNote: null,
      };
    case 'readme':
      return {
        readmeMarkdown: null,
        techSpecMarkdown: null,
        slideDeck: null,
        pptxBase64: null,
        pdfBase64: null,
        pdfAvailable: false,
        pdfError: null,
        pdfNote: null,
      };
    case 'spec':
      return {
        techSpecMarkdown: null,
        slideDeck: null,
        pptxBase64: null,
        pdfBase64: null,
        pdfAvailable: false,
        pdfError: null,
        pdfNote: null,
      };
    case 'slides':
      return {
        slideDeck: null,
        pptxBase64: null,
        pdfBase64: null,
        pdfAvailable: false,
        pdfError: null,
        pdfNote: null,
      };
  }
}

export const usePipelineStore = create<State>((set, get) => ({
  ...initial,
  setRepoUrl: (v) => set({ repoUrl: v }),
  reset: () => set({ ...initial }),
  runPipeline: async () => {
    const state = get();
    if (busySteps.includes(state.step)) {
      return;
    }
    const trimmedUrl = state.repoUrl.trim();
    if (!trimmedUrl) return;

    const resumeFrom = resolveResumeFrom(state, trimmedUrl);
    const isFreshRun = state.step === 'idle' || state.step === 'done';

    set({
      step: resumeFrom,
      error: null,
      failedStep: null,
      pipelineRepoUrl: trimmedUrl,
      ...downstreamClear(resumeFrom),
      ...(isFreshRun && resumeFrom === 'analyzing'
        ? {
            pdfError: null,
            pdfNote: null,
          }
        : {}),
    });

    try {
      let { metadata, repoReadmeMarkdown, readmeMarkdown, techSpecMarkdown } = get();

      if (resumeFrom === 'analyzing' || !metadata) {
        set({ step: 'analyzing', infoMessage: null });
        const { metadata: analyzed } = await postJsonWithRetry<{ metadata: RepositoryMetadata }>(
          '/api/analyze-repo',
          { url: trimmedUrl },
          '저장소 분석',
          set,
        );
        const rawReadme = extractRepoReadme(analyzed);
        metadata = analyzed;
        repoReadmeMarkdown = rawReadme ? resolveReadmeAssetUrls(rawReadme, analyzed) : null;
        set({ metadata, repoReadmeMarkdown });
      }

      if (needsReadmeTranslation(repoReadmeMarkdown)) {
        if (resumeFrom === 'analyzing' || resumeFrom === 'readme') {
          set({ step: 'readme', infoMessage: null });
          const translateRes = await postJsonWithRetry<{ readmeMarkdown: string }>(
            '/api/translate-readme',
            { sourceMarkdown: repoReadmeMarkdown! },
            'README 번역',
            set,
          );
          readmeMarkdown = resolveReadmeAssetUrls(translateRes.readmeMarkdown, metadata!);
          set({ readmeMarkdown });
        }
      } else if (repoReadmeMarkdown?.trim() && !readmeMarkdown) {
        // 이미 한국어 README인 경우 번역 단계를 건너뛰고 원문을 그대로 사용한다.
        readmeMarkdown = repoReadmeMarkdown;
        set({ readmeMarkdown });
      }

      if (resumeFrom === 'analyzing' || resumeFrom === 'readme' || resumeFrom === 'spec') {
        set({ step: 'spec', infoMessage: null });
        const specRes = await postJsonWithRetry<{ techSpecMarkdown: string }>(
          '/api/generate-spec',
          { metadata: metadata! },
          '기술명세서 생성',
          set,
        );
        techSpecMarkdown = specRes.techSpecMarkdown;
        set({ techSpecMarkdown });
      }

      set({ step: 'slides', infoMessage: null });
      const slidesRes = await postJsonWithRetry<{
        slideDeck: SlideDeckSpec;
        pptxBase64: string;
        pdfBase64: string | null;
        pdfAvailable: boolean;
        pdfError?: string | null;
      }>(
        '/api/generate-slides',
        {
          techSpecMarkdown: techSpecMarkdown ?? get().techSpecMarkdown!,
          repoUrl: metadata!.repoUrl,
          readmeMarkdown: readmeMarkdown ?? repoReadmeMarkdown,
          ownerDisplayName: metadata!.ownerDisplayName,
          detected: metadata!.detected,
          githubTopics: metadata!.githubTopics,
        },
        '슬라이드 생성',
        set,
      );
      set({
        slideDeck: slidesRes.slideDeck,
        pptxBase64: slidesRes.pptxBase64,
        pdfBase64: slidesRes.pdfBase64,
        pdfAvailable: slidesRes.pdfAvailable,
        pdfError: slidesRes.pdfError ?? null,
        pdfNote: null,
        step: 'done',
      });
    } catch (e) {
      const failedStep = get().step;
      const workFailed =
        failedStep === 'analyzing' ||
        failedStep === 'readme' ||
        failedStep === 'spec' ||
        failedStep === 'slides'
          ? failedStep
          : 'analyzing';
      const stepHint = stepErrorHint(workFailed);
      const base = formatUserFacingError(e, '알 수 없는 오류가 발생했습니다.');
      const error =
        stepHint && !base.includes(stepHint) ? `${stepHint} 단계: ${base}` : base;
      set({
        step: 'error',
        failedStep: workFailed,
        error,
        infoMessage: null,
      });
    }
  },
}));

export function isPipelineBusy(step: PipelineStep): boolean {
  return busySteps.includes(step);
}
