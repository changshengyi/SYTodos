import { reactive } from "vue"

import type { PluginSettings } from "@/core/types"
import { DEFAULT_SETTINGS } from "@/core/types"

const STORAGE_KEY = "blocktodo-settings"

export const settings = reactive<PluginSettings>({ ...DEFAULT_SETTINGS })

export interface StorageHost {
  loadData: (key: string) => Promise<unknown>
  saveData: (key: string, value: unknown) => Promise<void>
}

/** 通过 Vue provide 注入宿主（即插件实例） */
export const STORAGE_HOST = Symbol("bt-storage-host")

let saveTimer: number | undefined
let boundHost: StorageHost | undefined

/** 任何模块改动 settings 后都可以直接调用，无需持有宿主引用 */
export function persistSettings(): void {
  if (boundHost) {
    queueSaveSettings(boundHost)
  }
}

export async function loadSettings(host: StorageHost): Promise<void> {
  boundHost = host
  try {
    const stored = (await host.loadData(STORAGE_KEY)) as Partial<PluginSettings> | undefined
    if (stored && typeof stored === "object") {
      Object.assign(settings, sanitize(stored))
    }
  } catch {
    // 读取失败时使用默认值
  }
}

/** 合并式写入，避免多字段同时修改造成多次落盘 */
export function queueSaveSettings(host: StorageHost): void {
  if (saveTimer) {
    window.clearTimeout(saveTimer)
  }
  saveTimer = window.setTimeout(() => {
    saveTimer = undefined
    void host.saveData(STORAGE_KEY, { ...settings }).catch(() => {
      // 忽略写入失败，下次启动再重试
    })
  }, 400)
}

export function resetSettings(): void {
  Object.assign(settings, DEFAULT_SETTINGS)
}

function sanitize(input: Partial<PluginSettings>): Partial<PluginSettings> {
  const output: Partial<PluginSettings> = {}
  const keys = Object.keys(DEFAULT_SETTINGS) as (keyof PluginSettings)[]
  for (const key of keys) {
    if (!(key in input)) {
      continue
    }
    const value = input[key]
    if (typeof DEFAULT_SETTINGS[key] === "number" && typeof value !== "number") {
      continue
    }
    if (typeof DEFAULT_SETTINGS[key] === "boolean" && typeof value !== "boolean") {
      continue
    }
    if (typeof DEFAULT_SETTINGS[key] === "string" && typeof value !== "string") {
      continue
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(output as any)[key] = value
  }
  return output
}
