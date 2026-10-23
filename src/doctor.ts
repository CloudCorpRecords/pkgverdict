/**
 * `pkgverdict doctor`: is this machine ready to check packages?
 */
import { cacheDir } from "./cache.js";
import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";

export interface DoctorLine {
  name: string;
  ok: boolean;
  detail: string;
}

async function reachableOnce(url: string, init?: RequestInit): Promise<boolean> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    // Any HTTP answer (even an error status) proves the host is up.
    await fetch(url, { ...init, signal: ctrl.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Reachability probe. PV-9: OSV flapped once in production validation — a
 * single transient fetch failure (timeout, reset) reported NOT READY while
 * the API was up. Callers that pass `retries` get that many extra attempts
 * before the probe is allowed to declare the host down.
 */
export async function reachable(url: string, init?: RequestInit, retries = 0): Promise<boolean> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (await reachableOnce(url, init)) return true;
    if (attempt < retries) await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

export async function doctor(): Promise<{ lines: DoctorLine[]; ready: boolean }> {
  const lines: DoctorLine[] = [];
  const major = Number(process.versions.node.split(".")[0]);
  lines.push({
    name: "node",
    ok: major >= 20,
    detail: major >= 20 ? `${process.version} (>= v20 required)` : `${process.version} is too old; pkgverdict needs Node 20+`,
  });
  lines.push({
    name: "npm registry",
    ok: await reachable("https://registry.npmjs.org/pkgverdict"),
    detail: "https://registry.npmjs.org must answer for metadata checks",
  });
  lines.push({
    name: "osv advisories",
    // PV-9: retry the OSV probe once before declaring NOT READY.
    ok: await reachable("https://api.osv.dev/v1/query", { method: "POST", body: "{}" }, 1),
    detail: "https://api.osv.dev must answer for vulnerability checks",
  });
  let cacheOk = false;
  try {
    const dir = cacheDir();
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const probe = join(dir, ".writable");
    writeFileSync(probe, "ok");
    rmSync(probe);
    cacheOk = true;
  } catch {
    cacheOk = false;
  }
  lines.push({ name: "cache", ok: cacheOk, detail: `${cacheDir()} must be writable` });
  return { lines, ready: lines.every((l) => l.ok) };
}
