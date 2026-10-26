import type { Snapshot } from "./github";

const SNAP_TTL = 6 * 60 * 60 * 1000;

function store(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readSnapshot(key: string): Snapshot | null {
  const raw = store()?.getItem(`lc:snap:${key}`);
  if (!raw) return null;
  try {
    const { at, snap } = JSON.parse(raw) as { at: number; snap: Snapshot };
    return Date.now() - at < SNAP_TTL ? snap : null;
  } catch {
    return null;
  }
}

export function saveSnapshot(key: string, snap: Snapshot) {
  try {
    store()?.setItem(`lc:snap:${key}`, JSON.stringify({ at: Date.now(), snap }));
  } catch {
    // Storage full or blocked. The card still works, it just fetches again next time.
  }
}

export function getFlag(name: string): string | null {
  return store()?.getItem(`lc:${name}`) ?? null;
}

export function setFlag(name: string, value: string) {
  try {
    store()?.setItem(`lc:${name}`, value);
  } catch {
    // Ignore.
  }
}
