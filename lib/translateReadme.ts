import { completeMarkdownText } from './llmCompleteJson.js';

/** LLM 입력 상한 (슬라이드·명세서와 비슷한 규모) */
const MAX_SOURCE_CHARS = 120_000;

const TRANSLATE_SYSTEM = `You are a technical translator for open-source README files.

Translate the given README into natural Korean.

CRITICAL — do NOT summarize:
- Keep the same sections, order, and approximate length as the source.
- Do NOT omit badges, images, tables, HTML blocks, or code examples.
- Do NOT rewrite into a shorter "project overview".

Preserve structure exactly:
- Keep all Markdown and HTML tags, attributes, URLs, img src/href, shields.io badge URLs, align= attributes, tables, <div>, <p>, <br>, code fences.
- Only translate human-readable prose (headings, paragraphs, list text, table cell text meant for readers, button/link visible labels when they are sentences).
- Do NOT translate: URLs, href/src, package names, CLI commands inside code blocks, file paths, version numbers, proper nouns (Playwright, Chromium, Docker, npm, GitHub).
- Code block content must stay identical except optional Korean translation of # comments that explain usage.

If the README is already mostly Korean, lightly polish wording only; preserve structure.

Output ONLY the translated README markdown. No JSON. No code fences wrapping the whole document. No commentary before or after.`;

export async function translateReadmeToKorean(sourceMarkdown: string): Promise<string> {
  const source = sourceMarkdown.trim();
  if (!source) {
    throw new Error('README 원문이 비어 있어 번역할 수 없습니다.');
  }

  const input =
    source.length > MAX_SOURCE_CHARS
      ? `${source.slice(0, MAX_SOURCE_CHARS)}\n\n… (input truncated for model limit)`
      : source;

  const translated = await completeMarkdownText({
    system: TRANSLATE_SYSTEM,
    user: `README to translate:\n\n${input}`,
    temperature: 0.2,
  });

  if (!translated.trim()) {
    throw new Error('README 번역 실패: 결과가 비어 있습니다.');
  }
  return translated;
}
