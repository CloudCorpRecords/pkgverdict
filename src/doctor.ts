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

async function reachable(url: string, init?: RequestInit): Promise<boolean> {
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
    ok: await reachable("https://api.osv.dev/v1/query", { method: "POST", body: "{}" }),
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
