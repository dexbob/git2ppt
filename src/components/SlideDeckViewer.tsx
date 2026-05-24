import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import type { SlideDeckSpec, SlideSpec } from '@lib/types';

function slideLabel(slide: SlideSpec): string {
  switch (slide.type) {
    case 'cover':
      return slide.projectName || '표지';
    case 'bullets':
    case 'cards':
    case 'flow':
      return slide.title;
    case 'closing':
      return '마무리';
    default:
      return '슬라이드';
  }
}

function SlideFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[14rem] flex-col justify-center rounded-xl border border-slate-700/80 bg-gradient-to-br from-slate-900 to-slate-950 p-6 sm:min-h-[16rem] sm:p-8">
      {children}
    </div>
  );
}

function SlideContent({ slide }: { slide: SlideSpec }) {
  switch (slide.type) {
    case 'cover':
      return (
        <SlideFrame>
          <p className="text-xs font-medium uppercase tracking-wider text-accent-cyan">표지</p>
          <h3 className="mt-2 text-balance text-2xl font-bold text-white sm:text-3xl">
            {slide.projectName}
          </h3>
          <p className="mt-3 text-pretty text-sm leading-relaxed text-slate-300 sm:text-base">
            {slide.tagline}
          </p>
          <p className="mt-4 truncate text-xs text-slate-500">{slide.repoUrl}</p>
        </SlideFrame>
      );
    case 'bullets':
      return (
        <SlideFrame>
          <h3 className="text-balance text-xl font-semibold text-white sm:text-2xl">{slide.title}</h3>
          <ul className="mt-4 space-y-2 text-sm text-slate-300 sm:text-base">
            {slide.bullets.map((b, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-accent-violet">•</span>
                <span className="min-w-0 flex-1">{b}</span>
              </li>
            ))}
          </ul>
        </SlideFrame>
      );
    case 'cards':
      return (
        <SlideFrame>
          <h3 className="text-balance text-xl font-semibold text-white sm:text-2xl">{slide.title}</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {slide.cards.map((c, i) => (
              <div
                key={i}
                className="rounded-lg border border-slate-700/80 bg-slate-950/60 p-3"
              >
                <p className="font-medium text-accent-cyan">{c.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-slate-400">{c.body}</p>
              </div>
            ))}
          </div>
        </SlideFrame>
      );
    case 'flow':
      return (
        <SlideFrame>
          <h3 className="text-balance text-xl font-semibold text-white sm:text-2xl">{slide.title}</h3>
          <ol className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            {slide.steps.map((step, i) => (
              <li key={i} className="flex min-w-0 items-center gap-2 text-sm text-slate-300 sm:text-base">
                {i > 0 && (
                  <span className="hidden text-slate-600 sm:inline" aria-hidden>
                    →
                  </span>
                )}
                <span className="rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2">
                  {step}
                </span>
              </li>
            ))}
          </ol>
        </SlideFrame>
      );
    case 'closing':
      return (
        <SlideFrame>
          <p className="text-xs font-medium uppercase tracking-wider text-accent-violet">마무리</p>
          {slide.takeaways && slide.takeaways.length > 0 && (
            <ul className="mt-3 space-y-2 text-sm text-slate-300 sm:text-base">
              {slide.takeaways.map((t, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-accent-cyan">✓</span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          )}
          {slide.runCommand?.trim() && (
            <pre className="mt-4 overflow-x-auto rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-emerald-300/90 sm:text-sm">
              {slide.runCommand}
            </pre>
          )}
          <p className="mt-3 truncate text-xs text-slate-500">{slide.repoUrl}</p>
        </SlideFrame>
      );
    default:
      return (
        <SlideFrame>
          <p className="text-sm text-slate-500">지원하지 않는 슬라이드 형식입니다.</p>
        </SlideFrame>
      );
  }
}

type Props = {
  deck: SlideDeckSpec;
};

export function SlideDeckViewer({ deck }: Props) {
  const slides = deck.slides;
  const [index, setIndex] = useState(0);
  useEffect(() => {
    setIndex(0);
  }, [deck]);
  const total = slides.length;
  const safeIndex = Math.min(index, Math.max(0, total - 1));
  const current = slides[safeIndex];

  if (!total || !current) {
    return <p className="text-center text-sm text-slate-500">슬라이드가 없습니다.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-400">
          <span className="font-mono text-accent-cyan">{safeIndex + 1}</span>
          <span className="text-slate-600"> / </span>
          <span className="font-mono">{total}</span>
          <span className="mx-2 text-slate-600">·</span>
          <span className="text-slate-300">{slideLabel(current)}</span>
        </p>
        <div className="flex gap-1">
          <button
            type="button"
            disabled={safeIndex <= 0}
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-200 transition hover:border-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="이전 슬라이드"
          >
            <ChevronLeft className="h-4 w-4" />
            이전
          </button>
          <button
            type="button"
            disabled={safeIndex >= total - 1}
            onClick={() => setIndex((i) => Math.min(total - 1, i + 1))}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-200 transition hover:border-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="다음 슬라이드"
          >
            다음
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <SlideContent slide={current} />

      <div className="flex flex-wrap gap-1.5">
        {slides.map((s, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setIndex(i)}
            title={slideLabel(s)}
            className={`max-w-[8rem] truncate rounded-md px-2 py-1 text-xs transition ${
              i === safeIndex
                ? 'bg-accent-violet/20 text-accent-violet'
                : 'bg-slate-900/80 text-slate-500 hover:text-slate-300'
            }`}
          >
            {i + 1}. {slideLabel(s)}
          </button>
        ))}
      </div>
      <p className="text-xs text-slate-500">
        PPTX/PDF와 레이아웃은 다를 수 있습니다. 내용 확인용 미리보기입니다.
      </p>
    </div>
  );
}
