import type { SlideDeckSpec } from './types.js';
import { completeJsonText } from './llmCompleteJson.js';
import { applyReadmeToCoverSlide, normalizeClosingSlide } from './readmeCoverHints.js';

const SLIDE_SCHEMA_HINT = `JSON schema for "slides" array items (use these discriminated "type" values only):
- {"type":"cover","projectName":string,"tagline":string,"repoUrl":string,"generatedAt":string ISO}
- {"type":"bullets","title":string,"bullets":string[]}
- {"type":"cards","title":string,"cards":{"title":string,"body":string}[]}
- {"type":"flow","title":string,"steps":string[]}
- {"type":"closing","repoUrl":string,"futureBullets":string[]}

Order: cover, bullets overview, cards tech stack, flow architecture, bullets directory, cards core features, flow AI workflow, bullets deployment, bullets future, closing.
Text: Korean concise presentation tone.

For type "closing": include futureBullets with 2–4 short Korean lines naming plausible future improvements or extensions that appear in (or are clearly implied by) the technical spec. If the spec does not mention any, use an empty array [].

CRITICAL: Every slide must reflect ONLY the provided repository URL and the technical specification markdown below. Do not invent product features, stack items, or domain content that are not clearly supported by that tech spec. Do not reuse wording from unrelated sample documents.

When a README excerpt is provided below, the cover slide projectName and tagline MUST match that README: projectName = the first markdown H1 title line (without the leading #), tagline = the first substantive paragraph after that title (one or two sentences, under 200 characters if possible).`;

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
    parsed = JSON.parse(raw) as SlideDeckSpec;
  } catch {
    throw new Error('슬라이드 생성 실패: JSON 파싱 오류');
  }
  if (!parsed.slides || !Array.isArray(parsed.slides) || parsed.slides.length < 3) {
    throw new Error('슬라이드 생성 실패: 슬라이드 배열이 비정상입니다.');
  }

  normalizeClosingSlide(parsed);
  if (readmeMarkdown?.trim()) {
    applyReadmeToCoverSlide(parsed, readmeMarkdown.trim());
  }

  return parsed;
}
