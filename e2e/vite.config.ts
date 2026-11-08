import { resolve } from "node:path"
import vue from "@vitejs/plugin-vue"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [vue()],
  resolve: { alias: { "@": resolve(process.cwd(), "src") } },
  server: { port: 4173, strictPort: true },
})
