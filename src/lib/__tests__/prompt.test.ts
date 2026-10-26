import { describe, expect, it } from "vitest";
import examples from "../examples.json";
import type { Snapshot } from "../github";
import { buildOfrenda } from "../ofrenda";
import { checkReply, factsFor, messagesFor } from "../prompt";

const NOW = new Date("2026-10-26T19:00:00Z");
const atom = (examples as Snapshot[]).find((s) => s.repo === "atom")!;
const facts = factsFor(buildOfrenda(atom, NOW), atom);

describe("factsFor", () => {
  it("keeps the facts short and real", () => {
    expect(facts).toContain("Project: atom");
    expect(facts).toContain("Active: 2012 to 2022");
    expect(facts).toContain("Now: archived, read only");
    expect(facts).toContain("hackable text editor for the 21st century");
  });
  it("ends every prompt with the project's own facts", () => {
    expect(messagesFor("epitaph", facts).at(-1)?.content).toBe(facts);
    expect(messagesFor("remembrance", facts).at(-1)?.content).toBe(facts);
  });
});

describe("checkReply", () => {
  it("accepts a clean epitaph and strips quotes", () => {
    expect(checkReply("epitaph", '"It was always ready, even when you were not."', facts)).toEqual({
      ok: true,
      text: "It was always ready, even when you were not.",
    });
  });
  it("keeps only the first sentence of an epitaph", () => {
    const r = checkReply("epitaph", "It bent to every hand that held it. And then it slept.", facts);
    expect(r).toEqual({ ok: true, text: "It bent to every hand that held it." });
  });
  it("replaces dashes with commas", () => {
    const r = checkReply("epitaph", "It was hackable \u2014 and loved by many people.", facts);
    expect(r).toEqual({ ok: true, text: "It was hackable, and loved by many people." });
  });
  it("drops a remembrance sentence cut off by the token limit", () => {
    const r = checkReply("remembrance", "You let us bend an editor to our will. You leave behind a thousand packages and", facts);
    expect(r).toEqual({ ok: true, text: "You let us bend an editor to our will." });
  });
  it.each([
    ["", "empty"],
    ["Sure, here is an epitaph for you.", "chatter"],
    ["I loved this editor so much.", "first person"],
    ["It had 90000 stars and never slept.", "invented a number (90000)"],
    ["Read more at https://atom.io today.", "link"],
    ["Project: atom was here.", "echoed the prompt"],
    ["Gone.", "too short"],
    ["Brackets was my first experience with coding.", "first person"],
    ["I\u2019m sorry, but I can\u2019t see any content.", "chatter"],
    ["It was \u770b\u4ed6\u5199\u7684 code that we loved.", "garbled"],
  ])("rejects %j", (raw, reason) => {
    expect(checkReply("epitaph", raw, facts)).toEqual({ ok: false, reason });
  });
  it("allows numbers that are in the facts", () => {
    expect(checkReply("epitaph", "From 2012 to 2022 it let us shape our tools.", facts).ok).toBe(true);
  });
});
