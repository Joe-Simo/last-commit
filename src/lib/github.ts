import { readmeIntro } from "./readme";
import type { RepoRef } from "./repo";

/** The public facts the card is built from. Everything here comes from GitHub's REST API. */
export type Snapshot = {
  owner: string;
  repo: string;
  url: string;
  description: string;
  homepage: string;
  archived: boolean;
  fork: boolean;
  createdAt: string;
  pushedAt: string;
  stars: number;
  forks: number;
  language: string;
  license: string;
  readmeIntro: string;
  commits: { sha: string; message: string; date: string; author: string; url: string }[];
  contributors: { login: string; contributions: number; url: string }[];
  latestRelease: { tag: string; date: string; url: string } | null;
  fetchedAt: string;
};

export class LookupError extends Error {
  constructor(
    public kind: "not-found" | "rate-limited" | "empty" | "network" | "unknown",
    message: string,
    public resetAt?: Date
  ) {
    super(message);
  }
}

type Fetch = typeof fetch;

const API = "https://api.github.com";

async function get(fetchImpl: Fetch, path: string, accept = "application/vnd.github+json") {
  let res: Response;
  try {
    res = await fetchImpl(`${API}${path}`, { headers: { Accept: accept } });
  } catch {
    throw new LookupError("network", "Could not reach GitHub. Check your connection and try again.");
  }
  if (res.status === 403 || res.status === 429) {
    const remaining = res.headers.get("x-ratelimit-remaining");
    const reset = Number(res.headers.get("x-ratelimit-reset"));
    const retryAfter = Number(res.headers.get("retry-after"));
    if (remaining === "0" || res.status === 429 || retryAfter) {
      const resetAt = reset
        ? new Date(reset * 1000)
        : retryAfter
          ? new Date(Date.now() + retryAfter * 1000)
          : undefined;
      throw new LookupError(
        "rate-limited",
        "GitHub's public API allows 60 lookups an hour from one network, and this one has used them.",
        resetAt
      );
    }
  }
  return res;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new LookupError("unknown", `GitHub answered ${res.status}.`);
  return (await res.json()) as T;
}

type RepoJson = {
  full_name: string;
  html_url: string;
  description: string | null;
  homepage: string | null;
  archived: boolean;
  fork: boolean;
  created_at: string;
  pushed_at: string;
  stargazers_count: number;
  forks_count: number;
  language: string | null;
  license: { spdx_id: string | null; name: string } | null;
  default_branch: string;
};

type CommitJson = {
  sha: string;
  html_url: string;
  commit: {
    message: string;
    author: { name: string; date: string } | null;
    committer: { name: string; date: string } | null;
  };
  author: { login: string } | null;
};

type ContributorJson = { login?: string; contributions: number; html_url?: string; type?: string };

type ReleaseJson = { tag_name: string; published_at: string | null; html_url: string };

/** Five unauthenticated calls: repo, recent commits, contributors, README, latest release. */
export async function fetchSnapshot(ref: RepoRef, fetchImpl: Fetch = fetch): Promise<Snapshot> {
  const base = `/repos/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.repo)}`;
  const repoRes = await get(fetchImpl, base);
  if (repoRes.status === 404) {
    throw new LookupError(
      "not-found",
      "No public repository by that name. It may be private, renamed, or never existed."
    );
  }
  const repo = await json<RepoJson>(repoRes);
  const [owner, name] = repo.full_name.split("/");
  const realBase = `/repos/${owner}/${name}`;

  const [commitsRes, contributorsRes, readmeRes, releaseRes] = await Promise.all([
    get(fetchImpl, `${realBase}/commits?per_page=10`),
    get(fetchImpl, `${realBase}/contributors?per_page=6`),
    get(fetchImpl, `${realBase}/readme`, "application/vnd.github.raw"),
    get(fetchImpl, `${realBase}/releases/latest`),
  ]);

  if (commitsRes.status === 409) {
    throw new LookupError("empty", "That repository has no commits, so there is nothing to remember yet.");
  }
  const commits = await json<CommitJson[]>(commitsRes);
  const contributors = contributorsRes.ok
    ? ((await contributorsRes.json()) as ContributorJson[]) ?? []
    : [];
  const readme = readmeRes.ok ? await readmeRes.text() : "";
  const release = releaseRes.ok ? ((await releaseRes.json()) as ReleaseJson) : null;

  return {
    owner,
    repo: name,
    url: repo.html_url,
    description: repo.description ?? "",
    homepage: repo.homepage ?? "",
    archived: repo.archived,
    fork: repo.fork,
    createdAt: repo.created_at,
    pushedAt: repo.pushed_at,
    stars: repo.stargazers_count,
    forks: repo.forks_count,
    language: repo.language ?? "",
    license: repo.license?.spdx_id && repo.license.spdx_id !== "NOASSERTION" ? repo.license.spdx_id : "",
    readmeIntro: readmeIntro(readme),
    commits: commits.map((c) => ({
      sha: c.sha,
      message: c.commit.message,
      date: c.commit.committer?.date ?? c.commit.author?.date ?? "",
      author: c.author?.login ?? c.commit.author?.name ?? "",
      url: c.html_url,
    })),
    contributors: (Array.isArray(contributors) ? contributors : [])
      .filter((c) => c.login && c.type !== "Bot" && !/\[bot\]$/.test(c.login))
      .map((c) => ({ login: c.login!, contributions: c.contributions, url: c.html_url ?? "" })),
    latestRelease:
      release && release.tag_name
        ? { tag: release.tag_name, date: release.published_at ?? "", url: release.html_url }
        : null,
    fetchedAt: new Date().toISOString(),
  };
}
