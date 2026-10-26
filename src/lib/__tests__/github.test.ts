import { describe, expect, it } from "vitest";
import { fetchSnapshot, LookupError } from "../github";

type Route = { status: number; body?: unknown; headers?: Record<string, string> };

function fakeFetch(routes: Record<string, Route>): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const path = String(input).replace("https://api.github.com", "");
    const r = routes[path] ?? { status: 404, body: { message: "Not Found" } };
    const body = typeof r.body === "string" ? r.body : JSON.stringify(r.body ?? {});
    return new Response(body, { status: r.status, headers: r.headers });
  }) as typeof fetch;
}

const repo = {
  full_name: "ghost/town",
  html_url: "https://github.com/ghost/town",
  description: "A quiet place",
  homepage: null,
  archived: true,
  fork: false,
  created_at: "2015-01-01T00:00:00Z",
  pushed_at: "2019-05-01T00:00:00Z",
  stargazers_count: 42,
  forks_count: 7,
  language: "Go",
  license: { spdx_id: "MIT", name: "MIT License" },
  default_branch: "main",
};

describe("fetchSnapshot", () => {
  it("collects the public facts", async () => {
    const snap = await fetchSnapshot(
      { owner: "Ghost", repo: "Town" },
      fakeFetch({
        "/repos/Ghost/Town": { status: 200, body: repo },
        "/repos/ghost/town/commits?per_page=10": {
          status: 200,
          body: [
            {
              sha: "abc",
              html_url: "https://github.com/ghost/town/commit/abc",
              commit: { message: "Turn off the lights", author: { name: "Casper", date: "2019-05-01T00:00:00Z" }, committer: { name: "Casper", date: "2019-05-01T00:00:00Z" } },
              author: { login: "casper" },
            },
          ],
        },
        "/repos/ghost/town/contributors?per_page=6": {
          status: 200,
          body: [
            { login: "casper", contributions: 90, html_url: "u", type: "User" },
            { login: "dependabot[bot]", contributions: 9, type: "Bot" },
          ],
        },
        "/repos/ghost/town/readme": { status: 200, body: "# Town\n\nA small town where every service has gone quiet." },
      })
    );
    expect(snap.owner).toBe("ghost");
    expect(snap.commits[0]).toMatchObject({ message: "Turn off the lights", author: "casper" });
    expect(snap.contributors.map((c) => c.login)).toEqual(["casper"]);
    expect(snap.readmeIntro).toBe("A small town where every service has gone quiet.");
    expect(snap.latestRelease).toBeNull();
    expect(snap.license).toBe("MIT");
  });

  it("reports a missing repo", async () => {
    await expect(fetchSnapshot({ owner: "no", repo: "body" }, fakeFetch({}))).rejects.toMatchObject({ kind: "not-found" });
  });

  it("reports the rate limit with its reset time", async () => {
    const err = await fetchSnapshot(
      { owner: "a", repo: "b" },
      fakeFetch({ "/repos/a/b": { status: 403, headers: { "x-ratelimit-remaining": "0", "x-ratelimit-reset": "1793045565" } } })
    ).catch((e) => e);
    expect(err).toBeInstanceOf(LookupError);
    expect(err.kind).toBe("rate-limited");
    expect(err.resetAt.getTime()).toBe(1793045565000);
  });

  it("reports an empty repository", async () => {
    await expect(
      fetchSnapshot(
        { owner: "a", repo: "b" },
        fakeFetch({ "/repos/a/b": { status: 200, body: { ...repo, full_name: "a/b" } }, "/repos/a/b/commits?per_page=10": { status: 409, body: {} } })
      )
    ).rejects.toMatchObject({ kind: "empty" });
  });

  it("reports a network failure", async () => {
    const broken = (async () => {
      throw new TypeError("offline");
    }) as typeof fetch;
    await expect(fetchSnapshot({ owner: "a", repo: "b" }, broken)).rejects.toMatchObject({ kind: "network" });
  });
});
