/** Signal-layer helpers pinned offline (PV-2, PV-4, PV-8). */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createdAtFromPackumentText, isMaliciousOsvVuln, maintainerNames } from "../src/signals.js";

describe("isMaliciousOsvVuln (PV-4)", () => {
  it("MAL- id is malicious", () => {
    assert.equal(isMaliciousOsvVuln({ id: "MAL-2025-25502", summary: "Malicious package" }), true);
  });
  it("a MAL- alias makes a GHSA malicious", () => {
    assert.equal(
      isMaliciousOsvVuln({ id: "GHSA-xxxx-yyyy-zzzz", summary: "Bad package", aliases: ["CVE-2025-1", "MAL-2025-9"] }),
      true
    );
  });
  it("event-stream GHSA: details say the dependency is considered malicious (CWE-506)", () => {
    assert.equal(
      isMaliciousOsvVuln({
        id: "GHSA-mh6f-8j2x-4483",
        summary: "Critical severity vulnerability that affects event-stream and flatmap-stream",
        details:
          "The NPM package `flatmap-stream` is considered malicious. A malicious actor added this package as a dependency to the NPM `event-stream` package in version `3.3.6`.",
        database_specific: { cwe_ids: ["CWE-506"] },
      }),
      true
    );
  });
  it("CWE-506 (embedded malicious code) alone is enough", () => {
    assert.equal(
      isMaliciousOsvVuln({
        id: "GHSA-aaaa-bbbb-cccc",
        summary: "Compromised release",
        database_specific: { cwe_ids: ["CWE-506"] },
      }),
      true
    );
  });
  it("backdoor wording is malicious", () => {
    assert.equal(
      isMaliciousOsvVuln({ id: "GHSA-dddd-eeee-ffff", summary: "Release ships a backdoor that exfiltrates env vars" }),
      true
    );
  });
  it("lodash prototype pollution is NOT malicious", () => {
    assert.equal(
      isMaliciousOsvVuln({
        id: "GHSA-f23m-r3pf-42rh",
        summary: "lodash vulnerable to Prototype Pollution via array path bypass in `_.unset` and `_.omit`",
        details:
          "Lodash versions 4.17.23 and earlier are vulnerable to prototype pollution in the `_.unset` and `_.omit` functions. An attacker can supply crafted paths to delete properties.",
        database_specific: { cwe_ids: ["CWE-1321"] },
      }),
      false
    );
  });
  it("an ordinary SSRF advisory is NOT malicious", () => {
    assert.equal(
      isMaliciousOsvVuln({
        id: "GHSA-p8p7-x288-28g6",
        summary: "Server-Side Request Forgery in Request",
        details: "The request package follows redirects to attacker-controlled URLs under some conditions.",
        database_specific: { cwe_ids: ["CWE-918"] },
      }),
      false
    );
  });
});

describe("maintainerNames (PV-8)", () => {
  it("extracts names from registry maintainer objects", () => {
    assert.deepEqual(maintainerNames([{ name: "colinhacks", email: "colin@example.com" }]), ["colinhacks"]);
  });
  it("accepts plain-string maintainers", () => {
    assert.deepEqual(maintainerNames(["jdalton"]), ["jdalton"]);
  });
  it("undefined maintainers give an empty list, not a crash", () => {
    assert.deepEqual(maintainerNames(undefined), []);
  });
});

describe("createdAtFromPackumentText (PV-2)", () => {
  it("finds time.created in a full packument", () => {
    const text = JSON.stringify({
      _id: "zod",
      name: "zod",
      time: { created: "2020-03-07T01:00:00.000Z", modified: "2026-01-01T00:00:00.000Z" },
      versions: {},
    });
    assert.equal(createdAtFromPackumentText(text), "2020-03-07T01:00:00.000Z");
  });
  it("returns undefined when no created stamp exists yet (partial stream)", () => {
    assert.equal(createdAtFromPackumentText('{"_id":"x","name":"x","dist-tags"'), undefined);
  });
});
