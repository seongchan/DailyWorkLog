import fs from "fs";

// Ported from DayTime Tracker's update-version.js (ref_docs/TODO.md Phase 7)
// — kept as .mjs here (rather than DayTime Tracker's plain .js) since this
// package.json doesn't set "type": "module"; a plain .js file would be
// parsed as CommonJS and fail on the `import` syntax below.

// 1. package.json에서 업데이트된 새 버전을 읽어옵니다.
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const newVersion = pkg.version;

if (!newVersion) {
	console.error("Error: Could not find version in package.json");
	process.exit(1);
}

// 2. manifest.json의 버전을 업데이트합니다.
const manifestPath = "manifest.json";
if (fs.existsSync(manifestPath)) {
	const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
	const oldVersion = manifest.version;
	manifest.version = newVersion;
	fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, "\t") + "\n");
	console.log(`Updated manifest.json: ${oldVersion} -> ${newVersion}`);
} else {
	console.error("Error: manifest.json not found");
	process.exit(1);
}

// 3. versions.json에 새 버전 호환성 맵핑을 추가합니다.
const versionsPath = "versions.json";
if (fs.existsSync(versionsPath)) {
	const versions = JSON.parse(fs.readFileSync(versionsPath, "utf8"));
	const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

	// 새 버전에 현재 manifest의 최소 지원 버전을 맵핑하여 추가합니다.
	versions[newVersion] = manifest.minAppVersion || "0.15.0";

	fs.writeFileSync(versionsPath, JSON.stringify(versions, null, "\t") + "\n");
	console.log(`Updated versions.json with version ${newVersion}`);
} else {
	console.error("Error: versions.json not found");
	process.exit(1);
}
