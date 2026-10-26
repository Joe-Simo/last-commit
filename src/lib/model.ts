import type { Message, Part } from "./prompt";

/**
 * Two sizes of the same open-weight family. Both are Apache 2.0 and run fully in the browser.
 * Sizes are the weight files on Hugging Face for each backend.
 */
export const MODELS = {
  small: {
    id: "onnx-community/Qwen2.5-0.5B-Instruct",
    name: "Qwen2.5 0.5B Instruct",
    short: "Qwen2.5 0.5B",
    sizes: { webgpu: "about 480 MB", wasm: "about 790 MB" },
  },
  large: {
    id: "onnx-community/Qwen2.5-1.5B-Instruct",
    name: "Qwen2.5 1.5B Instruct",
    short: "Qwen2.5 1.5B",
    sizes: { webgpu: "about 1.2 GB", wasm: "about 1.8 GB" },
  },
} as const;

export type ModelKey = keyof typeof MODELS;

export const BACKENDS = {
  webgpu: { device: "webgpu", dtype: "q4f16" },
  // On the CPU path the 8-bit export produced garbled text in testing, so it uses 4-bit weights too.
  wasm: { device: "wasm", dtype: "q4" },
} as const;

export type Backend = keyof typeof BACKENDS;

export type Job = { id: Part; messages: Message[]; maxNewTokens: number };

export type WorkerRequest =
  | { type: "load"; model: ModelKey; backend: Backend }
  | { type: "write"; runId: number; jobs: Job[] };

export type WorkerResponse =
  | { type: "progress"; loaded: number; total: number }
  | { type: "ready"; model: ModelKey; backend: Backend; ms: number }
  | { type: "token"; runId: number; id: Part; text: string }
  | { type: "part"; runId: number; id: Part; text: string; ms: number; tokens: number }
  | { type: "done"; runId: number }
  | { type: "error"; message: string; runId?: number };

export async function detectBackend(): Promise<Backend> {
  try {
    const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
    if (gpu && (await gpu.requestAdapter())) return "webgpu";
  } catch {
    // WebGPU is not available here, use WebAssembly.
  }
  return "wasm";
}
