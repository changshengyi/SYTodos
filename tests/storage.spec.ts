import { afterEach, describe, expect, it, vi } from "vitest"

import { LocalTaskRepository } from "@/store/local"

import { makeDraft, MemoryStorage } from "./helpers"

describe("思源插件存储边界", () => {
  afterEach(() => vi.useRealTimers())

  it("全新安装时空字符串存档被视为不存在", async () => {
    const storage = new MemoryStorage()
    storage.data.set("sytodos-local-v2", "")
    await expect(new LocalTaskRepository(storage).load()).resolves.toEqual([])
  })

  it("saveData 永不兑现时会在十五秒后失败而不是永久卡住", async () => {
    vi.useFakeTimers()
    const repository = new LocalTaskRepository({
      loadData: async () => null,
      saveData: () => new Promise(() => undefined),
    })
    await repository.load()
    const saving = repository.create(makeDraft())
    const assertion = expect(saving).rejects.toThrow("超时")
    await vi.advanceTimersByTimeAsync(15_000)
    await assertion
  })
})
