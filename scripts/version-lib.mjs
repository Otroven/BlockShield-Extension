import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_URL = "https://github.com/Otroven/BlockShield-Extension";

export const VERSION_PATH = resolve(root, "VERSION");
export const CHANGELOG_PATH = resolve(root, "CHANGELOG.md");

export const VERSIONED_JSON_FILES = [
  resolve(root, "package.json"),
  resolve(root, "frontend/package.json"),
  resolve(root, "frontend/package-lock.json"),
  resolve(root, "extension/package.json"),
  resolve(root, "extension/package-lock.json"),
  resolve(root, "indexer/package.json"),
  resolve(root, "indexer/package-lock.json"),
  resolve(root, "extension/manifest.json"),
];

export function readVersion() {
  const value = readFileSync(VERSION_PATH, "utf8").trim();
  if (!/^\d+\.\d+\.\d+$/.test(value)) {
    throw new Error(`VERSION must be MAJOR.MINOR.PATCH, got "${value}"`);
  }
  return value;
}

export function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

export function setPackageVersion(path, version) {
  const json = readJson(path);
  json.version = version;
  if (json.packages && json.packages[""] && typeof json.packages[""] === "object") {
    json.packages[""].version = version;
  }
  writeJson(path, json);
}

export function parseReleaseHeadings(changelog) {
  const matches = [...changelog.matchAll(/^## \[(\d+\.\d+\.\d+)\](?: - (\d{4}-\d{2}-\d{2}))?/gm)];
  return matches.map((match) => ({ version: match[1], date: match[2] || "" }));
}

export function latestReleaseVersion(changelog) {
  const headings = parseReleaseHeadings(changelog);
  if (!headings.length) {
    throw new Error("CHANGELOG.md has no dated release heading like ## [1.1.0] - YYYY-MM-DD");
  }
  return headings[0].version;
}

export function extractReleaseNotes(changelog, version) {
  const heading = `## [${version}]`;
  const start = changelog.indexOf(heading);
  if (start < 0) {
    throw new Error(`CHANGELOG.md has no section ${heading}`);
  }
  const after = changelog.slice(start);
  const next = after.search(/\n## \[|\n\[[^\]]+\]: /);
  const section = next === -1 ? after : after.slice(0, next);
  const lines = section.split("\n").slice(1);
  return `${lines.join("\n").trim()}\n`;
}

export function renderCompareLinks(versions) {
  const unique = [...new Set(versions)];
  const lines = [
    `[Unreleased]: ${REPO_URL}/compare/v${unique[0]}...HEAD`,
  ];
  for (let i = 0; i < unique.length; i += 1) {
    const current = unique[i];
    const previous = unique[i + 1];
    if (previous) {
      lines.push(`[${current}]: ${REPO_URL}/compare/v${previous}...v${current}`);
    } else {
      lines.push(`[${current}]: ${REPO_URL}/releases/tag/v${current}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

export function rewriteChangelogLinks(changelog) {
  const versions = parseReleaseHeadings(changelog).map((item) => item.version);
  const stripped = changelog.replace(/\n\[[^\]]+\]: https:\/\/github\.com\/[^\n]+/g, "").replace(/\s+$/, "");
  return `${stripped}\n\n${renderCompareLinks(versions)}`;
}
