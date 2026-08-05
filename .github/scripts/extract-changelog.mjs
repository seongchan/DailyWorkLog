// Extracts the most recent version's notes from README.md's "## Changelog"
// section (release.yml uses this as the GitHub Release body, instead of a
// raw git-log dump, so release notes read like the curated ones in the
// README rather than internal commit messages).
//
// Usage: node extract-changelog.mjs <expectedVersion> <readmePath> <outPath>
//
// Expects a structure like:
//   ## Changelog
//
//   ### 0.3.0 (2026-08-05)
//
//   - bullet
//   - bullet
//
//   ## License
//
// The first `###` heading found after `## Changelog` MUST start with
// <expectedVersion> — this is the guard against forgetting to update the
// README before running the Release workflow.

import fs from "fs";

const [, , expectedVersion, readmePath, outPath] = process.argv;

if (!expectedVersion || !readmePath || !outPath) {
	console.error("Usage: node extract-changelog.mjs <expectedVersion> <readmePath> <outPath>");
	process.exit(1);
}

const lines = fs.readFileSync(readmePath, "utf8").split("\n");

const changelogIdx = lines.findIndex((line) => line.trim() === "## Changelog");
if (changelogIdx === -1) {
	console.error(`::error::No "## Changelog" section found in ${readmePath}`);
	process.exit(1);
}

let i = changelogIdx + 1;
while (i < lines.length && !lines[i].startsWith("### ")) i++;
if (i >= lines.length) {
	console.error(`::error::No "### <version>" entry found under "## Changelog" in ${readmePath}`);
	process.exit(1);
}

const heading = lines[i].replace(/^###\s+/, "").trim();
if (!heading.startsWith(expectedVersion)) {
	console.error(
		`::error::README.md's latest changelog entry is "${heading}", but this release is version ` +
			`"${expectedVersion}". Update the "## Changelog" section in README.md (and README.ko.md) before ` +
			"re-running this workflow."
	);
	process.exit(1);
}

const bodyStart = i + 1;
i = bodyStart;
while (i < lines.length && !lines[i].startsWith("### ") && !lines[i].startsWith("## ")) i++;

const body = lines.slice(bodyStart, i);
while (body.length && body[0].trim() === "") body.shift();
while (body.length && body[body.length - 1].trim() === "") body.pop();

if (body.length === 0) {
	console.error(`::error::Changelog entry "${heading}" in ${readmePath} has no content.`);
	process.exit(1);
}

fs.writeFileSync(outPath, body.join("\n") + "\n");
console.log(`Extracted changelog for ${heading} -> ${outPath}`);
