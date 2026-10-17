# pkgverdict rules

The pkgverdict MCP server is connected (tools: check_package, scan_dependencies).
Before installing any npm package, call check_package: on FAKE or MISSING, stop
and explain why (quoting the reasons) instead of installing; on RISKY, explain
and ask first; on GO, continue. After dependency changes, run scan_dependencies.
