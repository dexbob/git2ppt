import type { DetectedSignals } from './types.js';

/** 표지 태그 표시용: 앞에 # 하나만 붙인다 */
export function formatHashtag(raw: string): string {
  const inner = raw
    .trim()
    .replace(/^#+/, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!inner) return '';
  return `#${inner}`;
}

function splitCompoundLabel(label: string): string[] {
  return label
    .split(/\s*[+,/&|]\s*|\s+and\s+/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** 저장소 스캔 신호 + GitHub topics → 표지용 #태그 목록 */
export function coverTagsFromSignals(
  detected: DetectedSignals,
  githubTopics: string[] = [],
  max = 10,
): string[] {
  const fromDetected = [
    detected.frontend,
    detected.backend,
    detected.stateManagement,
    detected.deployment,
    detected.database,
    ...(detected.aiApis ?? []),
    ...(detected.features ?? []).filter((f) => !/repository analysis/i.test(f)),
  ].filter(Boolean) as string[];

  const candidates: string[] = [];
  for (const label of fromDetected) {
    candidates.push(...splitCompoundLabel(label));
  }
  for (const topic of githubTopics) {
    candidates.push(topic);
  }

  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of candidates) {
    const tag = formatHashtag(c);
    const key = tag.toLowerCase();
    if (!tag || key === '#' || seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
    if (out.length >= max) break;
  }
  return out;
}
