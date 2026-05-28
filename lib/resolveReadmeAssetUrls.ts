import type { RepositoryMetadata } from './types.js';

/** README·HTML·마크다운에서 상대 경로만 GitHub raw URL로 바꿉니다. */
export function resolveReadmeAssetUrls(
  markdown: string,
  metadata: Pick<RepositoryMetadata, 'parsed' | 'defaultBranch'>,
): string {
  const base = buildRawBase(metadata.parsed, metadata.defaultBranch);
  let out = markdown;

  out = out.replace(
    /(<img\b[^>]*\ssrc=)(["'])([^"']+)\2/gi,
    (match, prefix: string, quote: string, src: string) => {
      if (!isResolvableRelativeUrl(src)) return match;
      return `${prefix}${quote}${toRawUrl(src, base)}${quote}`;
    },
  );

  out = out.replace(
    /!\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g,
    (match, alt: string, url: string) => {
      if (!isResolvableRelativeUrl(url)) return match;
      return `![${alt}](${toRawUrl(url, base)})`;
    },
  );

  out = out.replace(
    /(<video\b[^>]*\ssrc=)(["'])([^"']+)\2/gi,
    (match, prefix: string, quote: string, src: string) => {
      if (!isResolvableRelativeUrl(src)) return match;
      return `${prefix}${quote}${toRawUrl(src, base)}${quote}`;
    },
  );

  out = out.replace(
    /(<source\b[^>]*\ssrc=)(["'])([^"']+)\2/gi,
    (match, prefix: string, quote: string, src: string) => {
      if (!isResolvableRelativeUrl(src)) return match;
      return `${prefix}${quote}${toRawUrl(src, base)}${quote}`;
    },
  );

  const mediaExt = /\.(png|jpe?g|gif|svg|webp|ico|avif|bmp|mp4|webm|mov|m4v|avi)(\?.*)?$/i;
  out = out.replace(
    /(<a\b[^>]*\shref=)(["'])([^"']+)\2/gi,
    (match, prefix: string, quote: string, href: string) => {
      if (!isResolvableRelativeUrl(href) || !mediaExt.test(href)) return match;
      return `${prefix}${quote}${toRawUrl(href, base)}${quote}`;
    },
  );

  return out;
}

function buildRawBase(parsed: { owner: string; repo: string }, branch: string): string {
  const owner = encodeURIComponent(parsed.owner);
  const repo = encodeURIComponent(parsed.repo);
  const ref = branch
    .split('/')
    .map((s) => encodeURIComponent(s))
    .join('/');
  return `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/`;
}

function isResolvableRelativeUrl(url: string): boolean {
  const u = url.trim();
  if (!u) return false;
  if (u.startsWith('#')) return false;
  if (/^(?:https?:)?\/\//i.test(u)) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return false;
  return true;
}

function normalizeRepoPath(path: string): string {
  return path.trim().replace(/^\.\//, '').replace(/^\/+/, '');
}

function toRawUrl(relativePath: string, base: string): string {
  const normalized = normalizeRepoPath(relativePath);
  if (!normalized) return relativePath;
  const encoded = normalized
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
  return `${base}${encoded}`;
}
