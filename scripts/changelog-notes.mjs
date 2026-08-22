import { readFileSync } from "node:fs";
import { CHANGELOG_PATH, extractReleaseNotes, readVersion } from "./version-lib.mjs";

const version = readVersion();
process.stdout.write(extractReleaseNotes(readFileSync(CHANGELOG_PATH, "utf8"), version));
