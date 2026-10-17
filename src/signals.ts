/**
 * Signal collection: npm registry metadata, download counts, OSV advisories.
 * All reads are cached; a failed network call degrades to "unknown", never to GO.
 */
import { cacheGet, cacheSet } from "./cache.js";
import { findSimilar } from "./typosquat.js";
import type { Advisory, PackageSignals } from "./types.js";

const UA = "pkgverdict/0.1.0 (+https://github.com/CloudCorpRecords/pkgverdict)";
const SIX_HOURS = 6 * 3600 * 1000;
const ONE_HOUR = 3600 * 1000;

async function getJson(url: string, accept?: string): Promise<{ status: number; json: unknown }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, ...(accept ? { Accept: accept } : {}) },
      signal: ctrl.signal,
    });
    if (res.status === 404) return { status: 404, json: null };
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { status: res.status, json: (await res.json()) as unknown };
  } finally {
    clearTimeout(timer);
  }
}

interface CorgiDoc {
  name?: string;
  description?: string;
  time?: Record<string, string>;
  maintainers?: { name: string; email: string }[];
  "dist-tags"?: { latest?: string };
}

interface VersionManifest {
  version?: string;
  license?: string;
  deprecated?: string;
  scripts?: Record<string, string>;
  repository?: string | { url?: string };
}

function repoUrl(repo: VersionManifest["repository"]): string | undefined {
  if (!repo) return undefined;
  if (typeof repo === "string") return repo;
  return repo.url;
}

export function parseSpec(spec: string): { name: string; version?: string } {
  const at = spec.lastIndexOf("@");
  if (at > 0) return { name: spec.slice(0, at), version: spec.slice(at + 1) || undefined };
  return { name: spec };
}

async function fetchPackument(name: string): Promise<CorgiDoc | null> {
  const key = `packument-${name}`;
  const hit = cacheGet<CorgiDoc>(key, SIX_HOURS);
  if (hit) return hit;
  const { status, json } = await getJson(
    `https://registry.npmjs.org/${encodeURIComponent(name)}`,
    "application/vnd.npm.install-v1+json"
  );
  if (status === 404) return null;
  cacheSet(key, json);
  return json as CorgiDoc;
}

async function fetchManifest(name: string, version: string): Promise<VersionManifest | null> {
  const key = `manifest-${name}@${version}`;
  const hit = cacheGet<VersionManifest>(key, SIX_HOURS);
  if (hit) return hit;
  const { status, json } = await getJson(
    `https://registry.npmjs.org/${encodeURIComponent(name)}/${encodeURIComponent(version)}`
  );
  if (status === 404) return null;
  cacheSet(key, json);
  return json as VersionManifest;
}

async function fetchDownloads(name: string): Promise<number | undefined> {
  const key = `downloads-${name}`;
  const hit = cacheGet<number>(key, SIX_HOURS);
  if (hit !== null) return hit;
  try {
    const { status, json } = await getJson(`https://api.npmjs.org/downloads/point/last-week/${encodeURIComponent(name)}`);
    if (status === 404) return undefined;
    const n = (json as { downloads?: number }).downloads;
    if (typeof n === "number") {
      cacheSet(key, n);
      return n;
    }
  } catch {
    // Unknown stays unknown.
  }
  return undefined;
}

async function fetchAdvisories(name: string, version: string): Promise<Advisory[]> {
  const key = `osv-${name}@${version}`;
  const hit = cacheGet<Advisory[]>(key, ONE_HOUR);
  if (hit) return hit;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    try {
      const res = await fetch("https://api.osv.dev/v1/query", {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": UA },
        body: JSON.stringify({ package: { name, ecosystem: "npm" }, version }),
        signal: ctrl.signal,
      });
      if (!res.ok) return [];
      const body = (await res.json()) as {
        vulns?: { id: string; summary?: string; severity?: { type: string; score: string }[] }[];
      };
      const out: Advisory[] = (body.vulns ?? []).map((v) => ({
        id: v.id,
        summary: v.summary ?? v.id,
        severity: v.severity?.[0]?.score,
        malicious: v.id.startsWith("MAL-"),
      }));
      cacheSet(key, out);
      return out;
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return [];
  }
}

