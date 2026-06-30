import { HttpError } from './errors';

export interface GithubRoastData {
  username: string;
  name: string;
  bio: string;
  followers: number;
  following: number;
  publicRepos: number;
  stars: number;
  topLangs: string[];
  forks: number;
  withDesc: number;
  totalRepos: number;
  accountYears: string;
  lastUpdated: string;
  company: string | null;
  hireable: boolean;
  location: string | null;
}

interface GhRepo {
  language: string | null;
  stargazers_count: number;
  fork: boolean;
  description: string | null;
  updated_at: string;
}

interface GhUser {
  login: string;
  name: string | null;
  bio: string | null;
  followers: number;
  following: number;
  public_repos: number;
  created_at: string;
  company: string | null;
  hireable: boolean | null;
  location: string | null;
}

// Fetches public profile + repo data from the GitHub REST API.
// No auth token needed for public data, but unauthenticated requests
// share a low rate limit (60/hr per source IP) — fine for an MVP,
// worth adding a GITHUB_TOKEN env var + Authorization header later
// if you outgrow it.
export async function fetchGitHubProfile(username: string): Promise<GithubRoastData> {
  const headers = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'roast-my-profile-app',
  };

  const [userRes, reposRes] = await Promise.all([
    fetch(`https://api.github.com/users/${username}`, { headers, cache: 'no-store' }),
    fetch(`https://api.github.com/users/${username}/repos?sort=updated&per_page=30&type=owner`, {
      headers,
      cache: 'no-store',
    }),
  ]);

  if (!userRes.ok) {
    if (userRes.status === 404) {
      throw new HttpError(`GitHub user "${username}" doesn't exist. Check the spelling.`, 404);
    }
    if (userRes.status === 403) {
      throw new HttpError('GitHub API rate limit hit on the server. Try again in a minute.', 429);
    }
    throw new HttpError(`GitHub API returned an error (${userRes.status}).`, 502);
  }

  const user: GhUser = await userRes.json();
  const repos: GhRepo[] = reposRes.ok ? await reposRes.json() : [];

  const langCounts: Record<string, number> = {};
  for (const r of repos) {
    if (r.language) langCounts[r.language] = (langCounts[r.language] || 0) + 1;
  }
  const topLangs = Object.entries(langCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([lang]) => lang);

  const stars = repos.reduce((sum, r) => sum + (r.stargazers_count || 0), 0);
  const forks = repos.filter((r) => r.fork).length;
  const withDesc = repos.filter((r) => r.description && r.description.length > 4).length;
  const accountYears = (
    (Date.now() - new Date(user.created_at).getTime()) /
    (1000 * 60 * 60 * 24 * 365)
  ).toFixed(1);
  const lastUpdated = repos[0]?.updated_at
    ? new Date(repos[0].updated_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : 'unknown';

  return {
    username: user.login,
    name: user.name || user.login,
    bio: user.bio || '(no bio)',
    followers: user.followers,
    following: user.following,
    publicRepos: user.public_repos,
    stars,
    topLangs,
    forks,
    withDesc,
    totalRepos: repos.length,
    accountYears,
    lastUpdated,
    company: user.company || null,
    hireable: !!user.hireable,
    location: user.location || null,
  };
}
