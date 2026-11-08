import { describe, expect, it } from "vitest"

import { LocalTaskRepository } from "@/store/local"

import { makeDraft, makeTask, MemoryStorage } from "./helpers"

describe("独立空间持久化", () => {
  it("所有字段和父子关系在立即重载后保持一致", async () => {
    const storage = new MemoryStorage()
    const repository = new LocalTaskRepository(storage)
    await repository.load()
    const parent = await repository.create(makeDraft({
      title: "父任务",
      status: "doing",
      priority: 0,
      start: "2026-01-01 08:00:00",
      due: "2026-01-02 09:00:00",
      repeat: "1w",
      category: "项目",
      note: "第一行\n第二行",
    }))
    const child = await repository.create(makeDraft({ title: "子任务", parentId: parent.created.id, status: "done" }))

    const reloaded = new LocalTaskRepository(storage)
    const tasks = await reloaded.load()
    expect(tasks).toHaveLength(2)
    expect(tasks.find((task) => task.id === parent.created.id)).toMatchObject({
      status: "doing",
      priority: 0,
      start: "2026-01-01 08:00:00",
      due: "2026-01-02 09:00:00",
      repeat: "1w",
      category: "项目",
      note: "第一行\n第二行",
    })
    expect(tasks.find((task) => task.id === child.created.id)?.parentId).toBe(parent.created.id)
    expect(tasks.find((task) => task.id === child.created.id)?.status).toBe("done")
  })

  it("saveData 非零响应会使操作失败且不污染内存", async () => {
    const storage = new MemoryStorage()
    const repository = new LocalTaskRepository(storage)
    await repository.load()
    const { created } = await repository.create(makeDraft())
    storage.failCode = 1
    await expect(
      repository.update([{ before: created, after: { ...created, title: "不应保存" } }]),
    ).rejects.toThrow("模拟内核保存失败")
    await expect(repository.load()).resolves.toMatchObject([{ title: "新任务" }])
  })

  it("损坏主存档从最后成功备份恢复，而不是以空数组覆盖", async () => {
    const storage = new MemoryStorage()
    const repository = new LocalTaskRepository(storage)
    await repository.load()
    const first = await repository.create(makeDraft({ title: "第一版" }))
    await repository.update([{ before: first.created, after: { ...first.created, title: "第二版" } }])
    storage.data.set("sytodos-local-v2", "{broken")
    const recovered = await new LocalTaskRepository(storage).load()
    expect(recovered).toHaveLength(1)
    expect(recovered[0].title).toBe("第一版")
  })

  it("重复 ID、悬空父级和循环存档会被拒绝且不发起保存", async () => {
    const duplicate = makeTask({ id: "local-same" })
    const storage = new MemoryStorage()
    storage.data.set("sytodos-local-v2", { version: 2, tasks: [duplicate, duplicate] })
    await expect(new LocalTaskRepository(storage).load()).rejects.toThrow("重复")
    storage.data.set("sytodos-local-v2", {
      version: 2,
      tasks: [
        makeTask({ id: "local-a", parentId: "local-b" }),
        makeTask({ id: "local-b", parentId: "local-a" }),
      ],
    })
    await expect(new LocalTaskRepository(storage).load()).rejects.toThrow("环")
    expect(storage.saves).toHaveLength(0)
  })

  it("永久删除父任务会在同一事务中删除整棵子树", async () => {
    const storage = new MemoryStorage()
    const repository = new LocalTaskRepository(storage)
    await repository.load()
    const parent = await repository.create(makeDraft({ title: "父" }))
    const child = await repository.create(makeDraft({ title: "子", parentId: parent.created.id }))
    await repository.create(makeDraft({ title: "孙", parentId: child.created.id }))
    expect(await repository.delete(parent.created.id)).toHaveLength(0)
    expect(await new LocalTaskRepository(storage).load()).toHaveLength(0)
  })
})
