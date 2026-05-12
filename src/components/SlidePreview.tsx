import type { SlideDeckSpec } from '@lib/types';

function slideTitle(slide: SlideDeckSpec['slides'][number]): string {
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

type Props = {
  deck: SlideDeckSpec | null;
};

export function SlidePreview({ deck }: Props) {
  if (!deck?.slides?.length) {
    return (
      <section className="w-full rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 p-6 text-center text-sm text-slate-500">
        슬라이드 미리보기는 생성 완료 후 표시됩니다.
      </section>
    );
  }

  return (
    <section className="w-full space-y-3">
      <h2 className="text-lg font-semibold text-slate-100">슬라이드 목차</h2>
      <ol className="space-y-2 rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
        {deck.slides.map((s, i) => (
          <li key={i} className="flex gap-3 text-sm text-slate-300">
            <span className="w-6 shrink-0 font-mono text-xs text-accent-cyan">{i + 1}</span>
            <span>{slideTitle(s)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
