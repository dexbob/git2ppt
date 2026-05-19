import { motion } from 'framer-motion';
import { Github } from 'lucide-react';
import { AnalysisProgress } from '../components/AnalysisProgress';
import { DocumentPreview } from '../components/DocumentPreview';
import { RepositoryInput } from '../components/RepositoryInput';
import { ResultDownloadCard } from '../components/ResultDownloadCard';
import { SlidePreview } from '../components/SlidePreview';
import { usePipelineStore } from '../store/pipelineStore';

export function HomePage() {
  const {
    repoUrl,
    step,
    error,
    metadata,
    techSpecMarkdown,
    readmeMarkdown,
    pptxBase64,
    pdfBase64,
    pdfAvailable,
    pdfError,
    pdfNote,
    slideDeck,
    setRepoUrl,
    runPipeline,
    reset,
  } = usePipelineStore();

  const busy = step === 'analyzing' || step === 'spec' || step === 'slides';

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(124,58,237,0.18),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(6,182,212,0.15),transparent_40%)]" />
      <main className="relative mx-auto flex max-w-5xl flex-col gap-12 px-4 py-16 sm:px-8">
        <header className="space-y-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/60 px-3 py-1 text-xs text-slate-400"
          >
            <Github className="h-4 w-4" />
            Git → 기술명세서 → 발표 자료
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="text-balance text-4xl font-bold tracking-tight text-white sm:text-5xl"
          >
            Git Repository
            <span className="bg-gradient-to-r from-accent-violet to-accent-cyan bg-clip-text text-transparent">
              {' '}
              Presentation Generator
            </span>
          </motion.h1>
          <p className="mx-auto max-w-3xl text-pretty text-slate-400">
            GitHub 저장소 URL 하나로 분석, 기술명세서, 슬라이드(PPT/PDF)까지 자동 생성합니다.
          </p>
        </header>

        <div className="mx-auto flex w-full max-w-3xl flex-col gap-10">
          <RepositoryInput
            value={repoUrl}
            onChange={setRepoUrl}
            onSubmit={() => void runPipeline()}
            disabled={busy}
          />

          {step !== 'idle' && <AnalysisProgress step={step} />}

          {error && (
            <div className="w-full space-y-3 rounded-xl border border-red-500/40 bg-red-950/30 px-4 py-3 text-sm text-red-200">
              <p className="break-words">{error}</p>
              {step === 'error' && (
                <button
                  type="button"
                  onClick={() => void runPipeline()}
                  className="rounded-lg border border-red-400/40 bg-red-950/50 px-3 py-1.5 text-xs font-medium text-red-100 transition hover:bg-red-900/60"
                >
                  다시 시도
                </button>
              )}
            </div>
          )}

          {(step === 'spec' || step === 'slides' || step === 'done') && (
            <DocumentPreview
              readme={readmeMarkdown}
              techSpec={techSpecMarkdown}
              loading={step === 'spec'}
              detected={metadata?.detected}
            />
          )}

          <SlidePreview deck={slideDeck} ready={step === 'done'} />

          {step === 'done' && (
            <ResultDownloadCard
              readme={readmeMarkdown}
              techSpec={techSpecMarkdown}
              pptxBase64={pptxBase64}
              pdfBase64={pdfBase64}
              pdfAvailable={pdfAvailable}
              pdfError={pdfError}
              pdfNote={pdfNote}
            />
          )}
        </div>

        {(step === 'done' || step === 'error') && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => reset()}
              className="text-sm text-slate-500 underline-offset-4 hover:text-slate-300 hover:underline"
            >
              초기화
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
