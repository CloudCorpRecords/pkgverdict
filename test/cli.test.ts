/** CLI surface (PV-7): --help / -h print help and exit 0. */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TSX = join(ROOT, "node_modules", "tsx", "dist", "cli.mjs");
const CLI = join(ROOT, "src", "cli.ts");

function runCli(args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    execFile(process.execPath, [TSX, CLI, ...args], { cwd: ROOT }, (err, stdout, stderr) => {
      const code = err ? (typeof err.code === "number" ? err.code : 1) : 0;
      resolve({ code, stdout: String(stdout), stderr: String(stderr) });
    });
  });
}

describe("cli help (PV-7)", () => {
  it("--help prints help and exits 0", async () => {
    const r = await runCli(["--help"]);
    assert.equal(r.code, 0);
    assert.match(r.stdout, /check <name/);
  });
  it("-h prints help and exits 0", async () => {
    const r = await runCli(["-h"]);
    assert.equal(r.code, 0);
    assert.match(r.stdout, /check <name/);
  });
  it("check --help prints command help and exits 0", async () => {
    const r = await runCli(["check", "--help"]);
    assert.equal(r.code, 0);
    assert.match(r.stdout, /check <name/);
  });
});
