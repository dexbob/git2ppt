import { Loader2 } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { DetectedSignals, SlideDeckSpec } from '@lib/types';
import {
  PREVIEW_TAB_MESSAGES,
  readmeTabPhase,
  slidesTabPhase,
  techSpecTabPhase,
  type PreviewTabPhase,
} from '../lib/previewTabState';
import type { PipelineStep } from '../store/pipelineStore';
import { SimpleMarkdown } from '../utils/simpleMarkdown';
import { SlideDeckViewer } from './SlideDeckViewer';

type Tab = 'readme' | 'techSpec' | 'slides';

type Props = {
  step: PipelineStep;
  repoReadme: string | null;
  translatedReadme: string | null;
  techSpec: string | null;
  slideDeck: SlideDeckSpec | null;
  detected?: DetectedSignals | null;
};

const TABS: { id: Tab; label: string }[] = [
  { id: 'readme', label: 'README' },
  { id: 'techSpec', label: '기술명세서' },
  { id: 'slides', label: '슬라이드 프리뷰' },
];

/** 미리보기 본문 영역 고정 높이 (탭 전환 시에도 동일) */
const PREVIEW_CONTENT_CLASS = 'h-[36rem] overflow-y-auto overscroll-contain';

function DetectedChips({ detected }: { detected: DetectedSignals }) {
  const chips = [
    detected.frontend,
    detected.backend,
    detected.stateManagement,
    detected.deployment,
    detected.database,
    ...(detected.aiApis ?? []),
  ].filter(Boolean) as string[];

  if (!chips.length) return null;

  return (
    <div className="flex flex-wrap justify-center gap-2">
      {chips.map((chip) => (
        <span
          key={chip}
          className="rounded-full border border-slate-700 bg-slate-950/60 px-2.5 py-0.5 text-xs text-slate-400"
        >
          {chip}
        </span>
      ))}
    </div>
  );
}

function TabPanel({
  phase,
  messages,
  detected,
  children,
}: {
  phase: PreviewTabPhase;
  messages: { waiting: string; progress: string; empty: string };
  detected?: DetectedSignals | null;
  children?: ReactNode;
}) {
  if (phase === 'ready' && children) {
    return <div className="min-h-full">{children}</div>;
  }

  const text =
    phase === 'progress'
      ? messages.progress
      : phase === 'empty'
        ? messages.empty
        : messages.waiting;

  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-4 py-10 text-center">
      {phase === 'progress' && <Loader2 className="h-8 w-8 animate-spin text-accent-cyan" />}
      <p className="text-sm text-slate-400">{text}</p>
      {phase === 'progress' && detected && <DetectedChips detected={detected} />}
    </div>
  );
}

export function DocumentPreview({
  step,
  repoReadme,
  translatedReadme,
  techSpec,
  slideDeck,
  detected,
}: Props) {
  const [tab, setTab] = useState<Tab>('readme');
  const autoSwitched = useRef({
    repoReadme: false,
    translatedReadme: '',
    techSpec: '',
    slidesKey: '',
  });

  const readmeDisplay = translatedReadme?.trim() || repoReadme?.trim() || null;
  const readmeTranslating =
    step === 'readme' && Boolean(repoReadme?.trim()) && !translatedReadme?.trim();

  const readmePhase = readmeTabPhase(step, repoReadme, translatedReadme);
  const techSpecPhase = techSpecTabPhase(step, techSpec);
  const slidesPhase = slidesTabPhase(step, slideDeck);

  useEffect(() => {
    if (repoReadme?.trim() && !autoSwitched.current.repoReadme) {
      autoSwitched.current.repoReadme = true;
      setTab('readme');
    }
  }, [repoReadme]);

  useEffect(() => {
    const translated = translatedReadme?.trim() ?? '';
    if (translated && translated !== autoSwitched.current.translatedReadme) {
      autoSwitched.current.translatedReadme = translated;
      setTab('readme');
    }
  }, [translatedReadme]);

  useEffect(() => {
    const spec = techSpec?.trim() ?? '';
    if (spec && spec !== autoSwitched.current.techSpec) {
      autoSwitched.current.techSpec = spec;
      setTab('techSpec');
    }
  }, [techSpec]);

  useEffect(() => {
    const key =
      slideDeck?.slides?.length != null
        ? String(slideDeck.slides.length)
        : '';
    if (key && key !== autoSwitched.current.slidesKey) {
      autoSwitched.current.slidesKey = key;
      setTab('slides');
    }
  }, [slideDeck]);

  return (
    <section className="w-full space-y-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold text-slate-100">미리보기</h2>
        <div className="flex flex-wrap gap-1 rounded-xl border border-slate-800 bg-slate-950/50 p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                tab === t.id
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div
        className={`rounded-xl border border-slate-800/80 bg-slate-950/40 p-5 ${PREVIEW_CONTENT_CLASS}`}
      >
        {tab === 'readme' && (
          <>
            {readmeTranslating && (
              <p className="mb-3 flex items-center gap-2 rounded-lg border border-slate-700/80 bg-slate-900/60 px-3 py-2 text-xs text-slate-400">
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-accent-cyan" />
                {PREVIEW_TAB_MESSAGES.readme.translating}
              </p>
            )}
            <TabPanel
              phase={readmePhase}
              messages={PREVIEW_TAB_MESSAGES.readme}
              detected={detected}
            >
              {readmeDisplay && <SimpleMarkdown source={readmeDisplay} />}
            </TabPanel>
          </>
        )}
        {tab === 'techSpec' && (
          <TabPanel phase={techSpecPhase} messages={PREVIEW_TAB_MESSAGES.techSpec}>
            {techSpec?.trim() && <SimpleMarkdown source={techSpec} />}
          </TabPanel>
        )}
        {tab === 'slides' && (
          <TabPanel phase={slidesPhase} messages={PREVIEW_TAB_MESSAGES.slides}>
            {slideDeck && <SlideDeckViewer deck={slideDeck} />}
          </TabPanel>
        )}
      </div>
    </section>
  );
}
