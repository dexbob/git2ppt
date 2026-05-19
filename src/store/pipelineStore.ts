import { create } from 'zustand';
import { formatUserFacingError } from '@lib/formatUserFacingError';
import type { RepositoryMetadata, SlideDeckSpec } from '@lib/types';

export type PipelineStep =
  | 'idle'
  | 'analyzing'
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
  readmeMarkdown: null as string | null,
  pptxBase64: null as string | null,
  pdfBase64: null as string | null,
  pdfAvailable: false,
  pdfError: null as string | null,
  pdfNote: null as string | null,
  slideDeck: null as SlideDeckSpec | null,
};

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

export const usePipelineStore = create<State>((set, get) => ({
  ...initial,
  setRepoUrl: (v) => set({ repoUrl: v }),
  reset: () => set({ ...initial }),
  runPipeline: async () => {
    const { repoUrl, step } = get();
    if (step === 'analyzing' || step === 'spec' || step === 'slides') {
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
      set({ metadata, step: 'spec' });

      const specRes = await postJson<{ techSpecMarkdown: string; readmeMarkdown: string }>(
        '/api/generate-spec',
        { metadata },
      );
      set({
        techSpecMarkdown: specRes.techSpecMarkdown,
        readmeMarkdown: specRes.readmeMarkdown,
        step: 'slides',
      });

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
        readmeMarkdown: specRes.readmeMarkdown,
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
      set({
        step: 'error',
        error: formatUserFacingError(e, '알 수 없는 오류가 발생했습니다.'),
      });
    }
  },
}));
