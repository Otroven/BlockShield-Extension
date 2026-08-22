import { readFileSync, writeFileSync } from "node:fs";
import {
  CHANGELOG_PATH,
  VERSIONED_JSON_FILES,
  latestReleaseVersion,
  readVersion,
  rewriteChangelogLinks,
  setPackageVersion,
} from "./version-lib.mjs";

const version = readVersion();
const changelog = readFileSync(CHANGELOG_PATH, "utf8");
const latest = latestReleaseVersion(changelog);
if (latest !== version) {
  throw new Error(
    `VERSION is ${version} but the latest CHANGELOG release heading is ${latest}. Move Unreleased notes into ## [${version}] first.`
  );
}

for (const path of VERSIONED_JSON_FILES) {
  setPackageVersion(path, version);
}

writeFileSync(CHANGELOG_PATH, rewriteChangelogLinks(changelog));
process.stdout.write(`Synced package/manifest versions and CHANGELOG compare links to ${version}\n`);
