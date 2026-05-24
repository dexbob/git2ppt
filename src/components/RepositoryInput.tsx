import { Sparkles } from 'lucide-react';
import { useEffect, useRef } from 'react';

type Props = {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled: boolean;
};

export function RepositoryInput({ value, onChange, onSubmit, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (disabled || !value.trim()) return;
    onSubmit();
  }

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-6">
      <div className="space-y-2">
        <label htmlFor="repo-url" className="text-sm font-medium text-slate-300">
          GitHub 저장소 URL
        </label>
        <input
          id="repo-url"
          ref={inputRef}
          type="url"
          placeholder="https://github.com/owner/repository"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl border border-slate-700/80 bg-slate-900/60 px-4 py-3 text-slate-100 outline-none ring-accent-violet/40 transition focus:border-accent-violet focus:ring-2"
        />
      </div>
      <button
        type="submit"
        disabled={disabled || !value.trim()}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent-violet to-accent-cyan px-5 py-3.5 text-base font-semibold text-white shadow-lg shadow-accent-violet/25 transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Sparkles className="h-5 w-5" />
        분석 및 자료 생성
      </button>
    </form>
  );
}
