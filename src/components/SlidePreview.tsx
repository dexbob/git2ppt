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
  /** 슬라이드 생성이 끝난 뒤에만 목차를 표시 */
  ready?: boolean;
};

export function SlidePreview({ deck, ready = true }: Props) {
  if (!ready || !deck?.slides?.length) return null;

  return (
    <section className="w-full space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-100">슬라이드 목차</h2>
        <span className="text-xs text-slate-500">총 {deck.slides.length}장</span>
      </div>
      <ol className="space-y-2 rounded-xl border border-slate-800/80 bg-slate-950/40 p-4">
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
