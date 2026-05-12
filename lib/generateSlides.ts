import type { SlideDeckSpec } from './types.js';
import { completeJsonText } from './llmCompleteJson.js';

const SLIDE_SCHEMA_HINT = `JSON schema for "slides" array items (use these discriminated "type" values only):
- {"type":"cover","projectName":string,"tagline":string,"repoUrl":string,"generatedAt":string ISO}
- {"type":"bullets","title":string,"bullets":string[]}
- {"type":"cards","title":string,"cards":{"title":string,"body":string}[]}
- {"type":"flow","title":string,"steps":string[]}
- {"type":"closing","repoUrl":string}

Order: cover, bullets overview, cards tech stack, flow architecture, bullets directory, cards core features, flow AI workflow, bullets deployment, bullets future, closing.
Text: Korean concise presentation tone.`;

export async function generateSlideDeckSpec(
  techSpecMarkdown: string,
  repoUrl: string,
): Promise<SlideDeckSpec> {
  const system = `Generate a presentation slide deck as JSON. ${SLIDE_SCHEMA_HINT}
Top-level object: { "slides": SlideSpec[] }`;

  const raw = await completeJsonText({
    system,
    user: `Repo: ${repoUrl}\n\nTechnical spec (markdown):\n${techSpecMarkdown.slice(0, 120_000)}`,
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
  return parsed;
}
