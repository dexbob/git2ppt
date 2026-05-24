import type { ParsedGithubRepo } from './types.js';

function githubApiHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'git2ppt',
  };
  const token = process.env.GITHUB_TOKEN?.trim();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

type RepoOwner = {
  login?: string;
  type?: string;
  name?: string | null;
};

export type GithubRepoMeta = {
  ownerDisplayName: string | null;
  topics: string[];
};

async function fetchOwnerDisplayName(
  owner: RepoOwner,
  headers: Record<string, string>,
  signal: AbortSignal,
): Promise<string | null> {
  const fromRepo = owner.name?.trim();
  if (fromRepo) return fromRepo;
  if (!owner.login) return null;

  const profileUrl =
    owner.type === 'Organization'
      ? `https://api.github.com/orgs/${owner.login}`
      : `https://api.github.com/users/${owner.login}`;
  const profileRes = await fetch(profileUrl, { headers, signal });
  if (!profileRes.ok) return null;

  const profile = (await profileRes.json()) as { name?: string | null };
  const name = profile.name?.trim();
  return name || null;
}

/** 저장소 API 1회: owner Name + topics */
export async function fetchGithubRepoMeta(parsed: ParsedGithubRepo): Promise<GithubRepoMeta> {
  const headers = githubApiHeaders();
  const controller = new AbortController();
  const timeoutMs = Number(process.env.GITHUB_ZIP_TIMEOUT_MS ?? 120_000);
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const repoRes = await fetch(
      `https://api.github.com/repos/${parsed.owner}/${parsed.repo}`,
      { headers, signal: controller.signal },
    );
    if (!repoRes.ok) {
      return { ownerDisplayName: null, topics: [] };
    }

    const repo = (await repoRes.json()) as { owner?: RepoOwner; topics?: string[] };
    const owner = repo.owner ?? {};
    const topics = Array.isArray(repo.topics)
      ? repo.topics.map((x) => String(x).trim()).filter(Boolean)
      : [];

    const ownerDisplayName = await fetchOwnerDisplayName(owner, headers, controller.signal);
    return { ownerDisplayName, topics };
  } catch {
    return { ownerDisplayName: null, topics: [] };
  } finally {
    clearTimeout(t);
  }
}

/** @deprecated fetchGithubRepoMeta 사용 */
export async function fetchGithubOwnerDisplayName(parsed: ParsedGithubRepo): Promise<string | null> {
  const meta = await fetchGithubRepoMeta(parsed);
  return meta.ownerDisplayName;
}
