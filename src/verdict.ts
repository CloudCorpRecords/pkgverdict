/**
 * Verdict rules: GO, RISKY, FAKE, or MISSING, with plain-word reasons.
 *
 * Order matters. MISSING is checked first (nothing else can be said about a
 * package that isn't there), then FAKE (active harm signals), then RISKY
 * (caution signals), else GO.
 */
import type { PackageSignals, Verdict, VerdictResult } from "./types.js";

/** Young + obscure: the classic shape of a fresh typosquat. */
const YOUNG_DAYS = 180;
const OBSCURE_DOWNLOADS = 1000;

/**
 * Established-package exemption for the lookalike RISKY branch (PV-5): a
 * package that is itself old and heavily downloaded is the original, not an
 * imitation — `colors` (2011, ~14M/wk) must not flag for resembling its own
 * successor `picocolors`. The FAKE typosquat branch keeps its younger/obscure
 * thresholds; this guard only stops the caution flag on proven incumbents.
 */
const ESTABLISHED_AGE_DAYS = 365;
const ESTABLISHED_DOWNLOADS = 1_000_000;

function isEstablished(s: PackageSignals): boolean {
  return (
    s.ageDays !== undefined &&
    s.ageDays >= ESTABLISHED_AGE_DAYS &&
    s.weeklyDownloads !== undefined &&
    s.weeklyDownloads >= ESTABLISHED_DOWNLOADS
  );
}

/** Tokens in an install script that deserve at least a hard look. */
const SCRIPT_RISK = [
  "curl",
  "wget",
  "powershell",
  "cmd.exe",
  "rundll32",
  "certutil",
  "bitsadmin",
  "| sh",
  "| bash",
  "sh -c",
  "bash -c",
  "/dev/tcp",
  "base64 -d",
  "base64 --decode",
  "atob(",
  "eval(",
  "child_process",
  "postinstall.js",
  "setup.mjs",
  "setup.js",
];

function scriptRisk(script: string): string[] {
  const lower = script.toLowerCase();
  return SCRIPT_RISK.filter((t) => lower.includes(t));
}

