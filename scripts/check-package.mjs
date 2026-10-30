/**
 * 打包前自检：复现思源社区集市 `rules/` 里最容易出错的几条约束。
 * 用法：`npm run check-package`（在 `npm run build` 之后）
 */
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs"
import { join, resolve } from "node:path"

const ROOT = resolve(process.cwd(), "dist")
const problems = []
const notes = []

function walk(dir, relative = "") {
  return readdirSync(join(dir, relative), { withFileTypes: true }).flatMap((entry) => {
    const name = relative ? `${relative}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      return walk(dir, name)
    }
    return [name]
  })
}

if (!existsSync(ROOT)) {
  console.error("dist 目录不存在，请先执行 npm run build")
  process.exit(1)
}

const files = walk(ROOT)
const has = (name) => files.includes(name)

/* 1. 包根必要文件（大小写敏感） */
for (const required of ["index.js", "plugin.json", "README.md"]) {
  if (!has(required)) {
    problems.push(`缺少必要文件：${required}`)
  }
}
if (!has("index.css")) {
  problems.push("缺少样式入口：index.css")
}
if (!files.some((name) => name.startsWith("i18n/"))) {
  problems.push("缺少 i18n/ 语言文件")
}
const manifest = JSON.parse(readFileSync(join(ROOT, "plugin.json"), "utf8"))
for (const lang of ["zh-CN", "en-US"]) {
  if (!has(`i18n/${lang}.json`)) {
    problems.push(`缺少语言文件：i18n/${lang}.json`)
  }
}
if (!has(manifest.readme?.["zh-CN"] ?? "README_zh_CN.md")) {
  problems.push(`plugin.json 的 readme 指向的文件不存在：${manifest.readme?.["zh-CN"]}`)
}

/* 2. 图片体积（icon <= 64KB, preview <= 512KB） */
const imageLimits = [
  ["icon.png", 64 * 1024],
  ["preview.png", 512 * 1024],
]
for (const [name, limit] of imageLimits) {
  if (!has(name)) {
    notes.push(`未包含 ${name}（可选）`)
    continue
  }
  const size = statSync(join(ROOT, name)).size
  if (size > limit) {
    problems.push(`${name} 体积 ${size} 字节，超过上限 ${limit} 字节`)
  }
  const head = readFileSync(join(ROOT, name)).subarray(0, 8)
  if (!head.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    problems.push(`${name} 不是合法的 PNG 文件`)
  }
}

/* 3. 文件名规范：首尾空格、Windows 保留名 */
const reserved = new Set([
  "CON", "PRN", "AUX", "NUL",
  "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
  "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
])
for (const name of files) {
  const parts = name.split("/")
  for (const part of parts) {
    if (part !== part.trim()) {
      problems.push(`文件/目录名首尾含空格：${name}`)
    }
    const base = part.split(".")[0].toUpperCase()
    if (reserved.has(base)) {
      problems.push(`使用了 Windows 保留名：${name}`)
    }
  }
}

/* 4. 清单字段 */
for (const field of ["name", "author", "url", "version", "minAppVersion", "displayName", "description"]) {
  if (!manifest[field]) {
    problems.push(`plugin.json 缺少字段：${field}`)
  }
}
// npm 包名不允许大写，因此这里按大小写不敏感比较；plugin.json 的 name 需与 GitHub 仓库名完全一致
const pkgName = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")).name
if (manifest.name.toLowerCase() !== String(pkgName).toLowerCase()) {
  problems.push(`plugin.json 的 name（${manifest.name}）必须与 package.json（${pkgName}）以及 GitHub 仓库名一致`)
}
if (!manifest.keywords?.length) {
  notes.push("建议补充 keywords，方便在集市被搜到")
}

/* 输出 */
for (const note of notes) {
  console.log(`提示：${note}`)
}
if (problems.length > 0) {
  for (const problem of problems) {
    console.error(`错误：${problem}`)
  }
  process.exit(1)
}
console.log(`通过：dist 包含 ${files.length} 个文件，符合集市上架规范。`)
