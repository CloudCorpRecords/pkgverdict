#!/usr/bin/env node
/**
 * pkgverdict CLI.
 *
 *   pkgverdict check <name[@version]> [--json] [--strict]
 *   pkgverdict scan [dir] [--json] [--no-dev] [--strict]
 *   pkgverdict doctor [--json]
 *   pkgverdict init --agent <id,...> [--all] [--list] [--dry-run] [--force]
 *   pkgverdict mcp
 *   pkgverdict help [command]
 *   pkgverdict version
 *
 * Exit codes: 0 when everything is GO (or RISKY without --strict), 1 when a
 * FAKE or MISSING package is found (or anything RISKY with --strict),
 * 2 on usage errors and failed checks.
 */
import { INIT_TOOLS, runInit } from "./init.js";
import { runMcp } from "./index.js";
import { doctor } from "./doctor.js";
import { scanDependencies } from "./scan.js";
import { collectSignals } from "./signals.js";
import type { Verdict, VerdictResult } from "./types.js";
import { scoreSignals } from "./verdict.js";

const VERSION = "0.1.0";

function failVerdict(result: VerdictResult, strict: boolean): boolean {
  if (result.verdict === "FAKE" || result.verdict === "MISSING") return true;
  return strict && result.verdict === "RISKY";
}

function printResult(r: VerdictResult): void {
  console.log(`[${r.verdict}] ${r.package}${r.version ? `@${r.version}` : ""}`);
  for (const reason of r.reasons) console.log(`  - ${reason}`);
}

function usageError(message: string): never {
  console.error(`${message}\nRun \`pkgverdict help\` for usage.`);
  process.exit(2);
}

const HELP: Record<string, string> = {
  top: `pkgverdict ${VERSION}: pre-install verdicts for npm packages.

  check <name[@version]>   verdict on one package: GO, RISKY, FAKE, MISSING
  scan [dir]               check every dependency in package.json, worst first
  doctor                   check this machine can reach npm + OSV
  init --agent <id>        set up the MCP server + rules in your AI coding tool
  mcp                      run the MCP server (stdio)
  help [command]           this help, or help for one command
  version                  print the version

Flags: --json (machine output), --strict (RISKY also fails, for CI).
Exit codes: 0 clean, 1 FAKE/MISSING found, 2 usage error.`,
  check: `pkgverdict check <name[@version]> [--json] [--strict]

Verdict on one package before you install it.`,
  scan: `pkgverdict scan [dir] [--json] [--no-dev] [--strict]

Check every dependency in package.json, worst first. Scans devDependencies too unless --no-dev.`,
  doctor: `pkgverdict doctor [--json]

Check Node version, registry + OSV reachability, and cache writability.`,
  init: `pkgverdict init --agent <id,...> [--all] [--list] [--dry-run] [--force]

Set up the MCP server and the "check before installing" rule in your AI coding tool.
Tools: ${["--all"].concat(INIT_TOOLS.map((t) => t.id)).join(", ")}.`,
  mcp: `pkgverdict mcp

Run the MCP server over stdio (2 tools: check_package, scan_dependencies).`,
};

async function cmdCheck(args: string[]): Promise<void> {
  const json = args.includes("--json");
  const strict = args.includes("--strict");
  const spec = args.find((a) => !a.startsWith("--"));
  if (!spec) usageError("check needs a package name.");
  const result = scoreSignals(await collectSignals(spec));
  if (json) console.log(JSON.stringify(result, null, 2));
  else printResult(result);
  process.exit(failVerdict(result, strict) ? 1 : 0);
}

async function cmdScan(args: string[]): Promise<void> {
  const json = args.includes("--json");
  const strict = args.includes("--strict");
  const includeDev = !args.includes("--no-dev");
  const dir = args.find((a) => !a.startsWith("--")) ?? process.cwd();
  let results: VerdictResult[];
  try {
    results = await scanDependencies({ dir, includeDev, concurrency: 8 });
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(2);
  }
  if (json) {
    console.log(JSON.stringify(results, null, 2));
  } else if (results.length === 0) {
    console.log("No dependencies found.");
  } else {
    for (const r of results) {
      console.log(`[${r.verdict}] ${r.package}${r.version ? `@${r.version}` : ""} — ${r.reasons[0]}`);
    }
    const counts = (v: Verdict) => results.filter((r) => r.verdict === v).length;
    console.log(
      `\n${results.length} packages: ${counts("GO")} GO, ${counts("RISKY")} RISKY, ${counts("FAKE")} FAKE, ${counts("MISSING")} MISSING`
    );
  }
  process.exit(results.some((r) => failVerdict(r, strict)) ? 1 : 0);
}

async function cmdDoctor(args: string[]): Promise<void> {
  const { lines, ready } = await doctor();
  if (args.includes("--json")) {
    console.log(JSON.stringify({ ready, checks: lines }, null, 2));
  } else {
    console.log(`pkgverdict ${VERSION}: setup check`);
    for (const l of lines) console.log(`  [${l.ok ? "PASS" : "FAIL"}] ${l.name}: ${l.detail}`);
    console.log(ready ? "Result: READY — everything looks good." : "Result: NOT READY — see the FAIL lines.");
  }
  process.exit(ready ? 0 : 1);
}

function cmdInit(args: string[]): void {
  if (args.includes("--list")) {
    console.log(INIT_TOOLS.map((t) => `${t.id} — ${t.label}`).join("\n"));
    return;
  }
  const all = args.includes("--all");
  let ids: string[] = [];
  if (all) {
    ids = INIT_TOOLS.map((t) => t.id);
  } else {
    const eqForm = args.find((a) => a.startsWith("--agent="));
    const flagIdx = args.indexOf("--agent");
    const raw = eqForm
      ? eqForm.split("=").slice(1).join("=")
      : flagIdx >= 0
        ? args[flagIdx + 1]
        : undefined;
    if (!raw || raw.startsWith("--")) usageError("init needs --agent <id>, --all, or --list.");
    ids = raw.split(",").map((s) => s.trim()).filter(Boolean);
  }
  const results = runInit(ids, {
    dryRun: args.includes("--dry-run"),
    force: args.includes("--force"),
    dir: process.cwd(),
  });
  for (const r of results) console.log(`${r.tool}: ${r.config}; ${r.instructions}`);
  const notes = [...new Set(ids.map((id) => INIT_TOOLS.find((t) => t.id === id)?.restartNote).filter(Boolean))];
  for (const n of notes) console.log(`Next: ${n}`);
}

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);
  if (!cmd || cmd === "help") {
    const topic = rest[0] && HELP[rest[0]] ? rest[0] : "top";
    console.log(HELP[topic]);
    return;
  }
  if (cmd === "--version" || cmd === "version") {
    console.log(VERSION);
    return;
  }
  if (rest.includes("--help") || rest.includes("-h")) {
    console.log(HELP[cmd] ?? HELP.top);
    return;
  }
  try {
    if (cmd === "check") await cmdCheck(rest);
    else if (cmd === "scan") await cmdScan(rest);
    else if (cmd === "doctor") await cmdDoctor(rest);
    else if (cmd === "init") cmdInit(rest);
    else if (cmd === "mcp") await runMcp();
    else usageError(`Unknown command: ${cmd}`);
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(2);
  }
}

await main();
