import { create } from 'zustand';
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
    const { repoUrl } = get();
    set({ step: 'analyzing', error: null, pdfError: null });
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
      }>('/api/generate-slides', {
        techSpecMarkdown: specRes.techSpecMarkdown,
        repoUrl: metadata.repoUrl,
      });
      set({
        slideDeck: slidesRes.slideDeck,
        pptxBase64: slidesRes.pptxBase64,
        pdfBase64: slidesRes.pdfBase64,
        pdfAvailable: slidesRes.pdfAvailable,
        pdfError: slidesRes.pdfError ?? null,
        step: 'done',
      });
    } catch (e) {
      set({
        step: 'error',
        error: e instanceof Error ? e.message : '알 수 없는 오류',
      });
    }
  },
}));
