import type { Snapshot } from "./github";
import type { Ofrenda } from "./ofrenda";
import { cleanDescription } from "./ofrenda";
import { clip } from "./readme";

export type Message = { role: "system" | "user" | "assistant"; content: string };
export type Part = "epitaph" | "remembrance";

/** The only facts the model sees. Short on purpose: a small model does best with little to misread. */
export function factsFor(o: Ofrenda, s: Pick<Snapshot, "readmeIntro">): string {
  const about = [o.about, s.readmeIntro && s.readmeIntro !== o.about ? clip(cleanDescription(s.readmeIntro), 220) : ""]
    .filter(Boolean)
    .join(" ");
  return [
    `Project: ${o.name}`,
    `About: ${about || "No description was left behind."}`,
    `Active: ${o.years}`,
    `Now: ${o.status === "archived" ? "archived, read only" : `no commits for ${o.quietFor}`}`,
  ].join("\n");
}

const EPITAPH_SYSTEM =
  "You write epitaphs for open-source projects that have gone quiet, for a Day of the Dead ofrenda. Tender, a little haunting, specific to what the project did. One sentence, under 14 words. No quotes, no hashtags.";

const REMEMBRANCE_SYSTEM =
  'You write a short remembrance for an open-source project that has gone quiet, for a Day of the Dead ofrenda. Speak to the project as "you". Two sentences: what you made possible, then what you leave behind. Warm, specific, a little haunting. No quotes.';

const LEFT_PAD =
  "Project: left-pad\nAbout: String left pad. Pads the left side of a string with spaces or zeros.\nActive: 2014 to 2016\nNow: no commits for 9 years";
const JSHINT =
  "Project: jshint\nAbout: JSHint is a tool that helps to detect errors and potential problems in your JavaScript code.\nActive: 2011 to 2020\nNow: no commits for 5 years";

export function messagesFor(part: Part, facts: string): Message[] {
  if (part === "epitaph") {
    return [
      { role: "system", content: EPITAPH_SYSTEM },
      { role: "user", content: LEFT_PAD },
      { role: "assistant", content: "It held eleven lines, and when it left, the whole web felt the gap." },
      { role: "user", content: JSHINT },
      { role: "assistant", content: "It read every line we wrote and warned us kindly, long before we listened." },
      { role: "user", content: facts },
    ];
  }
  return [
    { role: "system", content: REMEMBRANCE_SYSTEM },
    { role: "user", content: LEFT_PAD },
    {
      role: "assistant",
      content:
        "You did one small thing, padding strings, and thousands of builds leaned on you without knowing your name. When you were gone for an afternoon, we finally learned how much we owed the smallest pieces.",
    },
    { role: "user", content: facts },
  ];
}

export const MAX_NEW_TOKENS: Record<Part, number> = { epitaph: 32, remembrance: 96 };

export type Checked = { ok: true; text: string } | { ok: false; reason: string };

const CHATTER = /\b(as an ai|language model|i'm sorry|i am sorry|i cannot|i can't|sure[,!]|here is|here's)\b/i;

/**
 * Cleans a model reply and decides whether it is fit for the card.
 * Anything doubtful is rejected so the factual fallback text stays instead.
 */
export function checkReply(part: Part, raw: string, facts: string): Checked {
  let t = raw
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/^\s*(epitaph|remembrance)\s*:\s*/i, "")
    .replace(/[*_#`]/g, "")
    .replace(/\s[\u2013\u2014]\s?/g, ", ")
    .replace(/[\u2013\u2014]/g, ", ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^["'\u201c\u2018]+|["'\u201d\u2019]+$/g, "")
    .trim();
  if (!t) return { ok: false, reason: "empty" };
  if (CHATTER.test(t)) return { ok: false, reason: "chatter" };
  if (/[^\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}]|\ufffd/u.test(t)) {
    return { ok: false, reason: "garbled" };
  }
  // The card speaks about the project, never as a person who used it.
  if (/(^|[\s,;])(i|i'm|i've|i'd|i'll|me|my|mine)(?=[\s,.;!?]|$)/i.test(t)) {
    return { ok: false, reason: "first person" };
  }
  if (/https?:|www\./i.test(t)) return { ok: false, reason: "link" };
  if (/\p{Extended_Pictographic}/u.test(t)) return { ok: false, reason: "emoji" };
  if (/(^|\s)(project|about|active|now):/i.test(t)) return { ok: false, reason: "echoed the prompt" };

  const sentences = t.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g)?.map((s) => s.trim()) ?? [t];
  if (part === "epitaph") {
    t = sentences[0];
  } else {
    // Drop a trailing fragment cut off by the token limit, keep at most three sentences.
    const whole = sentences.filter((s) => /[.!?]$/.test(s));
    t = (whole.length ? whole : sentences).slice(0, 3).join(" ");
  }
  if (!/[.!?]$/.test(t)) t += ".";

  const words = t.split(/\s+/).length;
  if (words < 4) return { ok: false, reason: "too short" };
  if (part === "epitaph" && words > 22) return { ok: false, reason: "too long" };
  if (part === "remembrance" && words > 80) return { ok: false, reason: "too long" };

  // Numbers are where small models invent things. Every number must appear in the facts.
  const known = new Set(facts.match(/\d+/g) ?? []);
  const invented = (t.match(/\d+/g) ?? []).filter((n) => !known.has(n));
  if (invented.length) return { ok: false, reason: `invented a number (${invented[0]})` };

  return { ok: true, text: t };
}
