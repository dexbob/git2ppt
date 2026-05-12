import type { ParsedGithubRepo } from './types.js';

const SAFE_SEGMENT = /^[a-zA-Z0-9_.-]+$/;

/**
 * Validates and parses a public GitHub HTTPS URL.
 */
export function parseGithubRepoUrl(input: string): ParsedGithubRepo | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  let normalized = trimmed.replace(/\.git$/i, '');
  try {
    const url = new URL(normalized);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (url.hostname.toLowerCase() !== 'github.com') return null;
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length < 2) return null;
    const owner = parts[0]!;
    const repo = parts[1]!.replace(/\.git$/i, '');
    if (!SAFE_SEGMENT.test(owner) || !SAFE_SEGMENT.test(repo)) return null;
    return {
      owner,
      repo,
      webUrl: `https://github.com/${owner}/${repo}`,
    };
  } catch {
    return null;
  }
}

export function buildCloneUrl(parsed: ParsedGithubRepo): string {
  const token = process.env.GITHUB_TOKEN?.trim();
  const base = `https://github.com/${parsed.owner}/${parsed.repo}.git`;
  if (!token) return base;
  return `https://${encodeURIComponent(token)}@github.com/${parsed.owner}/${parsed.repo}.git`;
}
