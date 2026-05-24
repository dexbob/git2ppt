import { resolvePdfDetailMessage } from '@lib/pdfClientStatus';
import { FileArchive, FileCode2, FileText, FileType, Presentation } from 'lucide-react';
import { useState } from 'react';
import { downloadBase64File, downloadTextFile, downloadZipBundle } from '../utils/download';

type Props = {
  readme: string | null;
  techSpec: string | null;
  pptxBase64: string | null;
  pdfBase64: string | null;
  pdfAvailable: boolean;
  pdfError: string | null;
  pdfNote: string | null;
};

export function ResultDownloadCard({
  readme,
  techSpec,
  pptxBase64,
  pdfBase64,
  pdfAvailable,
  pdfError,
  pdfNote,
}: Props) {
  const [zipLoading, setZipLoading] = useState(false);
  const [zipError, setZipError] = useState<string | null>(null);

  const canZip = readme && techSpec && pptxBase64;

  const pdfDetailMessage = resolvePdfDetailMessage(pdfAvailable, pdfError, pdfNote);

  async function onZip() {
    if (!canZip) return;
    setZipLoading(true);
    setZipError(null);
    try {
      await downloadZipBundle({
        readmeMarkdown: readme,
        techSpecMarkdown: techSpec,
        pptxBase64,
        pdfBase64,
      });
    } catch (e) {
      setZipError(e instanceof Error ? e.message : 'ZIP 오류');
    } finally {
      setZipLoading(false);
    }
  }

  return (
    <section className="w-full space-y-4">
      <h2 className="text-lg font-semibold text-slate-100">다운로드</h2>
      {pdfDetailMessage && (
        <p
          className={`rounded-xl border px-4 py-3 text-sm leading-relaxed ${
            pdfError
              ? 'border-amber-500/35 bg-amber-950/25 text-amber-100'
              : 'border-slate-600/50 bg-slate-900/70 text-slate-300'
          }`}
        >
          {pdfDetailMessage}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          disabled={!readme}
          onClick={() => readme && downloadTextFile('README.md', readme, 'text/markdown;charset=utf-8')}
          className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-4 text-left transition hover:border-accent-violet/50 disabled:opacity-40"
        >
          <FileCode2 className="h-6 w-6 shrink-0 text-accent-violet" />
          <div>
            <div className="font-medium text-slate-100">README</div>
            <div className="text-xs text-slate-500">README.md</div>
          </div>
        </button>
        <button
          type="button"
          disabled={!techSpec}
          onClick={() =>
            techSpec && downloadTextFile('tech_spec.md', techSpec, 'text/markdown;charset=utf-8')
          }
          className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-4 text-left transition hover:border-accent-cyan/50 disabled:opacity-40"
        >
          <FileText className="h-6 w-6 shrink-0 text-accent-cyan" />
          <div>
            <div className="font-medium text-slate-100">기술명세서</div>
            <div className="text-xs text-slate-500">tech_spec.md</div>
          </div>
        </button>
        <button
          type="button"
          disabled={!pptxBase64}
          onClick={() =>
            pptxBase64 &&
            downloadBase64File(
              'slides.pptx',
              pptxBase64,
              'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            )
          }
          className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-4 text-left transition hover:border-accent-violet/50 disabled:opacity-40"
        >
          <Presentation className="h-6 w-6 shrink-0 text-accent-violet" />
          <div>
            <div className="font-medium text-slate-100">PPT</div>
            <div className="text-xs text-slate-500">slides.pptx</div>
          </div>
        </button>
        <button
          type="button"
          disabled={!pdfAvailable || !pdfBase64}
          onClick={() =>
            pdfBase64 &&
            downloadBase64File('slides.pdf', pdfBase64, 'application/pdf')
          }
          className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-4 text-left transition hover:border-accent-cyan/50 disabled:opacity-40"
        >
          <FileType className="h-6 w-6 shrink-0 text-accent-cyan" />
          <div>
            <div className="font-medium text-slate-100">PDF</div>
            <div className="text-xs text-slate-500">
              {pdfAvailable ? 'slides.pdf' : '이 환경에서는 미제공 · 위·아래 안내 참고'}
            </div>
          </div>
        </button>
      </div>
      <button
        type="button"
        disabled={!canZip || zipLoading}
        onClick={() => void onZip()}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-sm font-medium text-slate-100 transition hover:border-accent-violet/60 disabled:opacity-40"
      >
        <FileArchive className="h-5 w-5" />
        {zipLoading ? 'ZIP 준비 중…' : '전체 ZIP 다운로드'}
      </button>
      {zipError && <p className="text-sm text-red-400">{zipError}</p>}
    </section>
  );
}
