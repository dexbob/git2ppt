import { motion } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Loader2,
  XCircle,
} from 'lucide-react';
import {
  resolvePdfDetailMessage,
  resolvePdfOutcome,
  resolvePdfSummaryMessage,
  type PdfOutcome,
} from '@lib/pdfClientStatus';
import type { PipelineStep } from '../store/pipelineStore';

type StepKey = 'analyzing' | 'readme' | 'spec' | 'slides-ppt' | 'slides-pdf';

const STEPS: { key: StepKey; label: string }[] = [
  { key: 'analyzing', label: 'Clone / 스캔' },
  { key: 'readme', label: 'README' },
  { key: 'spec', label: '기술명세서' },
  { key: 'slides-ppt', label: 'PPT' },
  { key: 'slides-pdf', label: 'PDF' },
];

type Props = {
  step: PipelineStep;
  hasRepoReadme: boolean;
  pdfAvailable: boolean;
  pdfError: string | null;
  pdfNote: string | null;
};

function pipelineActiveIndex(step: PipelineStep): number {
  if (step === 'idle' || step === 'error') return -1;
  if (step === 'analyzing') return 0;
  if (step === 'readme') return 1;
  if (step === 'spec') return 2;
  if (step === 'slides') return 3;
  if (step === 'done') return 5;
  return -1;
}

type CardVisual =
  | 'pending'
  | 'current'
  | 'done'
  | 'skipped'
  | 'pdf_done'
  | 'pdf_skipped'
  | 'pdf_failed';

function cardVisual(
  idx: number,
  step: PipelineStep,
  active: number,
  pdfOutcome: PdfOutcome,
  readmeSkipped: boolean,
): CardVisual {
  if (step === 'error') return idx < active ? 'done' : 'pending';

  if (idx === 1 && readmeSkipped && active > 1) return 'skipped';

  if (idx < 3) {
    if (active > idx) return 'done';
    if (active === idx) return 'current';
    return 'pending';
  }

  if (idx === 3) {
    if (active > 3) return 'done';
    if (active === 3) return 'current';
    return 'pending';
  }

  if (active < 4) return 'pending';
  if (step === 'slides') return 'pending';
  if (pdfOutcome === 'available') return 'pdf_done';
  if (pdfOutcome === 'conversion_failed') return 'pdf_failed';
  return 'pdf_skipped';
}

function cardClass(visual: CardVisual, pipelineError: boolean): string {
  if (pipelineError) return 'border-red-500/40 bg-red-950/20';
  switch (visual) {
    case 'current':
      return 'border-accent-cyan/60 bg-slate-900/80 shadow-lg shadow-accent-cyan/10';
    case 'done':
    case 'pdf_done':
      return 'border-emerald-500/30 bg-slate-900/50';
    case 'skipped':
    case 'pdf_skipped':
      return 'border-amber-500/40 bg-amber-950/20';
    case 'pdf_failed':
      return 'border-amber-500/45 bg-amber-950/25';
    default:
      return 'border-slate-800 bg-slate-950/40';
  }
}

function StepIcon({ visual }: { visual: CardVisual }) {
  switch (visual) {
    case 'done':
    case 'pdf_done':
      return <CheckCircle2 className="h-5 w-5 text-emerald-400" />;
    case 'current':
      return <Loader2 className="h-5 w-5 animate-spin text-accent-cyan" />;
    case 'skipped':
    case 'pdf_skipped':
      return <AlertTriangle className="h-5 w-5 text-amber-400" />;
    case 'pdf_failed':
      return <XCircle className="h-5 w-5 text-amber-400" />;
    default:
      return <Circle className="h-5 w-5 text-slate-600" />;
  }
}

export function AnalysisProgress({
  step,
  hasRepoReadme,
  pdfAvailable,
  pdfError,
  pdfNote,
}: Props) {
  const active = pipelineActiveIndex(step);
  const isPipelineError = step === 'error';
  const readmeSkipped = !hasRepoReadme && active > 1;
  const pdfOutcome = resolvePdfOutcome(pdfAvailable, pdfError);
  const pdfSummary = resolvePdfSummaryMessage(pdfAvailable, pdfError, pdfNote);
  const pdfDetail = resolvePdfDetailMessage(pdfAvailable, pdfError, pdfNote);
  const showPdfBanner = step === 'done' && pdfOutcome !== 'available' && pdfSummary;

  return (
    <section className="w-full space-y-3">
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        {STEPS.map((s, idx) => {
          const visual = cardVisual(idx, step, active, pdfOutcome, readmeSkipped);
          return (
            <motion.div
              key={s.key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className={`rounded-2xl border px-4 py-4 ${cardClass(visual, isPipelineError)}`}
            >
              <div className="flex items-center gap-2">
                <StepIcon visual={visual} />
                <span className="text-sm font-medium text-slate-200">{s.label}</span>
              </div>
            </motion.div>
          );
        })}
      </div>

      {showPdfBanner && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-xl border px-4 py-3 text-sm leading-relaxed ${
            pdfOutcome === 'conversion_failed'
              ? 'border-amber-500/35 bg-amber-950/25 text-amber-100'
              : 'border-amber-500/30 bg-amber-950/20 text-amber-100/95'
          }`}
        >
          <p className="font-medium">
            {pdfOutcome === 'conversion_failed'
              ? 'PDF 변환에 실패했습니다'
              : 'PDF는 이 환경에서 제공되지 않습니다'}
          </p>
          <p className="mt-1 text-amber-100/90">{pdfSummary}</p>
          {pdfDetail && pdfDetail !== pdfSummary && (
            <p className="mt-2 text-xs text-slate-400">자세한 안내는 아래 다운로드 섹션을 참고하세요.</p>
          )}
        </motion.div>
      )}
    </section>
  );
}
