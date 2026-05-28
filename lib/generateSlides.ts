import type { SlideDeckSpec } from './types.js';
import { JSON_RESPONSE_ERROR } from './formatUserFacingError.js';
import { completeJsonText } from './llmCompleteJson.js';
import { logJsonParseFailure } from './logJsonParseFailure.js';
import { parseJsonWithRecovery } from './parseJsonWithRecovery.js';
import {
  applyReadmeToCoverSlide,
  normalizeClosingSlide,
  sanitizeCoverTagline,
} from './readmeCoverHints.js';

const SLIDE_SCHEMA_HINT = `JSON schema for "slides" array items (use these discriminated "type" values only):
- {"type":"cover","projectName":string,"tagline":string,"repoUrl":string,"generatedAt":string ISO}
- {"type":"bullets","title":string,"bullets":string[]}
- {"type":"cards","title":string,"cards":{"title":string,"body":string}[]}
- {"type":"flow","title":string,"steps":string[]}
- {"type":"closing","repoUrl":string,"takeaways":string[],"runCommand":string}

Order: cover, bullets overview, cards tech stack, flow architecture, bullets directory, cards core features, flow AI workflow, bullets deployment, bullets future, closing.
Text: Korean concise presentation tone.

For type "bullets" at the "bullets future" position (9th slide): list 3–5 concrete future improvements or extensions grounded in the tech spec.

For type "closing" (final slide): this slide is the deck wrap-up and MUST NOT repeat the future-improvements content from the 9th slide.
- takeaways: 2–3 short Korean lines that compress the whole deck into memorable points. Prefer one of: project's one-sentence definition, the core problem it solves, the standout architectural/technical decision, or a quantitative highlight (e.g., 모듈 수, 지원 API 개수). Never restate items already listed on the 9th "bullets future" slide.
- runCommand: a single short shell command that lets the audience try the project locally. Prefer commands taken verbatim from the README's "Getting Started" / "Quick Start" / "설치" / "실행" section (e.g., "npm install && npm run dev", "docker compose up"). If the README has no such command, use an empty string "".

CRITICAL: Every slide must reflect ONLY the provided repository URL and the technical specification markdown below. Do not invent product features, stack items, or domain content that are not clearly supported by that tech spec. Do not reuse wording from unrelated sample documents.

When a README excerpt is provided below:
- cover projectName should match the first markdown H1 title line (without leading #).
- cover tagline should be an LLM-refined Korean explanation grounded in README + technical spec.
- cover tagline should be 2-3 short lines total, one sentence per line.
- each sentence should be concise enough to read at a glance, but line lengths may vary naturally.
- prefer impactful copywriting tone with noun-style endings; avoid polite declarative endings like "입니다/습니다".
- tagline must avoid promo/demo phrases (e.g., "데모", "프로파일링"), markdown/image/link artifacts, and raw URL tails.
- tagline must be plain text only.`;

export async function generateSlideDeckSpec(
  techSpecMarkdown: string,
  repoUrl: string,
  readmeMarkdown?: string | null,
): Promise<SlideDeckSpec> {
  const system = `Generate a presentation slide deck as JSON. ${SLIDE_SCHEMA_HINT}
Top-level object: { "slides": SlideSpec[] }`;

  const readmeBlock = readmeMarkdown?.trim()
    ? `\n\nREADME (markdown excerpt, authoritative for cover title and tagline):\n${readmeMarkdown.trim().slice(0, 24_000)}`
    : '';

  const raw = await completeJsonText({
    system,
    user: `Repo: ${repoUrl}\n\nTechnical spec (markdown):\n${techSpecMarkdown.slice(0, 120_000)}${readmeBlock}`,
    temperature: 0.35,
  });

  let parsed: SlideDeckSpec;
  try {
    parsed = parseJsonWithRecovery<SlideDeckSpec>(raw);
  } catch (parseErr) {
    logJsonParseFailure('generateSlides', raw, parseErr);
    throw new Error(JSON_RESPONSE_ERROR);
  }
  if (!parsed.slides || !Array.isArray(parsed.slides) || parsed.slides.length < 3) {
    throw new Error('슬라이드 생성 실패: 슬라이드 배열이 비정상입니다.');
  }

  normalizeClosingSlide(parsed);
  const cover = parsed.slides.find((s) => s.type === 'cover');
  if (cover && typeof cover.tagline === 'string') {
    cover.tagline = sanitizeCoverTagline(cover.tagline);
  }
  if (readmeMarkdown?.trim()) {
    applyReadmeToCoverSlide(parsed, readmeMarkdown.trim());
  }

  return parsed;
}
