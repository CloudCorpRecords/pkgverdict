/** Name-similarity detection: real typosquat shapes. */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { baseName, findSimilar, levenshtein } from "../src/typosquat.js";

describe("levenshtein", () => {
  it("counts single edits", () => {
    assert.equal(levenshtein("dayjs", "dayjs"), 0);
    assert.equal(levenshtein("dayjs", "dayjs2"), 1);
    assert.equal(levenshtein("dayjs", "dajys"), 2);
  });
});

describe("baseName", () => {
  it("strips scopes", () => {
    assert.equal(baseName("@types/node"), "node");
    assert.equal(baseName("lodash"), "lodash");
  });
});

describe("findSimilar", () => {
  it("exact names never flag", () => {
    assert.deepEqual(findSimilar("dayjs"), []);
    assert.deepEqual(findSimilar("DayJS"), []);
  });
  it("well-known siblings never flag each other", () => {
    assert.deepEqual(findSimilar("lodash"), []);
    assert.deepEqual(findSimilar("lodash-es"), []);
    assert.deepEqual(findSimilar("react-router"), []);
  });
  it("single-edit typosquat (dayjs2)", () => {
    assert.deepEqual(findSimilar("dayjs2"), [{ name: "dayjs", kind: "single-edit" }]);
  });
  it("transposition (loadsh)", () => {
    assert.deepEqual(findSimilar("loadsh"), [{ name: "lodash", kind: "transposition" }]);
  });
  it("affix trick (easy-day-js, the 2026 Mastra case)", () => {
    const hits = findSimilar("easy-day-js");
    assert.ok(hits.some((h) => h.name === "dayjs"), JSON.stringify(hits));
  });
  it("suffix-of-popular trick (unused-imports)", () => {
    const hits = findSimilar("unused-imports");
    assert.ok(hits.some((h) => h.name === "eslint-plugin-unused-imports"), JSON.stringify(hits));
  });
  it("short names need near-exact matches", () => {
    assert.deepEqual(findSimilar("ws"), []);
  });
  it("unrelated names stay quiet", () => {
    assert.deepEqual(findSimilar("pkgverdict"), []);
  });
});
