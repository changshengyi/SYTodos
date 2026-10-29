/* eslint-disable node/prefer-global/process */
import { existsSync } from "node:fs"
import { createRequire } from "node:module"
import { resolve } from "node:path"
import vue from "@vitejs/plugin-vue"
import fg from "fast-glob"
import minimist from "minimist"
import livereload from "rollup-plugin-livereload"
import { defineConfig, loadEnv } from "vite"
import { viteStaticCopy } from "vite-plugin-static-copy"
import zipPack from "vite-plugin-zip-pack"

const require = createRequire(import.meta.url)
const pluginInfo = require("./plugin.json")

const packageImageTargets = [
  ["icon", "icon.png"],
  ["preview", "preview.png"],
].flatMap(([field, legacyName]) => {
  const fileName = pluginInfo[field] || (existsSync(resolve(process.cwd(), legacyName)) ? legacyName : "")
  return fileName ? [{ src: `./${fileName}`, dest: "./" }] : []
})

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd())
  const siyuanWorkspacePath = env.VITE_SIYUAN_WORKSPACE_PATH

  let devDistDir = "./dev"
  if (siyuanWorkspacePath) {
    console.log(`\nSiyuan workspace path is set:\n${siyuanWorkspacePath}`)
    devDistDir = `${siyuanWorkspacePath}/data/plugins/${pluginInfo.name}`
  } else {
    console.log("\nSiyuan workspace path is not set, using ./dev for watch output.")
  }

  const args = minimist(process.argv.slice(2))
  const isWatch = args.watch || args.w || false
  const distDir = isWatch ? devDistDir : "./dist"

  console.log(`Plugin will build to:\n${distDir}\n`)

  return {
    resolve: {
      alias: {
        "@": resolve(process.cwd(), "src"),
      },
    },

    plugins: [
      vue(),
      viteStaticCopy({
        targets: [
          ...packageImageTargets,
          { src: "./README*.md", dest: "./" },
          { src: "./plugin.json", dest: "./" },
          { src: "./CHANGELOG.md", dest: "./" },
          { src: "./LICENSE", dest: "./" },
          { src: "./src/i18n/**", dest: "./i18n/" },
        ],
      }),
    ],

    define: {
      "process.env.DEV_MODE": `"${isWatch}"`,
      "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV),
    },

    build: {
      outDir: distDir,
      emptyOutDir: !isWatch,
      sourcemap: false,
      minify: !isWatch,

      lib: {
        entry: resolve(process.cwd(), "src/index.ts"),
        fileName: "index",
        formats: ["cjs"],
      },

      rollupOptions: {
        plugins: [
          ...(isWatch
            ? [
                livereload(devDistDir),
                {
                  name: "watch-external",
                  async buildStart() {
                    const files = await fg(["src/i18n/*.json", "./README*.md", "./plugin.json"])
                    for (const file of files) {
                      this.addWatchFile(file)
                    }
                  },
                },
              ]
            : [
                zipPack({
                  inDir: "./dist",
                  outDir: "./",
                  outFileName: "package.zip",
                }),
              ]),
        ],

        external: ["siyuan", "process"],

        output: {
          entryFileNames: "[name].js",
          assetFileNames: (assetInfo) => {
            if (assetInfo.name === "style.css") {
              return "index.css"
            }
            return assetInfo.name
          },
        },
      },
    },
  }
})
