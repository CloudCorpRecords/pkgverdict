# pkgverdict rules for Claude Code

You have the pkgverdict MCP server connected (2 tools: check_package, scan_dependencies).
It answers one question: is this npm package safe to install?

Rules:

1. BEFORE running npm/pnpm/yarn/bun install or add for any package, call
   `check_package` with the package name.
   - If the verdict is FAKE or MISSING: STOP. Tell the human why, quoting the
     reasons, and suggest the real package it names. Do not install.
   - If the verdict is RISKY: explain the risk and ask before continuing.
   - If the verdict is GO: continue.
2. After changing package.json dependencies, call `scan_dependencies` on the
   project and report anything worse than GO.
3. NEVER install a package the human did not ask for, and never "claim" a
   MISSING name by publishing to it.
