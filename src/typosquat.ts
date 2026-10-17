/**
 * Typosquat and slopsquat detection: is this name riding on a famous one?
 *
 * Attack shapes covered: single edits (dayjs -> dayjs2, lodash -> lodashs),
 * transpositions, hyphen/underscore/dot swaps, affix tricks
 * (eslint-plugin-unused-imports -> unused-imports), and scope games
 * (@types/node -> types-node).
 */
import { TOP_PACKAGES } from "./top-packages.js";
import type { SimilarName } from "./types.js";

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

function isTransposition(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const diffs: number[] = [];
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diffs.push(i);
  return (
    diffs.length === 2 &&
    diffs[1] === diffs[0] + 1 &&
    a[diffs[0]] === b[diffs[1]] &&
    a[diffs[1]] === b[diffs[0]]
  );
}

/** Base name without scope: "@types/node" -> "node", "lodash" -> "lodash". */
export function baseName(name: string): string {
  const slash = name.indexOf("/");
  return slash >= 0 ? name.slice(slash + 1) : name;
}

function normalize(name: string): string {
  return baseName(name).toLowerCase().replace(/[-_.]/g, "");
}

function affixTrick(name: string, popular: string): string | null {
  const n = normalize(name);
  const p = normalize(popular);
  if (n === p || n.length < 4 || p.length < 4) return null;
  if (p.endsWith(n) && p.length - n.length <= 14) return "suffix-of-popular-name";
  if (p.startsWith(n) && p.length - n.length <= 14) return "prefix-of-popular-name";
  if (n.startsWith(p) && n.length - p.length <= 6) return "popular-name-plus-suffix";
  if (n.endsWith(p) && n.length - p.length <= 6) return "popular-name-plus-prefix";
  return null;
}

/**
 * Well-known names this package name resembles, with the trick kind.
 * Short names need an exact-ish match to avoid noise ("ws" must not flag "fs").
 */
export function findSimilar(name: string, candidates: string[] = TOP_PACKAGES): SimilarName[] {
  const out: SimilarName[] = [];
  const lower = name.toLowerCase();
  // A well-known name is never a typosquat of another one (lodash vs lodash-es
  // are siblings, not attacks): only unknown names get similarity-checked.
  if (candidates.some((c) => c.toLowerCase() === lower)) return out;
  for (const popular of candidates) {
    if (popular.toLowerCase() === lower) continue;
    const a = baseName(lower);
    const b = baseName(popular.toLowerCase());
    if (Math.min(a.length, b.length) < 3) continue;
    if (isTransposition(a, b)) {
      out.push({ name: popular, kind: "transposition" });
      continue;
    }
    const dist = levenshtein(a, b);
    const threshold = Math.min(a.length, b.length) <= 5 ? 1 : 2;
    if (dist > 0 && dist <= threshold) {
      out.push({ name: popular, kind: dist === 1 ? "single-edit" : "double-edit" });
      continue;
    }
    const affix = affixTrick(lower, popular);
    if (affix) out.push({ name: popular, kind: affix });
  }
  return out.slice(0, 5);
}
