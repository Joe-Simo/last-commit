import { describe, expect, it } from "vitest";
import examples from "../examples.json";
import type { Snapshot } from "../github";
import {
  buildOfrenda,
  cleanDescription,
  lastWordsOf,
  quietDuration,
  statusOf,
} from "../ofrenda";

const NOW = new Date("2026-10-26T19:00:00Z");
const atom = (examples as Snapshot[]).find((s) => s.repo === "atom")!;
const co = (examples as Snapshot[]).find((s) => s.repo === "co")!;

describe("quietDuration", () => {
  it("counts calendar years and months", () => {
    expect(quietDuration("2022-11-22T16:11:57Z", NOW)).toBe("3 years and 11 months");
    expect(quietDuration("2025-10-26T10:00:00Z", NOW)).toBe("1 year");
    expect(quietDuration("2026-02-27T00:00:00Z", NOW)).toBe("7 months");
    expect(quietDuration("2026-10-14T19:00:00Z", NOW)).toBe("12 days");
    expect(quietDuration("2026-10-25T18:00:00Z", NOW)).toBe("1 day");
  });
});

describe("statusOf", () => {
  it("puts archived first, then age", () => {
    expect(statusOf({ archived: true }, 3)).toBe("archived");
    expect(statusOf({ archived: false }, 400)).toBe("silent");
    expect(statusOf({ archived: false }, 200)).toBe("fading");
    expect(statusOf({ archived: false }, 20)).toBe("alive");
  });
});

describe("lastWordsOf", () => {
  const c = (message: string) => ({ sha: message, message, date: "", author: "", url: "" });
  it("skips merges and version bumps", () => {
    const commits = [c("Merge pull request #1 from a/b"), c("1.65.0-dev"), c("Fix the snapshot names\n\nlong body")];
    expect(lastWordsOf(commits)?.sha).toBe("Fix the snapshot names\n\nlong body");
  });
  it("falls back to the newest commit", () => {
    expect(lastWordsOf([c("Merge branch 'main'")])?.message).toBe("Merge branch 'main'");
    expect(lastWordsOf([])).toBeNull();
  });
});

describe("cleanDescription", () => {
  it("drops emoji codes, pictographs and deprecation prefixes", () => {
    expect(cleanDescription(":atom: The hackable text editor")).toBe("The hackable text editor");
    expect(cleanDescription("DEPRECATED - A HTML5 game")).toBe("A HTML5 game");
    expect(cleanDescription("\u{1F3CA}\u{1F3FE} Simplified HTTP request client.")).toBe("Simplified HTTP request client.");
    expect(cleanDescription("Fast \u2014 and small")).toBe("Fast, and small");
  });
});

describe("buildOfrenda", () => {
  it("builds atom's card from the real snapshot", () => {
    const o = buildOfrenda(atom, NOW);
    expect(o.status).toBe("archived");
    expect(o.years).toBe("2012 to 2022");
    expect(o.quietFor).toBe("3 years and 11 months");
    expect(o.lastWords?.message).toBe("Use the new naming format for snapshots on macOS");
    expect(o.tenders).toEqual(["kevinsawicki", "benogle", "maxbrunsfeld"]);
    expect(o.tendersMore).toBe(true);
    expect(o.about).toBe("The hackable text editor");
    expect(o.remembrance).toContain("The last change landed on November 22, 2022.");
  });

  it("treats an unarchived repo silent for years as gone quiet", () => {
    const o = buildOfrenda(co, NOW);
    expect(o.status).toBe("silent");
    expect(o.statusLabel).toBe("Gone quiet");
    expect(o.lastWords?.message).toBe("Add nodejs stable and LTS versions to travis tests (#300)");
  });

  it("does not hold a funeral for a living project", () => {
    const alive: Snapshot = {
      ...co,
      archived: false,
      commits: [{ sha: "a", message: "Fix", date: "2026-10-20T00:00:00Z", author: "x", url: "" }],
    };
    const o = buildOfrenda(alive, NOW);
    expect(o.status).toBe("alive");
    expect(o.years).toBe("2013 to now");
    expect(o.epitaph).toContain("still here");
  });

  it("never writes a dash into the card text", () => {
    for (const s of examples as Snapshot[]) {
      const o = buildOfrenda(s, NOW);
      for (const t of [o.epitaph, o.remembrance, o.nudge, o.about]) expect(t).not.toMatch(/[\u2013\u2014]/);
    }
  });
});
