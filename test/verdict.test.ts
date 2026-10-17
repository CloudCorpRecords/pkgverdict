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
});
