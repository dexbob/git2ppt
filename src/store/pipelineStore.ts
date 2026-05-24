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

type State = {
  repoUrl: string;
  step: PipelineStep;
  error: string | null;
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
  error: null as string | null,
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

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok) {
    throw new Error(data.error ?? `요청 실패 (${res.status})`);
  }
  return data as T;
}

function stepErrorHint(step: PipelineStep): string {
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

export const usePipelineStore = create<State>((set, get) => ({
  ...initial,
  setRepoUrl: (v) => set({ repoUrl: v }),
  reset: () => set({ ...initial }),
  runPipeline: async () => {
    const { repoUrl, step } = get();
    if (busySteps.includes(step)) {
      return;
    }
    if (!repoUrl.trim()) return;
    set({
      step: 'analyzing',
      error: null,
      pdfError: null,
      pdfNote: null,
      metadata: null,
      techSpecMarkdown: null,
      repoReadmeMarkdown: null,
      readmeMarkdown: null,
      slideDeck: null,
      pptxBase64: null,
      pdfBase64: null,
      pdfAvailable: false,
    });
    try {
      const { metadata } = await postJson<{ metadata: RepositoryMetadata }>('/api/analyze-repo', {
        url: repoUrl.trim(),
      });
      const rawReadme = extractRepoReadme(metadata);
      const repoReadmeMarkdown = rawReadme
        ? resolveReadmeAssetUrls(rawReadme, metadata)
        : null;
      set({ metadata, repoReadmeMarkdown });

      let readmeMarkdown: string | null = null;
      if (repoReadmeMarkdown) {
        set({ step: 'readme' });
        const translateRes = await postJson<{ readmeMarkdown: string }>('/api/translate-readme', {
          sourceMarkdown: repoReadmeMarkdown,
        });
        readmeMarkdown = resolveReadmeAssetUrls(translateRes.readmeMarkdown, metadata);
        set({ readmeMarkdown });
      }

      set({ step: 'spec' });
      const specRes = await postJson<{ techSpecMarkdown: string }>('/api/generate-spec', {
        metadata,
      });
      set({ techSpecMarkdown: specRes.techSpecMarkdown, step: 'slides' });

      const slidesRes = await postJson<{
        slideDeck: SlideDeckSpec;
        pptxBase64: string;
        pdfBase64: string | null;
        pdfAvailable: boolean;
        pdfError?: string | null;
        pdfNote?: string | null;
      }>('/api/generate-slides', {
        techSpecMarkdown: specRes.techSpecMarkdown,
        repoUrl: metadata.repoUrl,
        readmeMarkdown: readmeMarkdown ?? repoReadmeMarkdown,
        ownerDisplayName: metadata.ownerDisplayName,
        detected: metadata.detected,
        githubTopics: metadata.githubTopics,
      });
      set({
        slideDeck: slidesRes.slideDeck,
        pptxBase64: slidesRes.pptxBase64,
        pdfBase64: slidesRes.pdfBase64,
        pdfAvailable: slidesRes.pdfAvailable,
        pdfError: slidesRes.pdfError ?? null,
        pdfNote: slidesRes.pdfNote ?? null,
        step: 'done',
      });
    } catch (e) {
      const failedStep = get().step;
      const stepHint = stepErrorHint(failedStep);
      const base = formatUserFacingError(e, '알 수 없는 오류가 발생했습니다.');
      const error =
        stepHint && !base.includes(stepHint) ? `${stepHint} 단계: ${base}` : base;
      set({
        step: 'error',
        error,
      });
    }
  },
}));

export function isPipelineBusy(step: PipelineStep): boolean {
  return busySteps.includes(step);
}
