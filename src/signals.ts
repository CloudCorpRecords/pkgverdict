/**
 * Signal collection: npm registry metadata, download counts, OSV advisories.
 * All reads are cached; a failed network call degrades to "unknown", never to GO.
 */
import { cacheGet, cacheSet } from "./cache.js";
import { findSimilar } from "./typosquat.js";
import type { Advisory, PackageSignals } from "./types.js";

const UA = "pkgverdict/0.1.1 (+https://github.com/CloudCorpRecords/pkgverdict)";
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

type MaintainerLike = string | { name?: string; email?: string };

interface CorgiDoc {
  name?: string;
  description?: string;
  time?: Record<string, string>;
  maintainers?: MaintainerLike[];
  versions?: Record<string, unknown>;
  "dist-tags"?: { latest?: string };
}

interface VersionManifest {
  version?: string;
  license?: string;
  deprecated?: string;
  scripts?: Record<string, string>;
  repository?: string | { url?: string };
  maintainers?: MaintainerLike[];
}

/** Maintainer display names from a registry maintainer list (objects or strings). */
export function maintainerNames(list: MaintainerLike[] | undefined): string[] {
  if (!Array.isArray(list)) return [];
  return list
    .map((m) => (typeof m === "string" ? m : (m?.name ?? "")))
    .filter((n) => n.length > 0)
    .slice(0, 10);
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

export interface OsvVuln {
  id: string;
  summary?: string;
  details?: string;
  aliases?: string[];
  severity?: { type: string; score: string }[];
  database_specific?: { cwe_ids?: string[]; [k: string]: unknown };
}

/**
 * Malicious-package classification (PV-4). A MAL- id is only one shape: OSV
 * also carries compromised releases under GHSA ids (event-stream@3.3.6 is
 * GHSA-mh6f-8j2x-4483), so the summary/details/database_specific text and the
 * alias list decide too. Patterns are package-directed ("is considered
 * malicious", "malicious code", "backdoor", CWE-506 embedded malicious code)
 * so ordinary vulnerabilities — prototype pollution, SSRF, code injection by
 * an *attacker* — never classify as a malicious package.
 */
const MALICIOUS_PATTERNS: RegExp[] = [
  /\bconsidered malicious\b/,
  /\bis malicious\b/,
  /\bwas malicious\b/,
  /\bmalicious package\b/,
  /\bmalicious code\b/,
  /\bmalicious version\b/,
  /\bmalicious release\b/,
  /\bmalicious dependency\b/,
  /\bcontains malicious\b/,
  /\bincluding malicious\b/,
  /\bintroduced malicious\b/,
  /\bbackdoor/,
  /\bmalware\b/,
  /\bcompromised package\b/,
  /\bpackage (?:was|has been|is) compromised\b/,
  /\bembedded malicious code\b/,
];

export function isMaliciousOsvVuln(v: OsvVuln): boolean {
  if (v.id.startsWith("MAL-")) return true;
  if ((v.aliases ?? []).some((a) => a.startsWith("MAL-"))) return true;
  if ((v.database_specific?.cwe_ids ?? []).includes("CWE-506")) return true;
  const text = `${v.summary ?? ""}\n${v.details ?? ""}`.toLowerCase();
  return MALICIOUS_PATTERNS.some((p) => p.test(text));
}

/** Full OSV record for one advisory id (the query response can be terse). */
async function fetchOsvVulnDetail(id: string): Promise<OsvVuln | null> {
  const key = `osv-detail-${id}`;
  const hit = cacheGet<OsvVuln>(key, ONE_HOUR);
  if (hit) return hit;
  try {
    const { status, json } = await getJson(`https://api.osv.dev/v1/vulns/${encodeURIComponent(id)}`);
    if (status === 404 || !json) return null;
    const vuln = json as OsvVuln;
    cacheSet(key, vuln);
    return vuln;
  } catch {
    return null;
  }
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
      const body = (await res.json()) as { vulns?: OsvVuln[] };
      const out: Advisory[] = [];
      for (const v of body.vulns ?? []) {
        let merged: OsvVuln = v;
        if (!isMaliciousOsvVuln(v)) {
          // PV-4: pull the full record before ruling a non-MAL id benign —
          // the malicious wording often lives only in details/aliases.
          const detail = await fetchOsvVulnDetail(v.id);
          if (detail) {
            merged = {
              ...v,
              summary: v.summary ?? detail.summary,
              details: v.details ?? detail.details,
              aliases: v.aliases ?? detail.aliases,
              database_specific: v.database_specific ?? detail.database_specific,
            };
          }
        }
        out.push({
          id: merged.id,
          summary: merged.summary ?? merged.id,
          severity: merged.severity?.[0]?.score,
          malicious: isMaliciousOsvVuln(merged),
          aliases: merged.aliases,
          details: merged.details,
        });
      }
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

/** First "created" timestamp in a full-packument JSON text (time.created). */
export function createdAtFromPackumentText(text: string): string | undefined {
  const m = text.match(/"created"\s*:\s*"([^"]+)"/);
  if (!m) return undefined;
  const t = m[1];
  if (!t || t.startsWith("1970")) return undefined;
  return t;
}

/**
 * First-publish date from the full packument. Corgi docs omit `time`, so age
 * collection (PV-2) always falls back here when the corgi doc has no stamps —
 * for every package, not just lookalike candidates. Streams the document and
 * stops as soon as `time.created` is found (it sits near the top, before the
 * version manifests), with a hard byte cap for pathological packuments.
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
    const decoder = new TextDecoder();
    let text = "";
    let bytes = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value?.length ?? 0;
      if (value) text += decoder.decode(value, { stream: true });
      const created = createdAtFromPackumentText(text);
      if (created) {
        await reader.cancel().catch(() => undefined);
        cacheSet(key, created);
        return created;
      }
      if (bytes > 16 * 1024 * 1024) {
        await reader.cancel().catch(() => undefined);
        return undefined;
      }
    }
    const created = createdAtFromPackumentText(text);
    if (created) {
      cacheSet(key, created);
      return created;
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
  signals.maintainers = maintainerNames(doc.maintainers);
  // PV-6: a packument with no dist-tag and no versions is a tombstone —
  // every version was unpublished and there is nothing to install.
  const versionCount = doc.versions ? Object.keys(doc.versions).length : 0;
  if (!latest && versionCount === 0) signals.noInstallableVersion = true;
  const times = Object.values(doc.time ?? {}).filter((t) => t && !t.startsWith("1970"));
  if (times.length > 0) {
    const sorted = [...times].sort();
    signals.createdAt = sorted[0];
    signals.modifiedAt = sorted[sorted.length - 1];
    signals.ageDays = Math.max(0, Math.floor((Date.now() - Date.parse(sorted[0])) / 86400000));
  } else {
    // PV-2: corgi docs omit dates for everyone; age decides the very-young
    // RISKY rule and honest GO wording, so collect it for ALL packages.
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
        // PV-8: corgi docs carry no maintainers; the version manifest does.
        if ((signals.maintainers ?? []).length === 0) {
          signals.maintainers = maintainerNames(manifest.maintainers);
        }
        const scripts: Record<string, string> = {};
        for (const k of INSTALL_SCRIPT_KEYS) {
          if (manifest.scripts?.[k]) scripts[k] = manifest.scripts[k];
        }
        if (Object.keys(scripts).length > 0) signals.installScripts = scripts;
      } else {
        // PV-6: a 404 manifest means the version itself is gone — that is
        // the headline fact, not "no repository / no license".
        signals.versionNotFound = true;
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