const INSTALL_SCRIPT_KEYS = ["preinstall", "install", "postinstall"];

/**
 * First-publish date from the full packument. Corgi docs omit `time`, and full
 * docs for popular packages are megabytes, so this only runs for lookalike
 * candidates (small packages where age decides FAKE vs RISKY) and aborts past 1 MB.
 */
async function fetchCreatedAt(name: string): Promise<string | undefined> {
  const key = `created-${name}`;
  const hit = cacheGet<string>(key, SIX_HOURS);
  if (hit) return hit;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}`, {
      headers: { "User-Agent": UA },
      signal: ctrl.signal,
    });
    if (!res.ok || !res.body) return undefined;
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.length;
      if (bytes > 1024 * 1024) {
        await reader.cancel().catch(() => undefined);
        return undefined;
      }
      if (value) chunks.push(value);
    }
    const doc = JSON.parse(Buffer.concat(chunks).toString("utf8")) as { time?: Record<string, string> };
    const times = Object.values(doc.time ?? {}).filter((t) => t && !t.startsWith("1970")).sort();
    if (times.length > 0) {
      cacheSet(key, times[0]);
      return times[0];
    }
  } catch {
    // Age stays unknown; other signals still count.
  } finally {
    clearTimeout(timer);
  }
  return undefined;
}

export async function collectSignals(spec: string): Promise<PackageSignals> {
  const { name, version: requestedVersion } = parseSpec(spec.trim());
  const signals: PackageSignals = { name, requestedVersion, exists: false, similarTo: findSimilar(name) };
  let doc: CorgiDoc | null = null;
  try {
    doc = await fetchPackument(name);
  } catch {
    return signals; // Registry unreachable: exists stays false, verdict degrades honestly.
  }
  if (!doc) return signals;
  signals.exists = true;
  signals.description = doc.description;
  const latest = doc["dist-tags"]?.latest;
  const version = requestedVersion ?? latest;
  signals.version = version;
  signals.maintainers = (doc.maintainers ?? []).map((m) => m.name).slice(0, 10);
  const times = Object.values(doc.time ?? {}).filter((t) => t && !t.startsWith("1970"));
  if (times.length > 0) {
    const sorted = [...times].sort();
    signals.createdAt = sorted[0];
    signals.modifiedAt = sorted[sorted.length - 1];
    signals.ageDays = Math.max(0, Math.floor((Date.now() - Date.parse(sorted[0])) / 86400000));
  } else if ((signals.similarTo?.length ?? 0) > 0) {
    // Corgi docs omit dates; age decides FAKE vs RISKY for lookalikes.
    const created = await fetchCreatedAt(name);
    if (created) {
      signals.createdAt = created;
      signals.ageDays = Math.max(0, Math.floor((Date.now() - Date.parse(created)) / 86400000));
    }
  }
  if (version) {
    try {
      const manifest = await fetchManifest(name, version);
      if (manifest) {
        signals.license = manifest.license;
        signals.repository = repoUrl(manifest.repository);
        signals.deprecated = manifest.deprecated;
        const scripts: Record<string, string> = {};
        for (const k of INSTALL_SCRIPT_KEYS) {
          if (manifest.scripts?.[k]) scripts[k] = manifest.scripts[k];
        }
        if (Object.keys(scripts).length > 0) signals.installScripts = scripts;
      }
    } catch {
      // Manifest unknown; other signals still count.
    }
    signals.advisories = await fetchAdvisories(name, version);
  }
  const [downloads] = await Promise.all([fetchDownloads(name)]);
  signals.weeklyDownloads = downloads;
  return signals;
}
