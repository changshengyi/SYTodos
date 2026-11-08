export interface StorageHost {
  loadData(key: string): Promise<unknown>
  saveData(key: string, value: unknown): Promise<unknown>
}

const STORAGE_TIMEOUT = 15_000

function withTimeout<T>(promise: Promise<T>, operation: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${operation}超时，结果未确认，请刷新后重试`)), STORAGE_TIMEOUT)
  })
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer)
  })
}

export function loadPluginData(host: StorageHost, key: string): Promise<unknown> {
  return withTimeout(host.loadData(key), "插件数据读取")
}

export function assertStorageSaved(response: unknown): void {
  if (response && typeof response === "object" && "code" in response) {
    const result = response as { code?: unknown; msg?: unknown }
    if (result.code !== 0) {
      throw new Error(typeof result.msg === "string" && result.msg ? result.msg : "插件数据保存失败")
    }
  }
}

export async function savePluginData(host: StorageHost, key: string, value: unknown): Promise<void> {
  assertStorageSaved(await withTimeout(host.saveData(key, value), "插件数据保存"))
}

export function isMissingStorageValue(value: unknown): boolean {
  return value === undefined || value === null || value === ""
}
