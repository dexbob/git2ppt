import type { SlideDeckSpec } from '@lib/types';
import type { PipelineStep } from '../store/pipelineStore';

export type PreviewTabPhase = 'waiting' | 'progress' | 'ready' | 'empty';

export function readmeTabPhase(
  step: PipelineStep,
  repoReadme: string | null,
  translatedReadme: string | null,
): PreviewTabPhase {
  if (translatedReadme?.trim() || repoReadme?.trim()) return 'ready';
  if (step === 'analyzing' || step === 'readme') return 'progress';
  if (step === 'idle') return 'waiting';
  return 'empty';
}

export function techSpecTabPhase(step: PipelineStep, techSpec: string | null): PreviewTabPhase {
  if (techSpec?.trim()) return 'ready';
  if (step === 'spec') return 'progress';
  return 'waiting';
}

export function slidesTabPhase(step: PipelineStep, slideDeck: SlideDeckSpec | null): PreviewTabPhase {
  if (slideDeck?.slides?.length) return 'ready';
  if (step === 'slides') return 'progress';
  return 'waiting';
}

export const PREVIEW_TAB_MESSAGES = {
  readme: {
    waiting: '대기 중…',
    progress: '저장소를 분석하며 README를 가져오는 중…',
    translating: 'README를 한국어로 번역하는 중…',
    empty: '이 저장소에는 README.md 파일이 없습니다.',
  },
  techSpec: {
    waiting: '대기 중…',
    progress: '기술명세서를 생성하는 중…',
    empty: '기술명세서를 생성하지 못했습니다.',
  },
  slides: {
    waiting: '대기 중…',
    progress: '슬라이드 프리뷰를 생성하는 중…',
    empty: '슬라이드 프리뷰를 생성하지 못했습니다.',
  },
} as const;
