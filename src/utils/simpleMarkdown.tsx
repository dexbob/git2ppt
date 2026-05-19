import type { ReactNode } from 'react';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern =
    /(\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) {
      nodes.push(text.slice(last, match.index));
    }
    if (match[2]) {
      nodes.push(
        <strong key={key++} className="font-semibold text-slate-100">
          {match[2]}
        </strong>,
      );
    } else if (match[3]) {
      nodes.push(
        <em key={key++} className="italic text-slate-200">
          {match[3]}
        </em>,
      );
    } else if (match[4]) {
      nodes.push(
        <code
          key={key++}
          className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-xs text-accent-cyan"
        >
          {match[4]}
        </code>,
      );
    } else if (match[5] && match[6]) {
      nodes.push(
        <a
          key={key++}
          href={match[6]}
          target="_blank"
          rel="noreferrer"
          className="text-accent-cyan underline underline-offset-2 hover:text-accent-violet"
        >
          {match[5]}
        </a>,
      );
    }
    last = match.index + match[0].length;
  }

  if (last < text.length) {
    nodes.push(text.slice(last));
  }
  return nodes.length ? nodes : [text];
}

type Block =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'ul'; items: string[] }
  | { kind: 'ol'; items: string[] }
  | { kind: 'code'; lang: string; text: string }
  | { kind: 'hr' };

function parseBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    if (trimmed.startsWith('```')) {
      const lang = trimmed.slice(3).trim();
      i++;
      const codeLines: string[] = [];
      while (i < lines.length && !lines[i]!.trim().startsWith('```')) {
        codeLines.push(lines[i]!);
        i++;
      }
      if (i < lines.length) i++;
      blocks.push({ kind: 'code', lang, text: codeLines.join('\n') });
      continue;
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      blocks.push({ kind: 'heading', level: heading[1]!.length, text: heading[2]!.trim() });
      i++;
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push({ kind: 'hr' });
      i++;
      continue;
    }

    if (/^[-*+]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*+]\s+/.test(lines[i]!.trim())) {
        items.push(lines[i]!.trim().replace(/^[-*+]\s+/, ''));
        i++;
      }
      blocks.push({ kind: 'ul', items });
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i]!.trim())) {
        items.push(lines[i]!.trim().replace(/^\d+\.\s+/, ''));
        i++;
      }
      blocks.push({ kind: 'ol', items });
      continue;
    }

    const paraLines: string[] = [trimmed];
    i++;
    while (i < lines.length) {
      const next = lines[i]!.trim();
      if (
        !next ||
        next.startsWith('#') ||
        next.startsWith('```') ||
        /^[-*+]\s+/.test(next) ||
        /^\d+\.\s+/.test(next) ||
        /^(-{3,}|\*{3,}|_{3,})$/.test(next)
      ) {
        break;
      }
      paraLines.push(next);
      i++;
    }
    blocks.push({ kind: 'paragraph', text: paraLines.join(' ') });
  }

  return blocks;
}

const HEADING_CLASS: Record<number, string> = {
  1: 'text-2xl font-bold text-white mt-6 mb-3 first:mt-0',
  2: 'text-xl font-bold text-slate-100 mt-5 mb-2 first:mt-0',
  3: 'text-lg font-semibold text-slate-100 mt-4 mb-2 first:mt-0',
  4: 'text-base font-semibold text-slate-200 mt-3 mb-1 first:mt-0',
  5: 'text-sm font-semibold text-slate-200 mt-3 mb-1 first:mt-0',
  6: 'text-sm font-medium text-slate-300 mt-2 mb-1 first:mt-0',
};

export function SimpleMarkdown({ source }: { source: string }) {
  const blocks = parseBlocks(source);

  return (
    <div className="space-y-3 text-sm leading-relaxed text-slate-300">
      {blocks.map((block, idx) => {
        switch (block.kind) {
          case 'heading': {
            const level = Math.min(block.level, 6);
            const className = HEADING_CLASS[level] ?? HEADING_CLASS[6]!;
            if (level === 1) {
              return (
                <h1 key={idx} className={className}>
                  {renderInline(block.text)}
                </h1>
              );
            }
            if (level === 2) {
              return (
                <h2 key={idx} className={className}>
                  {renderInline(block.text)}
                </h2>
              );
            }
            if (level === 3) {
              return (
                <h3 key={idx} className={className}>
                  {renderInline(block.text)}
                </h3>
              );
            }
            return (
              <h4 key={idx} className={className}>
                {renderInline(block.text)}
              </h4>
            );
          }
          case 'paragraph':
            return (
              <p key={idx} className="text-slate-300">
                {renderInline(block.text)}
              </p>
            );
          case 'ul':
            return (
              <ul key={idx} className="list-disc space-y-1 pl-5 text-slate-300">
                {block.items.map((item, j) => (
                  <li key={j}>{renderInline(item)}</li>
                ))}
              </ul>
            );
          case 'ol':
            return (
              <ol key={idx} className="list-decimal space-y-1 pl-5 text-slate-300">
                {block.items.map((item, j) => (
                  <li key={j}>{renderInline(item)}</li>
                ))}
              </ol>
            );
          case 'code':
            return (
              <pre
                key={idx}
                className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/80 p-4 font-mono text-xs text-slate-300"
              >
                <code>{escapeHtml(block.text)}</code>
              </pre>
            );
          case 'hr':
            return <hr key={idx} className="border-slate-800" />;
          default:
            return null;
        }
      })}
    </div>
  );
}
