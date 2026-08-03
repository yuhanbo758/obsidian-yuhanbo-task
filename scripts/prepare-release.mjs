import fs from "node:fs";

/**
 * 读取并解析 JSON 文件。
 * @param {string} filePath JSON 文件路径。
 * @returns {Record<string, any>} 解析后的对象。
 */
function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

/**
 * 使用制表符格式写回 JSON，并保留文件末尾换行。
 * @param {string} filePath JSON 文件路径。
 * @param {Record<string, any>} value 要写入的对象。
 * @returns {void}
 */
function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, "\t")}\n`, "utf8");
}

/**
 * 校验并拆分 Obsidian 支持的三段式语义版本号。
 * @param {string} version 版本号。
 * @returns {[number, number, number]} 主版本、次版本和补丁版本。
 */
function parseVersion(version) {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(version);
  if (!match) {
    throw new Error(`版本号必须为 x.y.z 格式，当前值为：${version}`);
  }
  return match.slice(1).map(Number);
}

/**
 * 将补丁版本递增一位。
 * @param {string} version 当前版本号。
 * @returns {string} 递增后的版本号。
 */
function bumpPatch(version) {
  const [major, minor, patch] = parseVersion(version);
  return `${major}.${minor}.${patch + 1}`;
}

const mode = process.argv[2];
if (!["--bump-patch", "--sync-manifest", "--from-package"].includes(mode)) {
  throw new Error(
    "用法：node scripts/prepare-release.mjs --bump-patch|--sync-manifest|--from-package",
  );
}

const manifest = readJson("manifest.json");
const packageJson = readJson("package.json");
const packageLock = readJson("package-lock.json");
const versions = readJson("versions.json");

let targetVersion;
if (mode === "--bump-patch") {
  targetVersion = bumpPatch(manifest.version);
} else if (mode === "--from-package") {
  targetVersion = packageJson.version;
} else {
  targetVersion = manifest.version;
}

parseVersion(targetVersion);

// manifest.json 是 Obsidian 判断最新版本的来源，其他版本文件必须与其一致。
manifest.version = targetVersion;
packageJson.version = targetVersion;
packageLock.version = targetVersion;

if (!packageLock.packages || !packageLock.packages[""]) {
  throw new Error("package-lock.json 缺少根包信息 packages['']");
}
packageLock.packages[""].version = targetVersion;

// versions.json 让旧版 Obsidian 能选择与其兼容的插件版本。
versions[targetVersion] = manifest.minAppVersion;

writeJson("manifest.json", manifest);
writeJson("package.json", packageJson);
writeJson("package-lock.json", packageLock);
writeJson("versions.json", versions);

console.log(`已准备 Obsidian 插件版本 ${targetVersion}`);
