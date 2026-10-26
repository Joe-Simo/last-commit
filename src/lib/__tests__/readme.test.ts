import { describe, expect, it } from "vitest";
import { clip, readmeIntro } from "../readme";

describe("readmeIntro", () => {
  it("skips headings, badges and HTML to find the first paragraph", () => {
    const md = `<p align="center"><img src="logo.png"></p>

# Project

[![Build](https://x/badge.svg)](https://x) ![npm][npm-url]

A **tiny** library that [pads strings](https://example.com) on the \`left\` side, for everyone.

## Install`;
    expect(readmeIntro(md)).toBe("A tiny library that pads strings on the left side, for everyone.");
  });

  it("ignores reference definitions, lists and code", () => {
    const md = "[npm-url]: https://npm\n\n- one\n- two\n\n```js\nconst a = 1\n```\n\nIt keeps your generators flowing in a nice way.";
    expect(readmeIntro(md)).toBe("It keeps your generators flowing in a nice way.");
  });

  it("returns empty text when there is no prose", () => {
    expect(readmeIntro("# Title\n\n![x](y)")).toBe("");
  });

  it("clips long text at a sentence when it can", () => {
    expect(clip("One two three four. Five six seven eight nine ten.", 30)).toBe("One two three four.");
    expect(clip("aaaa bbbb cccc dddd eeee", 12)).toBe("aaaa bbbb...");
  });
});
