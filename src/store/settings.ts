import { reactive } from "vue"

import type { PluginSettings } from "@/core/types"
import { DEFAULT_SETTINGS } from "@/core/types"
import type { StorageHost } from "@/data/storage"
import { loadPluginData, savePluginData } from "@/data/storage"

const STORAGE_KEY = "blocktodo-settings"

export const settings = reactive<PluginSettings>({ ...DEFAULT_SETTINGS })
export const settingsState = reactive({ loaded: false, saving: false, error: "" })
export const STORAGE_HOST = Symbol("sytodos-storage")

let host: StorageHost | undefined
let saveChain: Promise<void> = Promise.resolve()
let notifier: ((message: string) => void | Promise<void>) | undefined

const VALID_VALUES: { [K in keyof PluginSettings]?: readonly unknown[] } = {
  defaultSpace: ["siyuan", "local"],
  defaultView: ["today", "week", "all", "trash"],
  defaultMode: ["list", "tree", "board"],
  defaultGroupBy: ["none", "due", "priority", "category", "doc"],
  defaultSortBy: ["manual", "due", "priority", "created", "title"],
}

function sanitize(input: unknown): Partial<PluginSettings> {
  if (!input || typeof input !== "object") return {}
  const source = input as Record<string, unknown>
  const result: Partial<PluginSettings> = {}
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof PluginSettings)[]) {
    const value = source[key]
    if (value === undefined) continue
    if (typeof value !== typeof DEFAULT_SETTINGS[key]) continue
    if (VALID_VALUES[key] && !VALID_VALUES[key].includes(value)) continue
    Object.assign(result, { [key]: value })
  }
  return result
}

export async function loadSettings(nextHost: StorageHost): Promise<void> {
  host = nextHost
  settingsState.error = ""
  try {
    Object.assign(settings, DEFAULT_SETTINGS, sanitize(await loadPluginData(nextHost, STORAGE_KEY)))
  } catch (error) {
    Object.assign(settings, DEFAULT_SETTINGS)
    settingsState.error = error instanceof Error ? error.message : String(error)
  } finally {
    settingsState.loaded = true
  }
}

export function setSettingsNotifier(next: ((message: string) => void | Promise<void>) | undefined): void {
  notifier = next
}

export function persistSettings(): Promise<boolean> {
  if (!host) return Promise.resolve(false)
  const snapshot = { ...settings }
  const run = saveChain.then(async () => {
    if (!host) throw new Error("插件存储不可用")
    settingsState.saving = true
    settingsState.error = ""
    try {
      await savePluginData(host, STORAGE_KEY, snapshot)
      return true
    } catch (error) {
      settingsState.error = error instanceof Error ? error.message : String(error)
      await notifier?.(`设置保存失败：${settingsState.error}`)
      return false
    } finally {
      settingsState.saving = false
    }
  })
  saveChain = run.then(() => undefined, () => undefined)
  return run
}

export async function flushSettings(): Promise<void> {
  await saveChain
}

export function resetSettings(): Promise<boolean> {
  Object.assign(settings, DEFAULT_SETTINGS)
  return persistSettings()
}
