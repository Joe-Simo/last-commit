import type { Snapshot } from "./github";

export type Status = "archived" | "silent" | "fading" | "alive";

export type Ofrenda = {
  name: string;
  fullName: string;
  url: string;
  status: Status;
  statusLabel: string;
  born: string;
  lastCommitDate: string;
  years: string;
  quietFor: string;
  quietDays: number;
  about: string;
  lastWords: { message: string; date: string; url: string; author: string } | null;
  tenders: string[];
  tendersMore: boolean;
  stars: number;
  forks: number;
  epitaph: string;
  remembrance: string;
  nudge: string;
};

const DAY = 24 * 60 * 60 * 1000;
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function monthYear(iso: string): string {
  const d = new Date(iso);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function longDate(iso: string): string {
  const d = new Date(iso);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

export function formatCount(n: number): string {
  return n.toLocaleString("en-US");
}

/** "3 years and 11 months", "8 months", "12 days". Calendar based, in UTC. */
export function quietDuration(fromIso: string, now: Date): string {
  const from = new Date(fromIso);
  let months =
    (now.getUTCFullYear() - from.getUTCFullYear()) * 12 + (now.getUTCMonth() - from.getUTCMonth());
  if (now.getUTCDate() < from.getUTCDate()) months -= 1;
  if (months < 1) {
    const days = Math.max(0, Math.floor((now.getTime() - from.getTime()) / DAY));
    return days === 1 ? "1 day" : `${days} days`;
  }
  const y = Math.floor(months / 12);
  const m = months % 12;
  const ys = y === 1 ? "1 year" : `${y} years`;
  const ms = m === 1 ? "1 month" : `${m} months`;
  if (!y) return ms;
  if (!m) return ys;
  return `${ys} and ${ms}`;
}

export function statusOf(snapshot: Pick<Snapshot, "archived">, quietDays: number): Status {
  if (snapshot.archived) return "archived";
  if (quietDays >= 365) return "silent";
  if (quietDays >= 180) return "fading";
  return "alive";
}

const STATUS_LABEL: Record<Status, string> = {
  archived: "Archived",
  silent: "Gone quiet",
  fading: "Fading",
  alive: "Still breathing",
};

const NOISE = [
  /^merge (pull request|branch|remote-tracking|tag)\b/i,
  /^v?\d+\.\d+(\.\d+)?([-.+][\w.]+)?$/i,
  /^(bump|release|prepare) (version|v?\d)/i,
  /^\[?skip ci\]?$/i,
];

/** The first line of a commit message, without trailers or a trailing period run. */
export function subjectOf(message: string): string {
  return message.split("\n")[0].trim();
}

/**
 * The project's last words: the newest commit that a person actually wrote.
 * Merge commits and version bumps are skipped; if nothing else exists, the newest commit is used.
 */
export function lastWordsOf(commits: Snapshot["commits"]): Snapshot["commits"][number] | null {
  if (!commits.length) return null;
  return commits.find((c) => !NOISE.some((re) => re.test(subjectOf(c.message)))) ?? commits[0];
}

/** Removes emoji shortcodes, pictographs, and dashes the card does not use. */
export function cleanDescription(s: string): string {
  return s
    .replace(/^\s*\[?(deprecated|archived|unmaintained|no longer maintained)\]?\s*[-:,]*\s*/i, "")
    .replace(/:[a-z0-9_+-]+:/gi, " ")
    .replace(/\p{Extended_Pictographic}/gu, " ")
    .replace(/\p{Emoji_Modifier}/gu, "")
    .replace(/[\u200d\ufe0f]/g, "")
    .replace(/\s[\u2013\u2014]\s/g, ", ")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function hash(s: string): number {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

function sentence(s: string): string {
  const t = s.trim();
  if (!t) return t;
  const cap = t[0].toUpperCase() + t.slice(1);
  return /[.!?]$/.test(cap) ? cap : `${cap}.`;
}

export function fallbackEpitaph(o: Pick<Ofrenda, "name" | "stars" | "forks" | "quietFor" | "lastCommitDate" | "status">): string {
  if (o.status === "alive") return `${o.name} is still here. Someone touched it ${o.quietFor} ago.`;
  const since = monthYear(o.lastCommitDate);
  const options = [
    `Starred by ${formatCount(o.stars)} people. Quiet since ${since}.`,
    `It gave ${formatCount(o.forks)} forks a place to begin, then rested in ${since}.`,
    `Its last words were a commit. Then ${o.quietFor} of silence.`,
  ];
  if (o.forks < 10) options.splice(1, 1);
  return options[hash(o.name) % options.length];
}

export function fallbackRemembrance(o: Pick<Ofrenda, "about" | "years" | "tenders" | "forks" | "lastCommitDate" | "status" | "name">): string {
  const parts: string[] = [];
  if (o.about) parts.push(sentence(o.about));
  const hands = o.tenders.length
    ? `${o.tenders.length === 1 ? "one pair of hands" : "many hands"}, ${o.tenders[0]} first among them`
    : "the people who cared for it";
  parts.push(`Across ${o.years.includes(" to ") ? o.years : `the year ${o.years}`}, it was tended by ${hands}.`);
  if (o.forks > 0) {
    parts.push(
      `${formatCount(o.forks)} ${o.forks === 1 ? "person" : "people"} carried a copy home, so it lives on somewhere.`
    );
  }
  if (o.status !== "alive") parts.push(`The last change landed on ${longDate(o.lastCommitDate)}.`);
  return parts.join(" ");
}

const NUDGE: Record<Status, string> = {
  archived: "It is archived and can no longer take changes. If you still need it, fork it and keep the candle lit.",
  silent: "Someone may still be listening. Open an issue to say thank you, or fork it and carry it on.",
  fading: "It is not gone yet. A thank you, a fix, or a fork could still wake it.",
  alive: "No ofrenda needed. Go thank whoever keeps it alive while they can still hear you.",
};

export function buildOfrenda(s: Snapshot, now: Date = new Date()): Ofrenda {
  const newest = s.commits[0];
  const lastCommitDate = newest?.date || s.pushedAt;
  const quietDays = Math.max(0, Math.floor((now.getTime() - new Date(lastCommitDate).getTime()) / DAY));
  const status = statusOf(s, quietDays);
  const bornYear = new Date(s.createdAt).getUTCFullYear();
  const lastYear = new Date(lastCommitDate).getUTCFullYear();
  const years = status === "alive" ? `${bornYear} to now` : bornYear === lastYear ? `${bornYear}` : `${bornYear} to ${lastYear}`;
  const words = lastWordsOf(s.commits);
  const tenders = s.contributors.slice(0, 3).map((c) => c.login);
  const about = cleanDescription(s.description) || cleanDescription(s.readmeIntro.split(/(?<=\.)\s/)[0] ?? "");

  const base = {
    name: s.repo,
    fullName: `${s.owner}/${s.repo}`,
    url: s.url,
    status,
    statusLabel: STATUS_LABEL[status],
    born: s.createdAt,
    lastCommitDate,
    years,
    quietFor: quietDuration(lastCommitDate, now),
    quietDays,
    about,
    lastWords: words
      ? { message: subjectOf(words.message), date: words.date, url: words.url, author: words.author }
      : null,
    tenders,
    tendersMore: s.contributors.length > 3,
    stars: s.stars,
    forks: s.forks,
    nudge: NUDGE[status],
  };
  return {
    ...base,
    epitaph: fallbackEpitaph(base),
    remembrance: fallbackRemembrance(base),
  };
}
