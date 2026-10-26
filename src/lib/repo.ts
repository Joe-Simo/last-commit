export type RepoRef = { owner: string; repo: string };

const NAME = /^[A-Za-z0-9_.-]{1,100}$/;
const OWNER = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;

/**
 * Accepts the ways people usually paste a repository:
 * https://github.com/owner/repo, github.com/owner/repo/tree/main, git@github.com:owner/repo.git,
 * or just owner/repo. Returns null when it cannot find a plausible owner and name.
 */
export function parseRepoInput(input: string): RepoRef | null {
  let s = input.trim();
  if (!s) return null;
  s = s.replace(/^git\+/, "");
  const ssh = s.match(/^git@github\.com:(.+)$/i);
  if (ssh) s = ssh[1];
  s = s.replace(/^[a-z]+:\/\//i, "");
  s = s.replace(/^(www\.)?github\.com\//i, "");
  s = s.split(/[?#]/)[0];
  const parts = s.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  const owner = parts[0];
  const repo = parts[1].replace(/\.git$/i, "");
  if (!OWNER.test(owner) || !NAME.test(repo) || repo === "." || repo === "..") {
    return null;
  }
  return { owner, repo };
}

export function repoKey(ref: RepoRef): string {
  return `${ref.owner}/${ref.repo}`.toLowerCase();
}
