import type { SlideDeckSpec, SlideSpec } from './types.js';

function stripInlineMarkdown(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[(.+?)\]\([^)]*\)/g, '$1')
    .replace(/!\[[^\]]*]\([^)]*\)/g, '');
}

/** README 첫 번째 `#` 제목과, 그 다음 문단(짧은 설명)을 뽑는다. */
export function readmeTitleAndDescription(markdown: string): { title: string; description: string } {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  let i = 0;
  while (i < lines.length && !lines[i].trim()) i++;

  let title = '';
  const h1 = lines[i]?.trim().match(/^#\s+(.+)$/);
  if (h1) {
    title = h1[1]!.trim();
    i++;
  }

  while (i < lines.length && !lines[i].trim()) i++;

  const descParts: string[] = [];
  while (i < lines.length) {
    const raw = lines[i]!;
    const t = raw.trim();
    if (!t) break;
    if (t.startsWith('#')) break;
    if (t.startsWith('![') || t.startsWith('[![')) {
      i++;
      continue;
    }
    if (/^---+$/u.test(t) || /^\*{3,}$/u.test(t)) break;
    descParts.push(t);
    i++;
    if (descParts.join(' ').length > 420) break;
  }

  let description = descParts.join(' ').replace(/\s+/g, ' ').trim();
  description = stripInlineMarkdown(description);
  if (description.length > 340) description = `${description.slice(0, 337)}…`;

  return { title: title || '', description };
}

export function applyReadmeToCoverSlide(spec: SlideDeckSpec, readmeMarkdown: string): void {
  const { title, description } = readmeTitleAndDescription(readmeMarkdown);
  const cover = spec.slides.find((s): s is Extract<SlideSpec, { type: 'cover' }> => s.type === 'cover');
  if (!cover) return;
  if (title) cover.projectName = title;
  if (description) cover.tagline = description;
}

export function normalizeClosingSlide(spec: SlideDeckSpec): void {
  for (const s of spec.slides) {
    if (s.type === 'closing' && !Array.isArray(s.futureBullets)) {
      s.futureBullets = [];
    }
  }
}
