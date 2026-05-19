import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import type { DetectedSignals } from '@lib/types';
import { SimpleMarkdown } from '../utils/simpleMarkdown';

type Tab = 'readme' | 'techSpec';

type Props = {
  readme: string | null;
  techSpec: string | null;
  loading?: boolean;
  detected?: DetectedSignals | null;
};

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
    <div className="flex flex-wrap gap-2">
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

export function DocumentPreview({ readme, techSpec, loading, detected }: Props) {
  const [tab, setTab] = useState<Tab>('techSpec');
  const hasContent = Boolean(readme?.trim() || techSpec?.trim());

  if (!loading && !hasContent) return null;

  const activeContent = tab === 'readme' ? readme : techSpec;
  const tabs: { id: Tab; label: string; available: boolean }[] = [
    { id: 'techSpec', label: '기술명세서', available: Boolean(techSpec?.trim()) || Boolean(loading) },
    { id: 'readme', label: 'README', available: Boolean(readme?.trim()) || Boolean(loading) },
  ];

  return (
    <section className="w-full space-y-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold text-slate-100">문서 미리보기</h2>
        {!loading && hasContent && (
          <div className="flex gap-1 rounded-xl border border-slate-800 bg-slate-950/50 p-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                disabled={!t.available}
                onClick={() => setTab(t.id)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  tab === t.id
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-300 disabled:cursor-not-allowed disabled:opacity-40'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4">
        {loading && !hasContent ? (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-accent-cyan" />
            <p className="text-sm text-slate-400">기술명세서와 README를 생성하는 중…</p>
            {detected && <DetectedChips detected={detected} />}
          </div>
        ) : (
          <div className="max-h-[32rem] overflow-y-auto overscroll-contain rounded-xl border border-slate-800/80 bg-slate-950/40 p-5">
            {activeContent?.trim() ? (
              <SimpleMarkdown source={activeContent} />
            ) : (
              <p className="text-center text-sm text-slate-500">
                {tab === 'readme' ? 'README' : '기술명세서'}가 아직 없습니다.
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
