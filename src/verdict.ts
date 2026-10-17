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

  const similar = s.similarTo ?? [];
  const young = (s.ageDays ?? YOUNG_DAYS + 1) <= YOUNG_DAYS;
  const obscure = (s.weeklyDownloads ?? 0) < OBSCURE_DOWNLOADS;
  const malicious = (s.advisories ?? []).filter((a) => a.malicious);
  const otherAdvisories = (s.advisories ?? []).filter((a) => !a.malicious);
  const scripts = s.installScripts ?? {};
  const scriptHits = Object.entries(scripts).flatMap(([k, v]) =>
    scriptRisk(v).map((t) => `${k} contains ${t}`)
  );

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
  if (similar.length > 0) {
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
  if (!s.repository) {
    verdict = "RISKY";
    reasons.push("No repository link — you cannot read the source you are about to run.");
    flags.push("no-repository");
  }
  if (!s.license) {
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

  // GO.
  const age = s.ageDays !== undefined ? `${Math.floor(s.ageDays / 365) > 0 ? `${Math.floor(s.ageDays / 365)}y` : `${s.ageDays}d`} old` : "established";
  const dl =
    s.weeklyDownloads === undefined
      ? "popular"
      : s.weeklyDownloads >= 1_000_000
        ? `${(s.weeklyDownloads / 1_000_000).toFixed(1)}M/wk`
        : s.weeklyDownloads >= 1000
          ? `${(s.weeklyDownloads / 1000).toFixed(1)}k/wk`
          : `${s.weeklyDownloads}/wk`;
  reasons.push(`${age}, ${dl}, no install scripts, no advisories, no lookalike name.`);
  return { package: s.name, version: s.version, verdict, reasons, flags, signals: s };
}
