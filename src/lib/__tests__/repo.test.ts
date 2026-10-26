import { describe, expect, it } from "vitest";
import { parseRepoInput } from "../repo";

describe("parseRepoInput", () => {
  it.each([
    ["atom/atom", "atom", "atom"],
    ["https://github.com/atom/atom", "atom", "atom"],
    ["github.com/angular/angular.js/tree/master/src", "angular", "angular.js"],
    ["git@github.com:tj/co.git", "tj", "co"],
    ["https://www.github.com/mozilla/BrowserQuest?tab=readme#top", "mozilla", "BrowserQuest"],
    ["  adobe/brackets/  ", "adobe", "brackets"],
    ["git+https://github.com/request/request.git", "request", "request"],
  ])("reads %s", (input, owner, repo) => {
    expect(parseRepoInput(input)).toEqual({ owner, repo });
  });

  it.each(["", "atom", "https://github.com/atom", "-bad/name", "a/..", "has space/repo"])(
    "rejects %j",
    (input) => {
      expect(parseRepoInput(input)).toBeNull();
    }
  );
});
