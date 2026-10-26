"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import examplesJson from "@/lib/examples.json";
import { fetchSnapshot, LookupError, type Snapshot } from "@/lib/github";
import { buildOfrenda, longDate } from "@/lib/ofrenda";
import { checkReply, factsFor, MAX_NEW_TOKENS, messagesFor, type Part } from "@/lib/prompt";
import { parseRepoInput, repoKey } from "@/lib/repo";
import { getFlag, readSnapshot, saveSnapshot, setFlag } from "@/lib/cache";
import { detectBackend, MODELS, type Backend, type ModelKey, type WorkerResponse } from "@/lib/model";
import { OfrendaCard, type PartView } from "./card";
import { Candle, Marigold } from "./ornaments";

const EXAMPLES = examplesJson as Snapshot[];

type Lookup =
  | { state: "idle" }
  | { state: "loading"; label: string }
  | { state: "ready"; snap: Snapshot; fromSnapshot: boolean }
  | { state: "error"; kind: LookupError["kind"] | "invalid"; message: string; resetAt?: Date };

type ModelState =
  | { state: "off" }
  | { state: "loading"; loaded: number; total: number }
  | { state: "ready"; ms: number }
  | { state: "error"; message: string };

type PartState = PartView & { note?: string; ms?: number; tokens?: number };
type Parts = Record<Part, PartState>;

