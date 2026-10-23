/** Doctor probe resilience (PV-9): one transient OSV failure must not fail the run. */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { doctor } from "../src/doctor.js";

describe("doctor", () => {
  it("PV-9: OSV probe retries once before declaring NOT READY", async () => {
    const realFetch = globalThis.fetch;
    let osvCalls = 0;
    globalThis.fetch = (async (url: unknown) => {
      const u = String(url);
      if (u.includes("api.osv.dev")) {
        osvCalls += 1;
        if (osvCalls === 1) throw new Error("transient network blip");
        return new Response("{}", { status: 400 });
      }
      return new Response("{}", { status: 404 });
    }) as typeof fetch;
    try {
      const { lines, ready } = await doctor();
      const osv = lines.find((l) => l.name === "osv advisories");
      assert.ok(osv, "osv line exists");
      assert.equal(osv.ok, true);
      assert.ok(osvCalls >= 2, `expected an OSV retry, saw ${osvCalls} call(s)`);
      assert.equal(ready, true);
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});
