/**
 * Pulls the first real paragraph of prose out of a README: skips headings, badges,
 * images, HTML, code, tables and lists, then strips Markdown so a model can read it.
 */
export function readmeIntro(markdown: string, maxChars = 320): string {
  const text = markdown
    .replace(/\r\n?/g, "\n")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/```[\s\S]*?```/g, "\n")
    .replace(/~~~[\s\S]*?~~~/g, "\n");

  const blocks = text.split(/\n\s*\n/);
  for (const raw of blocks) {
    const lines = raw
      .split("\n")
      .map((l) => l.trim())
      .filter(
        (l) =>
          l &&
          !/^#{1,6}\s/.test(l) &&
          !/^(=+|-+)$/.test(l) &&
          !/^[|>]/.test(l) &&
          !/^([-*+]|\d+\.)\s/.test(l) &&
          !/^<\/?[a-z]/i.test(l) &&
          !/^\[[^\]]+\]:\s/.test(l)
      );
    if (!lines.length) continue;
    const cleaned = stripInline(lines.join(" "));
    // A paragraph needs some words to count as prose, not a row of badges.
    if (cleaned.split(/\s+/).filter((w) => /[a-z]{2,}/i.test(w)).length < 5) continue;
    return clip(cleaned, maxChars);
  }
  return "";
}

function stripInline(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/\[!\[[^\]]*\]\[[^\]]*\]\]\[[^\]]*\]/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/!\[[^\]]*\]\[[^\]]*\]/g, " ")
    .replace(/\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\[[^\]]*\]/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/(\*\*|__)(.+?)\1/g, "$2")
    .replace(/(^|\s)[*_](.+?)[*_](?=\s|$|[.,;:!?])/g, "$1$2")
    .replace(/:[a-z0-9_+-]+:/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export function clip(s: string, maxChars: number): string {
  if (s.length <= maxChars) return s;
  const cut = s.slice(0, maxChars);
  const sentence = cut.lastIndexOf(". ");
  if (sentence > maxChars * 0.5) return cut.slice(0, sentence + 1);
  return cut.replace(/\s+\S*$/, "") + "...";
}
