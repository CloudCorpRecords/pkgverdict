# Agent integrations

One command sets up your AI coding tool (run it in your project directory).
pkgverdict ships as a Docker image on GHCR — there is no npm package, so the
setup command runs through Docker with your project directory mounted:

```bash
docker run --rm -v "$PWD":/work -w /work ghcr.io/cloudcorprecords/pkgverdict init --agent claude-code
```

Supported tools: `claude-code`, `cursor`, `copilot` (VS Code), `windsurf`,
`cline`, and `generic`. `init --list` shows them all, `--all` sets up
everything, `--dry-run` previews without writing. Restart your tool afterwards
and verify with a "list your MCP tools" prompt — the pkgverdict server should
appear with 2 tools (check_package, scan_dependencies).

To install by hand instead: copy the tool's `mcp.json` server entry into your
MCP config and append the tool's `snippet.md` to its instructions file.
