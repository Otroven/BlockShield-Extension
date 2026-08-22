import { readFileSync } from "node:fs";
import {
  CHANGELOG_PATH,
  VERSIONED_JSON_FILES,
  latestReleaseVersion,
  readJson,
  readVersion,
} from "./version-lib.mjs";

const version = readVersion();
const changelog = readFileSync(CHANGELOG_PATH, "utf8");
const latest = latestReleaseVersion(changelog);
const errors = [];

if (latest !== version) {
  errors.push(`VERSION (${version}) != latest CHANGELOG release (${latest})`);
}

if (!changelog.includes(`## [${version}]`)) {
  errors.push(`CHANGELOG.md missing heading ## [${version}]`);
}

const unreleasedLink = `[Unreleased]: https://github.com/Otroven/BlockShield-Extension/compare/v${version}...HEAD`;
if (!changelog.includes(unreleasedLink)) {
  errors.push(`CHANGELOG.md Unreleased compare link must be:\n  ${unreleasedLink}`);
}

if (!changelog.includes(`[${version}]: https://github.com/Otroven/BlockShield-Extension/`)) {
  errors.push(`CHANGELOG.md missing footer link for [${version}]`);
}

for (const path of VERSIONED_JSON_FILES) {
  const json = readJson(path);
  if (json.version !== version) {
    errors.push(`${path} version is ${json.version}, expected ${version}`);
  }
  if (json.packages?.[""]?.version && json.packages[""].version !== version) {
    errors.push(`${path} packages[""].version is ${json.packages[""].version}, expected ${version}`);
  }
}

if (errors.length) {
  process.stderr.write(`${errors.map((line) => `- ${line}`).join("\n")}\n`);
  process.exit(1);
}

process.stdout.write(`Version ${version} is consistent across VERSION, CHANGELOG, and package manifests.\n`);
