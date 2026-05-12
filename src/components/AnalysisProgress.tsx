import { motion } from 'framer-motion';
import { CheckCircle2, Circle, Loader2 } from 'lucide-react';
import type { PipelineStep } from '../store/pipelineStore';

const STEPS: { id: PipelineStep; label: string }[] = [
  { id: 'analyzing', label: 'Clone / 스캔' },
  { id: 'spec', label: '기술명세서' },
  { id: 'slides', label: '슬라이드 / PPT' },
  { id: 'done', label: '완료' },
];

type Props = {
  step: PipelineStep;
};

function stepIndex(step: PipelineStep): number {
  if (step === 'idle' || step === 'error') return -1;
  if (step === 'done') return STEPS.length;
  const i = STEPS.findIndex((s) => s.id === step);
  return i >= 0 ? i : STEPS.length - 1;
}

export function AnalysisProgress({ step }: Props) {
  const active = stepIndex(step);
  const isError = step === 'error';

  return (
    <section className="w-full">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s, idx) => {
          const done = !isError && active > idx;
          const current = !isError && active === idx;
          return (
            <motion.div
              key={s.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className={`rounded-2xl border px-4 py-4 ${
                isError
                  ? 'border-red-500/40 bg-red-950/20'
                  : current
                    ? 'border-accent-cyan/60 bg-slate-900/80 shadow-lg shadow-accent-cyan/10'
                    : done
                      ? 'border-emerald-500/30 bg-slate-900/50'
                      : 'border-slate-800 bg-slate-950/40'
              }`}
            >
              <div className="flex items-center gap-2">
                {done ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                ) : current ? (
                  <Loader2 className="h-5 w-5 animate-spin text-accent-cyan" />
                ) : (
                  <Circle className="h-5 w-5 text-slate-600" />
                )}
                <span className="text-sm font-medium text-slate-200">{s.label}</span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
