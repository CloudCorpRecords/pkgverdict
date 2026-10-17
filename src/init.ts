/**
 * `pkgverdict init`: one-command agent setup.
 *
 * Copies (or JSON-merges) the MCP server config into the current project and
 * installs the instruction snippet teaching the agent the one behavior rule:
 * check pkgverdict before installing a package. Safety rules: existing
 * configs are merged (other servers preserved), instruction appends are
 * marker-guarded and idempotent, nothing is overwritten without --force,
 * and --dry-run only reports.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PACK = join(HERE, "..", "integrations");

export interface InitTool {
  id: string;
  label: string;
  configSrc: string;
  configDest: string;
  serverMapKey: "mcpServers" | "servers" | null;
  instructionsSrc?: string;
  instructionsDest?: string;
  restartNote: string;
}

export const INIT_TOOLS: InitTool[] = [
  {
    id: "claude-code", label: "Claude Code",
    configSrc: "claude-code/mcp.json", configDest: ".mcp.json", serverMapKey: "mcpServers",
    instructionsSrc: "claude-code/snippet.md", instructionsDest: "CLAUDE.md",
    restartNote: "Restart Claude Code, then ask it to list its MCP tools.",
  },
  {
    id: "cursor", label: "Cursor",
    configSrc: "cursor/mcp.json", configDest: ".cursor/mcp.json", serverMapKey: "mcpServers",
    instructionsSrc: "cursor/snippet.md", instructionsDest: ".cursorrules",
    restartNote: "Restart Cursor so it picks up the MCP server.",
  },
  {
    id: "copilot", label: "Copilot (VS Code)",
    configSrc: "copilot/mcp.json", configDest: ".vscode/mcp.json", serverMapKey: "servers",
    instructionsSrc: "copilot/snippet.md", instructionsDest: ".github/muse-instructions.md",
    restartNote: "Reload VS Code, then check the MCP panel for pkgverdict.",
  },
  {
    id: "windsurf", label: "Windsurf",
    configSrc: "windsurf/mcp.json", configDest: ".codeium/windsurf/mcp_config.json", serverMapKey: "mcpServers",
    restartNote: "Restart Windsurf so it picks up the MCP server.",
  },
  {
    id: "cline", label: "Cline",
    configSrc: "cline/mcp.json", configDest: ".mcp.json", serverMapKey: "mcpServers",
    instructionsSrc: "cline/snippet.md", instructionsDest: ".clinerules",
    restartNote: "Restart the IDE so Cline picks up the MCP server.",
  },
  {
    id: "generic", label: "Generic (any MCP client)",
    configSrc: "generic/mcp.json", configDest: "pkgverdict.mcp.json", serverMapKey: null,
    instructionsSrc: "generic/snippet.md", instructionsDest: "AGENTS.md",
    restartNote: "Point your MCP client at pkgverdict.mcp.json.",
  },
];

const MARK_BEGIN = "<!-- pkgverdict:init:begin -->";
const MARK_END = "<!-- pkgverdict:init:end -->";

export interface InitResult {
  tool: string;
  config: string;
  instructions: string;
}

function mergeServerConfig(dest: string, srcJson: string, mapKey: "mcpServers" | "servers", dryRun: boolean): string {
  const incoming = JSON.parse(srcJson) as { mcpServers: Record<string, unknown> };
  if (!existsSync(dest)) {
    if (!dryRun) {
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, JSON.stringify({ [mapKey]: incoming.mcpServers }, null, 2) + "\n");
    }
    return `${dryRun ? "would write" : "wrote"} ${dest}`;
  }
  const current = JSON.parse(readFileSync(dest, "utf8")) as Record<string, unknown>;
  const map = (current[mapKey] ?? {}) as Record<string, unknown>;
  if (map["pkgverdict"]) return `already set up in ${dest}`;
  map["pkgverdict"] = incoming.mcpServers["pkgverdict"];
  current[mapKey] = map;
  if (!dryRun) writeFileSync(dest, JSON.stringify(current, null, 2) + "\n");
  return `${dryRun ? "would merge into" : "merged into"} ${dest}`;
}

function installInstructions(dest: string, snippet: string, dryRun: boolean, force: boolean): string {
  const block = `${MARK_BEGIN}\n${snippet.trim()}\n${MARK_END}\n`;
  if (!existsSync(dest)) {
    if (!dryRun) {
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, block);
    }
    return `${dryRun ? "would write" : "wrote"} ${dest}`;
  }
  const current = readFileSync(dest, "utf8");
  if (current.includes(MARK_BEGIN)) {
    const next = current.replace(/<!-- pkgverdict:init:begin -->[\s\S]*?<!-- pkgverdict:init:end -->\n?/, block);
    if (next === current) return `already set up in ${dest}`;
    if (!force) return `${dest} has an older snippet (re-run with --force to update)`;
    if (!dryRun) writeFileSync(dest, next);
    return `${dryRun ? "would update snippet in" : "updated snippet in"} ${dest}`;
  }
  if (!dryRun) writeFileSync(dest, current.replace(/\s*$/, "\n\n") + block);
  return `${dryRun ? "would append to" : "appended to"} ${dest}`;
}

export function runInit(toolIds: string[], opts: { dryRun: boolean; force: boolean; dir: string }): InitResult[] {
  const out: InitResult[] = [];
  for (const id of toolIds) {
    const tool = INIT_TOOLS.find((t) => t.id === id);
    if (!tool) throw new Error(`Unknown agent tool: ${id} (--list shows them all)`);
    const srcJson = readFileSync(join(PACK, tool.configSrc), "utf8");
    const dest = join(opts.dir, tool.configDest);
    let config: string;
    if (tool.serverMapKey) {
      config = mergeServerConfig(dest, srcJson, tool.serverMapKey, opts.dryRun);
    } else if (!existsSync(dest) || opts.force) {
      if (!opts.dryRun) {
        mkdirSync(dirname(dest), { recursive: true });
        writeFileSync(dest, srcJson);
      }
      config = `${opts.dryRun ? "would write" : "wrote"} ${dest}`;
    } else {
      config = `${dest} exists (re-run with --force to overwrite)`;
    }
    let instructions = "no snippet for this tool";
    if (tool.instructionsSrc && tool.instructionsDest) {
      const snippet = readFileSync(join(PACK, tool.instructionsSrc), "utf8");
      instructions = installInstructions(join(opts.dir, tool.instructionsDest), snippet, opts.dryRun, opts.force);
    }
    out.push({ tool: tool.label, config, instructions });
  }
  return out;
}