function clockTime(d: Date) {
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function mb(n: number) {
  return `${Math.round(n / 1e6)} MB`;
}

export default function OfrendaApp() {
  const [input, setInput] = useState("");
  const [lookup, setLookup] = useState<Lookup>({ state: "idle" });
  const [backend, setBackend] = useState<Backend | null>(null);
  const [modelKey, setModelKey] = useState<ModelKey>("small");
  const [model, setModel] = useState<ModelState>({ state: "off" });
  const [parts, setParts] = useState<Parts | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<"" | "link" | "png">("");
  const workerRef = useRef<Worker | null>(null);
  const runRef = useRef(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const factsRef = useRef("");
  const wroteFor = useRef("");

  const ofrenda = useMemo(() => (lookup.state === "ready" ? buildOfrenda(lookup.snap) : null), [lookup]);
  const facts = useMemo(() => (lookup.state === "ready" && ofrenda ? factsFor(ofrenda, lookup.snap) : ""), [lookup, ofrenda]);

  const factParts = useCallback((): Parts | null => {
    if (!ofrenda) return null;
    return {
      epitaph: { text: ofrenda.epitaph, source: "facts" },
      remembrance: { text: ofrenda.remembrance, source: "facts" },
    };
  }, [ofrenda]);

  const shown = parts ?? factParts();

  const onWorkerMessage = useCallback(
    (e: MessageEvent<WorkerResponse>) => {
      const msg = e.data;
      if (msg.type === "progress") {
        setModel({ state: "loading", loaded: msg.loaded, total: msg.total });
      } else if (msg.type === "ready") {
        setModel({ state: "ready", ms: msg.ms });
        setFlag("model-cached", msg.model);
      } else if (msg.type === "error" && msg.runId === undefined) {
        setModel({ state: "error", message: msg.message });
      } else if ("runId" in msg && msg.runId !== runRef.current) {
        return;
      } else if (msg.type === "done") {
        setBusy(false);
      } else if (msg.type === "token") {
        setParts((p) => {
          const cur = p ?? factParts();
          return cur ? { ...cur, [msg.id]: { text: msg.text.trim() || "...", source: "writing" } } : cur;
        });
      } else if (msg.type === "part") {
        const checked = checkReply(msg.id, msg.text, factsRef.current);
        setParts((prev) => {
          const p = prev ?? factParts();
          if (!p) return p;
          const base = { ms: msg.ms, tokens: msg.tokens };
          const next: PartState = checked.ok
            ? { text: checked.text, source: "model", ...base }
            : { text: factParts()?.[msg.id].text ?? "", source: "facts", note: checked.reason, ...base };
          return { ...p, [msg.id]: next };
        });
      } else if (msg.type === "error") {
        setBusy(false);
        setParts(factParts());
        setModel({ state: "error", message: msg.message });
      }
    },
    [factParts]
  );

  const worker = useCallback(() => {
    if (!workerRef.current) {
      const w = new Worker(new URL("../lib/worker.ts", import.meta.url), { type: "module" });
      w.onmessage = onWorkerMessage;
      workerRef.current = w;
    } else {
      workerRef.current.onmessage = onWorkerMessage;
    }
    return workerRef.current;
  }, [onWorkerMessage]);

  const loadModel = useCallback(
    (key: ModelKey, be: Backend) => {
      setModel({ state: "loading", loaded: 0, total: 0 });
      wroteFor.current = "";
      worker().postMessage({ type: "load", model: key, backend: be });
    },
    [worker]
  );

  const show = useCallback(async (raw: string, push = true) => {
    const ref = parseRepoInput(raw);
    if (!ref) {
      setLookup({
        state: "error",
        kind: "invalid",
        message: "That does not look like a GitHub repository. Try owner/name or paste its github.com link.",
      });
      return;
    }
    const key = repoKey(ref);
    setInput(`${ref.owner}/${ref.repo}`);
    setParts(null);
    runRef.current += 1;
    wroteFor.current = "";
    if (push) {
      const url = new URL(window.location.href);
      url.searchParams.set("repo", `${ref.owner}/${ref.repo}`);
      window.history.replaceState(null, "", url);
    }
    const example = EXAMPLES.find((s) => repoKey(s) === key);
    if (example) {
      setLookup({ state: "ready", snap: example, fromSnapshot: true });
      return;
    }
    const cached = readSnapshot(key);
    if (cached) {
      setLookup({ state: "ready", snap: cached, fromSnapshot: false });
      return;
    }
    setLookup({ state: "loading", label: `${ref.owner}/${ref.repo}` });
    try {
      const snap = await fetchSnapshot(ref);
      saveSnapshot(key, snap);
      setLookup({ state: "ready", snap, fromSnapshot: false });
    } catch (err) {
      if (err instanceof LookupError) {
        setLookup({ state: "error", kind: err.kind, message: err.message, resetAt: err.resetAt });
      } else {
        setLookup({ state: "error", kind: "unknown", message: "Something went wrong reading that repository." });
      }
    }
  }, []);

  // First visit: pick a backend and model for this device, open a shared link, and
  // reload the model by itself if its weights are already in the browser cache.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      const be = await detectBackend();
      const saved = getFlag("model-choice") as ModelKey | null;
      // The 1.5B model runs out of WebAssembly memory on the CPU path, so it is WebGPU only.
      const key: ModelKey = be === "wasm" ? "small" : saved && saved in MODELS ? saved : "large";
      setBackend(be);
      setModelKey(key);
      const repo = new URLSearchParams(window.location.search).get("repo");
      if (repo) void show(repo, false);
      if (getFlag("model-cached") === key) loadModel(key, be);
    })();
  }, [show, loadModel]);

  // When a card and a model are both ready, let the model write.
  useEffect(() => {
    if (model.state !== "ready" || !ofrenda || ofrenda.status === "alive" || !facts) return;
    const tag = `${ofrenda.fullName}:${modelKey}`;
    if (wroteFor.current === tag) return;
    wroteFor.current = tag;
    factsRef.current = facts;
    runRef.current += 1;
    const jobs = (["epitaph", "remembrance"] as Part[]).map((id) => ({
      id,
      messages: messagesFor(id, facts),
      maxNewTokens: MAX_NEW_TOKENS[id],
    }));
    setBusy(true);
    worker().postMessage({ type: "write", runId: runRef.current, jobs });
  }, [model, ofrenda, facts, modelKey, worker]);

  useEffect(() => () => workerRef.current?.terminate(), []);

  function switchModel(key: ModelKey) {
    setModelKey(key);
    setFlag("model-choice", key);
    setParts(null);
    if (backend && model.state !== "off") loadModel(key, backend);
    else setModel({ state: "off" });
  }

  async function copyLink() {
    if (!ofrenda) return;
    const url = `${window.location.origin}/?repo=${ofrenda.fullName}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied("link");
    } catch {
      window.prompt("Copy this link", url);
    }
    setTimeout(() => setCopied(""), 1800);
  }

  async function downloadPng() {
    if (!cardRef.current || !ofrenda) return;
    const { toPng } = await import("html-to-image");
    const dataUrl = await toPng(cardRef.current, { pixelRatio: 2, backgroundColor: "#120d11" });
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `last-commit-${ofrenda.name}.png`;
    a.click();
    setCopied("png");
    setTimeout(() => setCopied(""), 1800);
  }

  const m = MODELS[modelKey];
  const other: ModelKey = modelKey === "small" ? "large" : "small";
  const size = backend ? m.sizes[backend] : "";
  const writing = shown && (shown.epitaph.source === "writing" || shown.remembrance.source === "writing");
  const modelWrote = shown ? (["epitaph", "remembrance"] as Part[]).filter((p) => shown[p].source === "model") : [];
  const writtenBy =
    modelWrote.length === 2
      ? `Epitaph and remembrance written by ${m.short}, running in the browser`
      : modelWrote.length === 1
        ? `${modelWrote[0] === "epitaph" ? "Epitaph" : "Remembrance"} written by ${m.short} in the browser, the rest from public facts`
        : "Written from public facts";
  const readOn = lookup.state === "ready" ? longDate(lookup.snap.fetchedAt) : "";
  const notes = shown ? (["epitaph", "remembrance"] as Part[]).filter((p) => shown[p].ms !== undefined) : [];

  return (
    <main className="mx-auto flex w-full max-w-[640px] flex-col px-5 pb-24 pt-10 sm:pt-16">
      <header className="flex items-center gap-2 text-[13px] text-ash">
        <Candle className="h-7 w-3.5" />
        <span className="font-medium tracking-wide text-bone">Last Commit</span>
      </header>

      <h1 className="mt-8 text-balance font-serif text-[34px] leading-[1.1] tracking-[-0.015em] sm:text-[44px]">
        An ofrenda for the open source that went quiet.
      </h1>
      <p className="mt-4 max-w-[52ch] text-pretty text-[15.5px] leading-relaxed text-ash">
        Paste a public GitHub repository. Its own history, read from GitHub, fills the card. Then a small open-weight model,
        running in this tab, writes its epitaph.
      </p>

      <form
        className="mt-8 flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          void show(input);
        }}
      >
        <label htmlFor="repo" className="sr-only">
          GitHub repository
        </label>
        <input
          id="repo"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="github.com/owner/repo"
          autoComplete="off"
          spellCheck={false}
          className="h-12 min-w-0 flex-1 rounded-full border border-hairline bg-altar px-5 font-mono text-[14px] text-bone placeholder:text-dust focus:border-marigold/60 focus:outline-none focus:ring-2 focus:ring-marigold/20"
        />
        <button
          type="submit"
          disabled={lookup.state === "loading"}
          className="h-12 rounded-full bg-marigold px-6 text-[14.5px] font-medium text-night transition hover:bg-[#f5b04e] disabled:opacity-60"
        >
          Light a candle
        </button>
      </form>

      <div className="mt-4 flex flex-wrap items-center gap-x-1 gap-y-2 text-[13px] text-dust">
        <span className="mr-1">Or remember</span>
        {EXAMPLES.map((s) => (
          <button
            key={s.repo}
            type="button"
            onClick={() => void show(`${s.owner}/${s.repo}`)}
            className="rounded-full border border-hairline px-3 py-1 text-ash transition hover:border-marigold/50 hover:text-bone"
          >
            {s.repo}
          </button>
        ))}
      </div>

      <section className="mt-10" aria-live="polite">
        {lookup.state === "idle" && (
          <div className="rounded-[28px] border border-dashed border-hairline px-8 py-16 text-center">
            <Candle lit={false} className="mx-auto h-12 w-6 opacity-70" />
            <p className="mt-5 font-serif text-[20px] italic text-ash">Nothing on the altar yet.</p>
            <p className="mt-2 text-[13.5px] text-dust">Choose a repository you once relied on.</p>
          </div>
        )}

        {lookup.state === "loading" && (
          <div className="rounded-[28px] border border-hairline bg-altar px-8 py-16 text-center">
            <Marigold size={30} className="breathe mx-auto" />
            <p className="mt-5 text-[14px] text-ash">
              Reading the history of <span className="font-mono text-bone">{lookup.label}</span>
            </p>
          </div>
        )}

        {lookup.state === "error" && (
          <div className="rounded-[28px] border border-hairline bg-altar px-8 py-12 text-center">
            <p className="font-serif text-[21px] italic">
              {lookup.kind === "rate-limited"
                ? "The spirits need a rest."
                : lookup.kind === "not-found"
                  ? "No one by that name rests here."
                  : lookup.kind === "empty"
                    ? "Nothing was ever written here."
                    : lookup.kind === "invalid"
                      ? "That name does not ring a bell."
                      : "The candle would not light."}
            </p>
            <p className="mx-auto mt-3 max-w-[46ch] text-[14px] leading-relaxed text-ash">
              {lookup.message}
              {lookup.kind === "rate-limited" && lookup.resetAt && ` It resets at ${clockTime(lookup.resetAt)}.`}
              {lookup.kind === "rate-limited" && " The examples above still work, they are saved with the app."}
            </p>
          </div>
        )}

        {lookup.state === "ready" && ofrenda && shown && (
          <div className="rise">
            <OfrendaCard
              ref={cardRef}
              ofrenda={ofrenda}
              epitaph={shown.epitaph}
              remembrance={shown.remembrance}
              writtenBy={writtenBy}
              readOn={readOn}
            />

            <div className="mt-5 flex flex-wrap gap-2 text-[13.5px]">
              <button type="button" onClick={() => void downloadPng()} className="rounded-full border border-hairline px-4 py-2 text-bone transition hover:border-marigold/50">
                {copied === "png" ? "Saved" : "Download card"}
              </button>
              <button type="button" onClick={() => void copyLink()} className="rounded-full border border-hairline px-4 py-2 text-bone transition hover:border-marigold/50">
                {copied === "link" ? "Link copied" : "Copy link"}
              </button>
              <a href={`${ofrenda.url}/fork`} target="_blank" rel="noreferrer" className="rounded-full border border-hairline px-4 py-2 text-bone transition hover:border-marigold/50">
                Fork it
              </a>
              <a href={ofrenda.url} target="_blank" rel="noreferrer" className="rounded-full border border-hairline px-4 py-2 text-bone transition hover:border-marigold/50">
                Leave a star
              </a>
            </div>
            <p className="mt-4 text-pretty text-[13.5px] leading-relaxed text-ash">{ofrenda.nudge}</p>
            {lookup.fromSnapshot && (
              <p className="mt-2 text-[12px] text-dust">This example is saved with the app, read from GitHub on {readOn}.</p>
            )}

            {ofrenda.status !== "alive" && (
              <div className="mt-8 rounded-2xl border border-hairline bg-altar/70 p-5">
                <ModelPanel
                  state={model}
                  name={m.name}
                  size={size}
                  backend={backend}
                  writing={busy || Boolean(writing)}
                  onLoad={() => backend && loadModel(modelKey, backend)}
                  otherName={MODELS[other].short}
                  otherSize={backend ? MODELS[other].sizes[backend] : ""}
                  onSwitch={() => switchModel(other)}
                />
                {notes.length > 0 && shown && (
                  <ul className="mt-4 space-y-1 border-t border-hairline pt-4 text-[12.5px] text-dust">
                    {notes.map((p) => (
                      <li key={p}>
                        <span className="text-ash">{p === "epitaph" ? "Epitaph" : "Remembrance"}:</span>{" "}
                        {shown[p].tokens} tokens in {((shown[p].ms ?? 0) / 1000).toFixed(1)} s
                        {shown[p].note ? `. Set aside (${shown[p].note}), so the line from the facts stays.` : "."}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      <section className="mt-16 space-y-5 text-[14.5px] leading-relaxed text-ash">
        <h2 className="font-serif text-[22px] text-bone">How it works</h2>
        <p>
          <span className="text-bone">The facts come first.</span> Your browser asks GitHub&apos;s public API for the repository, its last ten
          commits, its top contributors and its README. The last words are the newest commit a person wrote, skipping merges and version
          bumps. The card is complete before any model runs.
        </p>
        <p>
          <span className="text-bone">Then a model writes.</span> Qwen2.5 Instruct, an open-weight model under the Apache 2.0 license, runs
          inside this tab with Transformers.js, on WebGPU when your browser has it and on the CPU when it does not. It only sees a few
          lines of facts. Every reply is checked, and anything that invents a number, slips into first person or rambles is set aside.
        </p>
        <p>
          <span className="text-bone">Nothing leaves your machine</span> except the GitHub lookups. There is no server, no account and no
          key. After the first download the model is cached, so it keeps working even if the model host goes away.
        </p>
      </section>

      <footer className="mt-16 border-t border-hairline pt-6 text-[12.5px] leading-relaxed text-dust">
        <p>
          Made for Dia de los Muertos 2026. Open source under the MIT license on{" "}
          <a className="underline decoration-hairline underline-offset-4 hover:text-bone" href="https://github.com/Joe-Simo/last-commit">
            GitHub
          </a>
          . Built with help from an AI coding assistant. The words on each card come from Qwen2.5 in your browser, or from the facts alone.
        </p>
      </footer>
    </main>
  );
}

function ModelPanel(props: {
  state: ModelState;
  name: string;
  size: string;
  backend: Backend | null;
  writing: boolean;
  onLoad: () => void;
  otherName: string;
  otherSize: string;
  onSwitch: () => void;
}) {
  const { state } = props;
  const where = props.backend === "webgpu" ? "on your GPU" : "on your CPU";
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[14px] text-bone">{props.name}</p>
          <p className="text-[12.5px] text-dust">
            Open weights, runs {where}
            {props.size ? `, ${props.size} the first time` : ""}
          </p>
        </div>
        {state.state === "off" && (
          <button type="button" onClick={props.onLoad} disabled={!props.backend} className="rounded-full bg-bone px-4 py-2 text-[13.5px] font-medium text-night transition hover:bg-white disabled:opacity-50">
            Let it write
          </button>
        )}
        {state.state === "error" && (
          <button type="button" onClick={props.onLoad} className="rounded-full border border-hairline px-4 py-2 text-[13.5px] text-bone">
            Try again
          </button>
        )}
      </div>
      {state.state === "loading" && (
        <div className="mt-4">
          <div className="h-1 overflow-hidden rounded-full bg-hairline">
            <div className="h-full rounded-full bg-marigold transition-[width] duration-300" style={{ width: state.total ? `${(state.loaded / state.total) * 100}%` : "4%" }} />
          </div>
          <p className="mt-2 text-[12.5px] text-dust">
            {state.total ? `Downloading ${mb(state.loaded)} of ${mb(state.total)}. Only the first time.` : "Waking the model..."}
          </p>
        </div>
      )}
      {state.state === "ready" && (
        <p className="mt-3 text-[12.5px] text-dust">
          {props.writing ? "Writing, word by word..." : `Ready. Loaded in ${(state.ms / 1000).toFixed(1)} s. Pick another repository and it writes again.`}
        </p>
      )}
      {state.state === "error" && (
        <p className="mt-3 text-[12.5px] text-rose">
          The model could not run here ({/bad_alloc|memory/i.test(state.message) ? "it ran out of memory" : state.message}). The card from the facts is still yours to keep.
        </p>
      )}
      {props.backend === "webgpu" ? (
        <button type="button" onClick={props.onSwitch} className="mt-3 text-[12.5px] text-ash underline decoration-hairline underline-offset-4 hover:text-bone">
          Swap to {props.otherName}
          {props.otherSize ? ` (${props.otherSize})` : ""}
        </button>
      ) : props.backend === "wasm" ? (
        <p className="mt-3 text-[12.5px] text-dust">The larger 1.5B model writes better lines, but it needs WebGPU, which this browser does not offer.</p>
      ) : null}
    </div>
  );
}
