/**
 * `pkgverdict scan`: check every dependency in a package.json, worst first.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { collectSignals } from "./signals.js";
import { VERDICT_ORDER } from "./types.js";
import type { VerdictResult } from "./types.js";
import { scoreSignals } from "./verdict.js";

export interface ScanOptions {
  dir: string;
  includeDev: boolean;
  concurrency: number;
}

export function readDepSpecs(dir: string, includeDev: boolean): string[] {
  const file = join(dir, "package.json");
  if (!existsSync(file)) throw new Error(`No package.json in ${dir}`);
  const pkg = JSON.parse(readFileSync(file, "utf8")) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const out = Object.keys(pkg.dependencies ?? {});
  if (includeDev) out.push(...Object.keys(pkg.devDependencies ?? {}));
  return [...new Set(out)].sort();
}

export async function scanDependencies(opts: ScanOptions): Promise<VerdictResult[]> {
  const specs = readDepSpecs(opts.dir, opts.includeDev);
  const results: VerdictResult[] = [];
  const queue = [...specs];
  const workers = Array.from({ length: Math.max(1, opts.concurrency) }, async () => {
    while (queue.length > 0) {
      const spec = queue.shift() as string;
      try {
        results.push(scoreSignals(await collectSignals(spec)));
      } catch (e) {
        results.push({
          package: spec,
          verdict: "RISKY",
          reasons: [`Check failed (${e instanceof Error ? e.message : e}); could not verify — inspect by hand.`],
          flags: ["check-failed"],
          signals: { name: spec, exists: false },
        });
      }
    }
  });
  await Promise.all(workers);
  return results.sort(
    (a, b) => VERDICT_ORDER.indexOf(a.verdict) - VERDICT_ORDER.indexOf(b.verdict) || a.package.localeCompare(b.package)
  );
}
