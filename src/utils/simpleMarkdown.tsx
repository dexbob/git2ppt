import type { Components } from 'react-markdown';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';

/** GitHub README에서 흔한 HTML·정렬 속성 허용 */
const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    div: [...(defaultSchema.attributes?.div ?? []), 'align'],
    p: [...(defaultSchema.attributes?.p ?? []), 'align'],
    h1: [...(defaultSchema.attributes?.h1 ?? []), 'align'],
    h2: [...(defaultSchema.attributes?.h2 ?? []), 'align'],
    h3: [...(defaultSchema.attributes?.h3 ?? []), 'align'],
    h4: [...(defaultSchema.attributes?.h4 ?? []), 'align'],
    h5: [...(defaultSchema.attributes?.h5 ?? []), 'align'],
    h6: [...(defaultSchema.attributes?.h6 ?? []), 'align'],
    img: [...(defaultSchema.attributes?.img ?? []), 'width', 'height', 'align'],
    table: [...(defaultSchema.attributes?.table ?? []), 'align', 'width'],
    th: [...(defaultSchema.attributes?.th ?? []), 'align', 'width', 'colspan', 'rowspan'],
    td: [...(defaultSchema.attributes?.td ?? []), 'align', 'width', 'colspan', 'rowspan'],
    tr: [...(defaultSchema.attributes?.tr ?? []), 'align'],
    a: [...(defaultSchema.attributes?.a ?? []), 'target', 'rel', 'title'],
  },
};

const markdownComponents: Components = {
  img: ({ alt, ...props }) => (
    // eslint-disable-next-line jsx-a11y/alt-text -- alt from README
    <img
      {...props}
      alt={alt ?? ''}
      className="my-2 inline-block max-w-full h-auto rounded"
      loading="lazy"
    />
  ),
  a: ({ href, children, ...props }) => (
    <a
      {...props}
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="text-accent-cyan underline underline-offset-2 hover:text-accent-violet"
    >
      {children}
    </a>
  ),
  table: ({ children, ...props }) => (
    <div className="my-3 overflow-x-auto">
      <table {...props} className="w-full border-collapse text-sm">
        {children}
      </table>
    </div>
  ),
  th: ({ children, ...props }) => (
    <th
      {...props}
      className="border border-slate-700 bg-slate-900/80 px-3 py-2 text-left font-semibold text-slate-200"
    >
      {children}
    </th>
  ),
  td: ({ children, ...props }) => (
    <td {...props} className="border border-slate-800 px-3 py-2 text-slate-300">
      {children}
    </td>
  ),
  pre: ({ children, ...props }) => (
    <pre
      {...props}
      className="my-3 overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/80 p-4 font-mono text-xs text-slate-300"
    >
      {children}
    </pre>
  ),
  code: ({ className, children, ...props }) => {
    const isBlock = Boolean(className);
    if (isBlock) {
      return (
        <code {...props} className={className}>
          {children}
        </code>
      );
    }
    return (
      <code
        {...props}
        className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-xs text-accent-cyan"
      >
        {children}
      </code>
    );
  },
};

export function SimpleMarkdown({ source }: { source: string }) {
  return (
    <div className="markdown-body text-sm leading-relaxed text-slate-300">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema]]}
        components={markdownComponents}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
