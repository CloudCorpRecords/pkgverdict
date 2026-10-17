/** Tiny file cache: registry responses under ~/.cache/pkgverdict. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const DIR = join(homedir(), ".cache", "pkgverdict");

export function cacheDir(): string {
  return DIR;
}

function pathFor(key: string): string {
  const safe = key.replace(/[^a-zA-Z0-9@._-]+/g, "_");
  return join(DIR, safe + ".json");
}

export function cacheGet<T>(key: string, maxAgeMs: number): T | null {
  try {
    const p = pathFor(key);
    if (!existsSync(p)) return null;
    const raw = JSON.parse(readFileSync(p, "utf8")) as { savedAt: number; data: T };
    if (!raw || typeof raw.savedAt !== "number" || Date.now() - raw.savedAt > maxAgeMs) return null;
    return raw.data;
  } catch {
    return null;
  }
}

export function cacheSet(key: string, data: unknown): void {
  try {
    mkdirSync(DIR, { recursive: true });
    writeFileSync(pathFor(key), JSON.stringify({ savedAt: Date.now(), data }));
  } catch {
    // Cache is best-effort; a read-only home must not break checks.
  }
}
