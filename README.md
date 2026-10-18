# pkgverdict

Check an npm package **before** you install it. One command, one verdict: GO, RISKY, FAKE, or MISSING — in plain words your AI coding agent can read too.

```bash
npx -y pkgverdict check react-markdown
# [GO] react-markdown@10.1.0
#   - established, 38.4M/wk, no install scripts, no advisories, no lookalike name.

npx -y pkgverdict check unused-imports
# [FAKE] unused-imports@0.0.1-security
#   - Flagged malicious: MAL-2025-48781. Do not install.
#   - Name rides on eslint-plugin-unused-imports (suffix of popular name) and the
#     package is barely downloaded — the classic typosquat shape.

npx -y pkgverdict check react-super-hooks-plus
# [MISSING] react-super-hooks-plus
#   - react-super-hooks-plus is not on the npm registry. If an AI assistant
#     suggested it, the name was hallucinated.
```

## Why

AI assistants now pick half the packages developers install — and they hallucinate names attackers have already registered (slopsquatting), while typosquats and hijacked releases keep shipping `postinstall` malware. `npm audit` only sees published advisories, after the fact. pkgverdict checks **before** the install: existence, lookalike names, package age, install scripts, maintainers, downloads, and OSV advisories.

## Use it inside your AI coding tool

One command sets it up. In your project directory, run:

```bash
npx -y pkgverdict init --agent claude-code
```

That installs the MCP server config plus the instruction snippet teaching your agent the one behavior rule: **check pkgverdict before installing.** Supported tools: `claude-code`, `cursor`, `copilot` (VS Code), `windsurf`, `cline`, and `generic` (`init --list` shows them all; `--all` sets up everything; `--dry-run` previews without writing). Restart your tool, verify with a "list your MCP tools" prompt, and the pkgverdict server should appear with 2 tools (check_package, scan_dependencies). The underlying pack lives in [`integrations/`](integrations/README.md) if you prefer to install by hand.

## CLI

```bash
# Verdict on one package (name or name@version)
npx -y pkgverdict check lodash

# Check every dependency in package.json, worst first
npx -y pkgverdict scan
npx -y pkgverdict scan ./my-app --no-dev

# Check your setup (Node version, registry + OSV reachability, cache)
npx -y pkgverdict doctor

# JSON output for scripting and CI
npx -y pkgverdict check left-pad --json
```

Exit codes: `0` when everything is GO (or RISKY without `--strict`), `1` when a FAKE or MISSING package is found, `2` on usage errors. For CI gates that should fail on anything suspicious: `pkgverdict scan --strict`.

## Verdicts

| Verdict | Meaning |
|---|---|
| GO | Established package, no red flags. Install away. |
| RISKY | Caution: install scripts, very young, obscure, deprecated, no repo/license, known advisories, or a lookalike name on an otherwise fine package. Read before installing. |
| FAKE | Looks actively bad: typosquat-shaped name on a new/obscure package, hostile install script, or a malicious (MAL-) advisory. Do not install. |
| MISSING | Not on the registry at all — a typo or a hallucinated name, with a "did you mean" suggestion when one fits. |

Signals come from the npm registry (metadata, downloads), the OSV database (advisories), and a bundled list of well-known packages for lookalike detection. Responses cache under `~/.cache/pkgverdict` (6h metadata, 1h advisories); delete that directory to force fresh checks.

## Run it with Docker

pkgverdict also ships as a container image on GHCR: `ghcr.io/cloudcorprecords/pkgverdict`.

Use it as a stdio MCP server:

```bash
docker run -i ghcr.io/cloudcorprecords/pkgverdict
```

Any CLI command can be passed after the image name instead of the default `mcp` argument:

```bash
docker run ghcr.io/cloudcorprecords/pkgverdict <command> [args]
```

## MCP server

Run it with `npx -y pkgverdict mcp` (stdio), or point your agent at the `pkgverdict` command with the single argument `mcp`. Two tools: `check_package` (verdict on one package) and `scan_dependencies` (worst-first verdicts for a project's package.json).

## Development

```bash
npm install
npm run build
npm test        # offline fixture corpus: every verdict rule pinned to a case
```

## License

MIT.
