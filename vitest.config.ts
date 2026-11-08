import { resolve } from "node:path"
import vue from "@vitejs/plugin-vue"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [vue()],
  resolve: { alias: { "@": resolve(process.cwd(), "src") } },
  test: {
    environment: "jsdom",
    include: ["tests/**/*.spec.ts"],
    restoreMocks: true,
    clearMocks: true,
  },
})
