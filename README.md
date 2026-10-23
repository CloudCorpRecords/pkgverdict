# pkgverdict

Check an npm package **before** you install it. One command, one verdict: GO, RISKY, FAKE, or MISSING — in plain words your AI coding agent can read too.

pkgverdict ships as a container image on GHCR (there is **no** npm package named `pkgverdict`, so `npx pkgverdict` will 404 — use Docker):

```bash
docker run --rm ghcr.io/cloudcorprecords/pkgverdict check react-markdown
# [GO] react-markdown@10.1.0
#   - 5y old, 38.4M/wk, no install scripts, no advisories, no lookalike name.

docker run --rm ghcr.io/cloudcorprecords/pkgverdict check unused-imports
# [FAKE] unused-imports@0.0.1-security
#   - Flagged malicious: MAL-2025-48781. Do not install.
#   - Name rides on eslint-plugin-unused-imports (suffix of popular name) and the
#     package is barely downloaded — the classic typosquat shape.

docker run --rm ghcr.io/cloudcorprecords/pkgverdict check react-super-hooks-plus
# [MISSING] react-super-hooks-plus
#   - react-super-hooks-plus is not on the npm registry. If an AI assistant
#     suggested it, the name was hallucinated.
```

## Why

AI assistants now pick half the packages developers install — and they hallucinate names attackers have already registered (slopsquatting), while typosquats and hijacked releases keep shipping `postinstall` malware. `npm audit` only sees published advisories, after the fact. pkgverdict checks **before** the install: existence, lookalike names, package age, install scripts, maintainers, downloads, and OSV advisories.

## Use it inside your AI coding tool

One command sets it up. In your project directory, run:

```bash
docker run --rm -v "$PWD":/work -w /work ghcr.io/cloudcorprecords/pkgverdict init --agent claude-code
```

That installs the MCP server config plus the instruction snippet teaching your agent the one behavior rule: **check pkgverdict before installing.** Supported tools: `claude-code`, `cursor`, `copilot` (VS Code), `windsurf`, `cline`, and `generic` (`init --list` shows them all; `--all` sets up everything; `--dry-run` previews without writing). Restart your tool, verify with a "list your MCP tools" prompt, and the pkgverdict server should appear with 2 tools (check_package, scan_dependencies). The underlying pack lives in [`integrations/`](integrations/README.md) if you prefer to install by hand.

## CLI

```bash
# Verdict on one package (name or name@version)
docker run --rm ghcr.io/cloudcorprecords/pkgverdict check lodash

# Check every dependency in package.json, worst first
docker run --rm -v "$PWD":/work -w /work ghcr.io/cloudcorprecords/pkgverdict scan
docker run --rm -v "$PWD":/work -w /work ghcr.io/cloudcorprecords/pkgverdict scan ./my-app --no-dev

# Check your setup (Node version, registry + OSV reachability, cache)
docker run --rm ghcr.io/cloudcorprecords/pkgverdict doctor

# JSON output for scripting and CI
docker run --rm ghcr.io/cloudcorprecords/pkgverdict check left-pad --json
```

Exit codes: `0` when everything is GO (or RISKY without `--strict`), `1` when a FAKE or MISSING package is found, `2` on usage errors. For CI gates that should fail on anything suspicious: `pkgverdict scan --strict`.

## Verdicts

| Verdict | Meaning |
|---|---|
| GO | Established package, no red flags. Install away. |
| RISKY | Caution: install scripts, very young, obscure, deprecated, no repo/license, known advisories, or a lookalike name on an otherwise fine package. Read before installing. |
| FAKE | Looks actively bad: typosquat-shaped name on a new/obscure package, hostile install script, or a malicious advisory (MAL- id, a MAL- alias, or an OSV record whose details mark the package itself malicious/backdoored — e.g. the event-stream@3.3.6 compromise, carried under a GHSA id). Do not install. |
| MISSING | Not on the registry at all — a typo or a hallucinated name, with a "did you mean" suggestion when one fits. |

Signals come from the npm registry (metadata, downloads), the OSV database (advisories), and a bundled list of well-known packages for lookalike detection. Responses cache under `~/.cache/pkgverdict` (6h metadata, 1h advisories); delete that directory to force fresh checks.

## Run it with Docker

The GHCR image is the primary distribution: `ghcr.io/cloudcorprecords/pkgverdict`.

Use it as a stdio MCP server:

```bash
docker run --rm -i ghcr.io/cloudcorprecords/pkgverdict
```

Any CLI command can be passed after the image name instead of the default `mcp` argument:

```bash
docker run --rm ghcr.io/cloudcorprecords/pkgverdict <command> [args]
```

## MCP server

Point your MCP client at Docker (stdio):

```json
{
  "mcpServers": {
    "pkgverdict": {
      "command": "docker",
      "args": ["run", "--rm", "-i", "ghcr.io/cloudcorprecords/pkgverdict", "mcp"]
    }
  }
}
```

Two tools: `check_package` (verdict on one package) and `scan_dependencies` (worst-first verdicts for a project's package.json).

## Development

```bash
npm install
npm run build
npm test        # offline fixture corpus: every verdict rule pinned to a case
```

## License

MIT.
