/** Verdict rules pinned to frozen offline fixtures. */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { scoreSignals } from "../src/verdict.js";
import * as F from "./fixtures/signals.js";

describe("verdicts", () => {
  it("GO: healthy established package", () => {
    const r = scoreSignals(F.HEALTHY);
    assert.equal(r.verdict, "GO");
    assert.equal(r.flags.length, 0);
  });
  it("FAKE: young obscure typosquat", () => {
    const r = scoreSignals(F.TYPOSQUAT_YOUNG);
    assert.equal(r.verdict, "FAKE");
    assert.ok(r.flags.includes("typosquat"));
    assert.match(r.reasons.join(" "), /dayjs/);
  });
  it("FAKE: exfil-style install script on a new package", () => {
    const r = scoreSignals(F.EXFIL_SCRIPT);
    assert.equal(r.verdict, "FAKE");
    assert.ok(r.flags.includes("hostile-install-script"));
  });
  it("FAKE: malicious advisory wins over age", () => {
    const r = scoreSignals(F.MALICIOUS_ADVISORY);
    assert.equal(r.verdict, "FAKE");
    assert.ok(r.flags.includes("malicious-advisory"));
  });
  it("RISKY: honest install scripts on an established package", () => {
    const r = scoreSignals(F.HONEST_INSTALL_SCRIPTS);
    assert.equal(r.verdict, "RISKY");
    assert.ok(r.flags.includes("install-scripts"));
    assert.ok(!r.flags.includes("hostile-install-script"));
  });
  it("RISKY: deprecated", () => {
    const r = scoreSignals(F.DEPRECATED_PKG);
    assert.equal(r.verdict, "RISKY");
    assert.ok(r.flags.includes("deprecated"));
  });
  it("RISKY: no repository link", () => {
    const r = scoreSignals(F.NO_REPO);
    assert.equal(r.verdict, "RISKY");
    assert.ok(r.flags.includes("no-repository"));
  });
  it("RISKY (not FAKE): lookalike name on an established package", () => {
    const r = scoreSignals(F.LOOKALIKE_ESTABLISHED);
    assert.equal(r.verdict, "RISKY");
    assert.ok(r.flags.includes("lookalike-name"));
  });
  it("MISSING: hallucinated name with no suggestion", () => {
    const r = scoreSignals(F.MISSING_HALLUCINATED);
    assert.equal(r.verdict, "MISSING");
    assert.match(r.reasons.join(" "), /not on the npm registry/);
  });
  it("MISSING: typo suggests the real package", () => {
    const r = scoreSignals(F.MISSING_TYPO);
    assert.equal(r.verdict, "MISSING");
    assert.match(r.reasons.join(" "), /react/);
  });
  it("PV-2/PV-3: unknown age/downloads never render as established/popular", () => {
    const r = scoreSignals(F.UNKNOWN_AGE_AND_DOWNLOADS);
    assert.equal(r.verdict, "GO");
    const text = r.reasons.join(" ");
    assert.doesNotMatch(text, /established/);
    assert.doesNotMatch(text, /popular/);
    assert.match(text, /age unknown/);
    assert.match(text, /download count unknown/);
  });
  it("PV-2: very young package is RISKY via the very-young rule", () => {
    const r = scoreSignals(F.VERY_YOUNG);
    assert.equal(r.verdict, "RISKY");
    assert.ok(r.flags.includes("very-young"));
  });
  it("PV-4: GHSA-ID malicious advisory is FAKE", () => {
    const r = scoreSignals(F.GHSA_MALICIOUS);
    assert.equal(r.verdict, "FAKE");
    assert.ok(r.flags.includes("malicious-advisory"));
    assert.match(r.reasons.join(" "), /GHSA-mh6f-8j2x-4483/);
  });
  it("PV-4: ordinary vulnerabilities stay RISKY, not FAKE", () => {
    const r = scoreSignals(F.ORDINARY_VULNS);
    assert.equal(r.verdict, "RISKY");
    assert.ok(r.flags.includes("advisories"));
    assert.ok(!r.flags.includes("malicious-advisory"));
  });
  it("PV-5: established original (colors) is not flagged for resembling picocolors", () => {
    const r = scoreSignals(F.COLORS_ESTABLISHED_LOOKALIKE);
    assert.equal(r.verdict, "GO");
    assert.ok(!r.flags.includes("lookalike-name"));
  });
  it("PV-5: young obscure lookalike with a MAL advisory still FAKEs", () => {
    const r = scoreSignals(F.LODAHS_TAIL);
    assert.equal(r.verdict, "FAKE");
  });
  it("PV-6: tombstone package says not installable, not no-repo/no-license", () => {
    const r = scoreSignals(F.TOMBSTONE);
    assert.equal(r.verdict, "RISKY");
    assert.ok(r.flags.includes("not-installable"));
    const text = r.reasons.join(" ");
    assert.match(text, /not installable|unpublished/i);
    assert.doesNotMatch(text, /No repository link/);
    assert.doesNotMatch(text, /No license declared/);
  });
  it("PV-6: removed version headlines version-not-found, not field complaints", () => {
    const r = scoreSignals(F.VERSION_NOT_FOUND);
    assert.equal(r.verdict, "RISKY");
    assert.ok(r.flags.includes("version-not-found"));
    assert.match(r.reasons[0], /not found|removed from the registry/i);
    const text = r.reasons.join(" ");
    assert.doesNotMatch(text, /No repository link/);
    assert.doesNotMatch(text, /No license declared/);
  });
  it("PV-6+PV-4: removed malicious version is FAKE and says the version is gone", () => {
    const r = scoreSignals(F.VERSION_NOT_FOUND_MALICIOUS);
    assert.equal(r.verdict, "FAKE");
    assert.ok(r.flags.includes("malicious-advisory"));
    assert.match(r.reasons.join(" "), /not found|removed from the registry/i);
  });
});
