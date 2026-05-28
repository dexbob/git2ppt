import type { SlideDeckSpec, SlideSpec } from './types.js';

function stripHtml(s: string): string {
  return s
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function stripInlineMarkdown(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[(.+?)\]\([^)]*\)/g, '$1')
    .replace(/!\[[^\]]*]\([^)]*\)/g, '');
}

function plainReadableText(raw: string): string {
  return stripInlineMarkdown(stripHtml(raw)).replace(/\s+/g, ' ').trim();
}

/** 표지 설명 후보로 쓰기 어려운 README 줄 */
function isSkippableCoverLine(line: string): boolean {
  const t = line.trim();
  if (!t) return true;
  if (/^#{1,6}\s/.test(t)) return true;
  if (t.startsWith('![') || t.startsWith('[![')) return true;
  if (/^<[!a-z/?]/i.test(t)) return true;
  if (/^https?:\/\/\S+$/i.test(t)) return true;
  if (/^[-*+]\s+/.test(t)) return true;
  if (/^\d+\.\s+/.test(t)) return true;
  if (/^---+$/u.test(t) || /^\*{3,}$/u.test(t)) return true;
  if (/^\[.*]:?\s*https?:\/\//i.test(t)) return true;
  const plain = plainReadableText(t);
  if (!plain || plain.length < 8) return true;
  if (/^[\d\s#*_\-=[\]|<>/\\.:,;'"()]+$/u.test(plain)) return true;
  return false;
}

/**
 * README 첫 H1 제목과, HTML/이미지/마크업을 건너뛴 뒤 첫 순수 텍스트 문단.
 * (README 원문 파일은 변경하지 않고, 표지용으로만 정제)
 */
export function readmeTitleAndDescription(markdown: string): { title: string; description: string } {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  let i = 0;
  while (i < lines.length && !lines[i].trim()) i++;

  let title = '';
  const h1 = lines[i]?.trim().match(/^#\s+(.+)$/);
  if (h1) {
    title = plainReadableText(h1[1]!);
    i++;
  }

  while (i < lines.length && !lines[i].trim()) i++;

  let description = '';
  while (i < lines.length) {
    const raw = lines[i]!;
    const t = raw.trim();
    if (!t) {
      if (description) break;
      i++;
      continue;
    }
    if (/^#{2,6}\s/.test(t)) break;

    if (isSkippableCoverLine(t)) {
      i++;
      continue;
    }

    const paraParts: string[] = [];
    while (i < lines.length) {
      const line = lines[i]!.trim();
      if (!line) break;
      if (/^#{2,6}\s/.test(line)) break;
      if (isSkippableCoverLine(line)) break;
      paraParts.push(line);
      i++;
      if (paraParts.join(' ').length > 420) break;
    }

    const candidate = plainReadableText(paraParts.join(' '));
    if (candidate.length >= 8 && !isSkippableCoverLine(candidate)) {
      description = candidate;
      break;
    }
  }

  if (description.length > 340) description = `${description.slice(0, 337)}…`;

  return { title: title || '', description };
}

/**
 * 표지 설명(tagline) 후처리:
 * - 마크업/과도한 공백 제거
 * - 데모/프로필링 같은 홍보성 꼬리 문구 제거
 * - 과도하게 길면 말줄임
 */
export function sanitizeCoverTagline(raw: string): string {
  let text = plainReadableText(raw ?? '');
  if (!text) return '';

  // "..." / " - ..." / " | ..." 형태의 꼬리 문구 제거 (데모·체험·프로파일링 등)
  text = text
    .replace(/\s*[|]\s*(?:ai\s*)?프로파일링(?:\s*\([^)]*\))?\.?$/i, '')
    .replace(/\s*[-–—]\s*(?:ai\s*)?프로파일링(?:\s*\([^)]*\))?\.?$/i, '')
    .replace(/\s*[|]\s*데모(?:\s*\([^)]*\))?\.?$/i, '')
    .replace(/\s*[-–—]\s*데모(?:\s*\([^)]*\))?\.?$/i, '')
    .replace(/\s*\((?:ai\s*)?프로파일링(?:\s*데모)?\)\s*$/i, '')
    .replace(/\s*\((?:demo|데모|체험판)\)\s*$/i, '')
    .trim();

  // 한 줄에 한 문장: 문장 단위로 나누고 최대 3줄만 사용
  const sentences = text.split(/\r?\n|(?<=[.!?。！？])\s+/u).map((s) => s.trim()).filter(Boolean);

  const picked: string[] = [];
  for (const s of sentences) {
    let normalized = s.replace(/\s+/g, ' ').trim();
    if (!normalized) continue;

    // 설명형 종결을 카피 톤(명사형)에 가깝게 정리
    normalized = normalized
      .replace(/[.!?]+$/g, '')
      .replace(/(입니다|입니다요|였습니다|였습니다요)\s*$/u, '')
      .replace(/([가-힣A-Za-z0-9]+)합니다\s*$/u, '$1')
      .replace(/([가-힣A-Za-z0-9]+)됩니다\s*$/u, '$1')
      .replace(/([가-힣A-Za-z0-9]+)됩니다요\s*$/u, '$1')
      .replace(/\s+/g, ' ')
      .trim();
    if (!normalized) continue;

    picked.push(normalized);
    if (picked.length >= 3) break;
  }

  if (picked.length === 0) {
    const compact = text.replace(/[.!?]+$/g, '').replace(/\s+/g, ' ').trim();
    if (!compact) return '';
    return compact;
  }

  return picked.join('\n');
}

export function applyReadmeToCoverSlide(spec: SlideDeckSpec, readmeMarkdown: string): void {
  const { title } = readmeTitleAndDescription(readmeMarkdown);
  const cover = spec.slides.find((s): s is Extract<SlideSpec, { type: 'cover' }> => s.type === 'cover');
  if (!cover) return;
  if (title) cover.projectName = title;
}

export function normalizeClosingSlide(spec: SlideDeckSpec): void {
  for (const s of spec.slides) {
    if (s.type !== 'closing') continue;
    if (!Array.isArray(s.takeaways)) {
      s.takeaways = [];
    } else {
      s.takeaways = s.takeaways.map((t) => String(t ?? '').trim()).filter(Boolean);
    }
    if (typeof s.runCommand !== 'string') {
      s.runCommand = '';
    } else {
      s.runCommand = s.runCommand.trim();
    }
  }
}
