import fs from "fs";

// package.json에서 버전 정보를 읽어옵니다.
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const { version } = pkg;

// manifest.json의 버전을 package.json 버전과 동기화합니다.
if (fs.existsSync("manifest.json")) {
	const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf8"));
	manifest.version = version;
	fs.writeFileSync("manifest.json", JSON.stringify(manifest, null, "\t") + "\n");
	console.log(`Updated manifest.json version to ${version}`);
}
