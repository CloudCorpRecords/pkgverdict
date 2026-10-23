/** Shared types for pkgverdict. */

export type Verdict = "GO" | "RISKY" | "FAKE" | "MISSING";

export interface SimilarName {
  name: string;
  kind: string;
}

export interface Advisory {
  id: string;
  summary: string;
  severity?: string;
  malicious?: boolean;
  /** OSV aliases (e.g. a MAL- id hiding behind a GHSA id), when known. */
  aliases?: string[];
  /** Long-form OSV details text, when fetched; feeds malicious classification. */
  details?: string;
}

export interface PackageSignals {
  name: string;
  requestedVersion?: string;
  exists: boolean;
  version?: string;
  description?: string;
  createdAt?: string;
  modifiedAt?: string;
  /** Whole days since the first publish, when known. */
  ageDays?: number;
  weeklyDownloads?: number;
  maintainers?: string[];
  license?: string;
  repository?: string;
  deprecated?: string;
  installScripts?: Record<string, string>;
  advisories?: Advisory[];
  similarTo?: SimilarName[];
  /** Packument exists but every version was unpublished: nothing installable. */
  noInstallableVersion?: boolean;
  /** The requested version's manifest 404'd: that version is not on the registry. */
  versionNotFound?: boolean;
}

export interface VerdictResult {
  package: string;
  version?: string;
  verdict: Verdict;
  reasons: string[];
  flags: string[];
  signals: PackageSignals;
}

export const VERDICT_ORDER: Verdict[] = ["FAKE", "MISSING", "RISKY", "GO"];

export function worstOf(a: Verdict, b: Verdict): Verdict {
  return VERDICT_ORDER.indexOf(a) <= VERDICT_ORDER.indexOf(b) ? a : b;
}
