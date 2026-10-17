/**
 * pkgverdict MCP server (stdio): check_package and scan_dependencies.
 * Run with `pkgverdict mcp` or `npx -y pkgverdict mcp`.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { collectSignals } from "./signals.js";
import { scanDependencies } from "./scan.js";
import { scoreSignals } from "./verdict.js";

export function buildMcpServer(): McpServer {
  const server = new McpServer({ name: "pkgverdict", version: "0.1.0" });

  server.tool(
    "check_package",
    "Verdict on one npm package before installing it: GO, RISKY, FAKE, or MISSING, with plain-word reasons.",
    { name: z.string().describe("Package name, optionally with @version (e.g. lodash, left-pad@1.3.0)") },
    async ({ name }) => {
      const result = scoreSignals(await collectSignals(name));
      const head = `[${result.verdict}] ${result.package}${result.version ? `@${result.version}` : ""}`;
      const body = result.reasons.map((r) => `- ${r}`).join("\n");
      return { content: [{ type: "text", text: `${head}\n${body}` }] };
    }
  );

  server.tool(
    "scan_dependencies",
    "Check every dependency in a project's package.json, worst first. Returns each package with its verdict and reasons.",
    {
      dir: z.string().optional().describe("Project directory holding package.json (default: current directory)"),
      includeDev: z.boolean().optional().describe("Include devDependencies (default true)"),
    },
    async ({ dir, includeDev }) => {
      const results = await scanDependencies({
        dir: dir || process.cwd(),
        includeDev: includeDev !== false,
        concurrency: 8,
      });
      const lines = results.map(
        (r) => `[${r.verdict}] ${r.package}${r.version ? `@${r.version}` : ""}\n${r.reasons.map((x) => `  - ${x}`).join("\n")}`
      );
      return { content: [{ type: "text", text: lines.join("\n\n") || "No dependencies found." }] };
    }
  );

  return server;
}

export async function runMcp(): Promise<void> {
  await buildMcpServer().connect(new StdioServerTransport());
}