export function scoreSignals(s: PackageSignals): VerdictResult {
  const reasons: string[] = [];
  const flags: string[] = [];

  if (!s.exists) {
    return {
      package: s.name,
      verdict: "MISSING",
      reasons: [
        `${s.name} is not on the npm registry. If an AI assistant suggested it, the name was hallucinated — do not create it to "claim" the name, just pick a real package.`,
        ...(s.similarTo?.length
          ? [`Did you mean ${s.similarTo.map((x) => x.name).join(", ")}?`]
          : ["Check the spelling, or search npmjs.com for what you actually need."]),
      ],
      flags: ["nonexistent"],
      signals: s,
    };
  }

  // PV-6: tombstone packument — the name exists but every version was
  // unpublished. The honest headline is "not installable", not field noise.
  if (s.noInstallableVersion) {
    return {
      package: s.name,
      verdict: "RISKY",
      reasons: [
        `${s.name} is not installable: every version has been unpublished from the npm registry, so there is nothing to install. Pick a maintained alternative.`,
      ],
      flags: ["not-installable"],
      signals: s,
    };
  }

  const similar = s.similarTo ?? [];
  const young = (s.ageDays ?? YOUNG_DAYS + 1) <= YOUNG_DAYS;
  const obscure = (s.weeklyDownloads ?? 0) < OBSCURE_DOWNLOADS;
  const malicious = (s.advisories ?? []).filter((a) => a.malicious);
  const otherAdvisories = (s.advisories ?? []).filter((a) => !a.malicious);
  const scripts = s.installScripts ?? {};
  const scriptHits = Object.entries(scripts).flatMap(([k, v]) =>
    scriptRisk(v).map((t) => `${k} contains ${t}`)
  );

  // PV-6: a requested version whose manifest 404'd leads every verdict —
  // the version was removed from the registry (or never published).
  if (s.versionNotFound) {
    reasons.push(
      `Version ${s.requestedVersion ?? s.version} not found — it was removed from the registry (or never published), so it cannot be installed.`
    );
    flags.push("version-not-found");
  }

  let verdict: Verdict = "GO";

  // FAKE: active harm signals.
  if (malicious.length > 0) {
    verdict = "FAKE";
    reasons.push(`Flagged malicious: ${malicious.map((a) => a.id).join(", ")}. Do not install.`);
    flags.push("malicious-advisory");
  }
  if (similar.length > 0 && (young || obscure)) {
    verdict = "FAKE";
    const top = similar[0];
    reasons.push(
      `Name rides on ${top.name} (${top.kind.replace(/-/g, " ")}) and the package is ${
        young && obscure ? "new and barely downloaded" : young ? "new" : "barely downloaded"
      } — the classic typosquat shape. Install ${top.name} if that is what you meant.`
    );
    flags.push("typosquat");
  }
  if (scriptHits.length > 0 && (young || obscure)) {
    verdict = "FAKE";
    reasons.push(`Install script looks hostile (${scriptHits[0]}) on a ${young ? "new" : "obscure"} package. Do not install.`);
    flags.push("hostile-install-script");
  }
  if (verdict === "FAKE") return { package: s.name, version: s.version, verdict, reasons, flags, signals: s };

  // RISKY: caution signals.
  if (s.versionNotFound) {
    verdict = "RISKY";
  }
  if (Object.keys(scripts).length > 0) {
    verdict = "RISKY";
    reasons.push(
      `Runs on install: ${Object.keys(scripts).join(", ")}. Read ${Object.keys(scripts).map((k) => `\`${scripts[k].slice(0, 80)}\``).join(" ")} before you trust it.`
    );
    flags.push("install-scripts");
  }
  if (scriptHits.length > 0) {
    verdict = "RISKY";
    reasons.push(`Install script deserves a look: ${scriptHits.join("; ")}.`);
    flags.push("suspicious-install-script");
  }
  if (similar.length > 0 && !isEstablished(s)) {
    verdict = "RISKY";
    reasons.push(`Name resembles ${similar.map((x) => x.name).join(", ")} — confirm you typed the right one.`);
    flags.push("lookalike-name");
  }
  if (s.ageDays !== undefined && s.ageDays <= 90) {
    verdict = "RISKY";
    reasons.push(`First published ${s.ageDays} days ago — new packages have no track record.`);
    flags.push("very-young");
  }
  if (s.weeklyDownloads !== undefined && s.weeklyDownloads < 500) {
    verdict = "RISKY";
    reasons.push(`Only ${s.weeklyDownloads} downloads last week — almost nobody has vetted this.`);
    flags.push("obscure");
  }
  if (s.deprecated) {
    verdict = "RISKY";
    reasons.push(`Deprecated by its maintainers: ${s.deprecated.slice(0, 160)}`);
    flags.push("deprecated");
  }
  // PV-6: when the version manifest 404'd, repo/license are unknown, not
  // absent — never turn a missing version into field complaints.
  if (!s.versionNotFound && !s.repository) {
    verdict = "RISKY";
    reasons.push("No repository link — you cannot read the source you are about to run.");
    flags.push("no-repository");
  }
  if (!s.versionNotFound && !s.license) {
    verdict = "RISKY";
    reasons.push("No license declared — legally murky to depend on.");
    flags.push("no-license");
  }
  if (otherAdvisories.length > 0) {
    verdict = "RISKY";
    reasons.push(`Known vulnerabilities: ${otherAdvisories.map((a) => a.id).join(", ")}.`);
    flags.push("advisories");
  }
  if (verdict === "RISKY") return { package: s.name, version: s.version, verdict, reasons, flags, signals: s };

  // GO. PV-2/PV-3: unknown age is "age unknown" (never "established") and
  // unknown downloads are "download count unknown" (never "popular").
  const age =
    s.ageDays !== undefined
      ? `${Math.floor(s.ageDays / 365) > 0 ? `${Math.floor(s.ageDays / 365)}y` : `${s.ageDays}d`} old`
      : "age unknown";
  const dl =
    s.weeklyDownloads === undefined
      ? "download count unknown"
      : s.weeklyDownloads >= 1_000_000
        ? `${(s.weeklyDownloads / 1_000_000).toFixed(1)}M/wk`
        : s.weeklyDownloads >= 1000
          ? `${(s.weeklyDownloads / 1000).toFixed(1)}k/wk`
          : `${s.weeklyDownloads}/wk`;
  const lookalikeNote =
    similar.length > 0
      ? `name resembles ${similar.map((x) => x.name).join(", ")} but this package is itself long-established`
      : "no lookalike name";
  reasons.push(`${age}, ${dl}, no install scripts, no advisories, ${lookalikeNote}.`);
  return { package: s.name, version: s.version, verdict, reasons, flags, signals: s };
}
