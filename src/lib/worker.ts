/// <reference lib="webworker" />
import { pipeline, TextStreamer, type TextGenerationPipeline } from "@huggingface/transformers";
import { BACKENDS, MODELS, type ModelKey, type Backend, type WorkerRequest, type WorkerResponse } from "./model";

let generator: TextGenerationPipeline | null = null;
let loadedKey = "";
let loading: Promise<TextGenerationPipeline> | null = null;
let latestRun = 0;
let queue: Promise<void> = Promise.resolve();

const post = (msg: WorkerResponse) => self.postMessage(msg);

async function load(model: ModelKey, backend: Backend) {
  const key = `${model}:${backend}`;
  if (generator && loadedKey === key) return generator;
  if (loading && loadedKey === key) return loading;
  if (generator) {
    await generator.dispose();
    generator = null;
  }
  loadedKey = key;
  const started = performance.now();
  const files = new Map<string, { loaded: number; total: number }>();
  loading = (
    pipeline("text-generation", MODELS[model].id, {
      device: BACKENDS[backend].device,
      dtype: BACKENDS[backend].dtype,
      progress_callback: (p: { status: string; file?: string; loaded?: number; total?: number }) => {
        if (p.status !== "progress" || !p.file || !p.total) return;
        files.set(p.file, { loaded: p.loaded ?? 0, total: p.total });
        let loaded = 0;
        let total = 0;
        for (const f of files.values()) {
          loaded += f.loaded;
          total += f.total;
        }
        post({ type: "progress", loaded, total });
      },
    }) as Promise<TextGenerationPipeline>
  ).then((g) => {
    generator = g;
    post({ type: "ready", model, backend, ms: Math.round(performance.now() - started) });
    return g;
  });
  loading.catch(() => {
    loading = null;
    loadedKey = "";
  });
  return loading;
}

async function write(msg: Extract<WorkerRequest, { type: "write" }>) {
  if (msg.runId !== latestRun) return;
  try {
    if (!generator) throw new Error("The model is not loaded yet.");
    const g = generator;
    for (const job of msg.jobs) {
      if (msg.runId !== latestRun) return;
      const started = performance.now();
      let text = "";
      let tokens = 0;
      const streamer = new TextStreamer(g.tokenizer, {
        skip_prompt: true,
        skip_special_tokens: true,
        callback_function: (chunk: string) => {
          text += chunk;
          if (msg.runId === latestRun) post({ type: "token", runId: msg.runId, id: job.id, text });
        },
        token_callback_function: () => {
          tokens += 1;
        },
      });
      const out = (await g(job.messages as never, {
        max_new_tokens: job.maxNewTokens,
        do_sample: false,
        repetition_penalty: 1.1,
        streamer,
      })) as unknown as { generated_text: { role: string; content: string }[] }[];
      if (msg.runId !== latestRun) return;
      const final = out[0]?.generated_text.at(-1)?.content ?? text;
      post({ type: "part", runId: msg.runId, id: job.id, text: final, ms: Math.round(performance.now() - started), tokens });
    }
    post({ type: "done", runId: msg.runId });
  } catch (err) {
    post({ type: "error", runId: msg.runId, message: err instanceof Error ? err.message : String(err) });
  }
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data;
  if (msg.type === "load") {
    try {
      await load(msg.model, msg.backend);
    } catch (err) {
      post({ type: "error", message: err instanceof Error ? err.message : String(err) });
    }
    return;
  }
  if (msg.type === "write") {
    latestRun = msg.runId;
    // One generation at a time. A newer card cancels older ones between parts.
    queue = queue.then(() => write(msg));
  }
};
