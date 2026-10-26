// Refreshes src/lib/examples.json with live GitHub data for the curated examples.
// Run with: bun scripts/snapshot-examples.ts (set GITHUB_TOKEN to avoid the 60 an hour limit).
import { writeFileSync } from "node:fs";
import { fetchSnapshot } from "../src/lib/github";

const EXAMPLES = ["atom/atom", "adobe/brackets", "angular/angular.js", "mozilla/BrowserQuest", "tj/co"];

const token = process.env.GITHUB_TOKEN;
const authed: typeof fetch = (input, init) =>
  fetch(input, {
    ...init,
    headers: { ...(init?.headers as Record<string, string>), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });

const out = [];
for (const full of EXAMPLES) {
  const [owner, repo] = full.split("/");
  const snap = await fetchSnapshot({ owner, repo }, authed);
  console.log(full, snap.archived ? "archived" : "not archived", snap.commits[0]?.date);
  out.push(snap);
}
writeFileSync(new URL("../src/lib/examples.json", import.meta.url), JSON.stringify(out, null, 2) + "\n");
