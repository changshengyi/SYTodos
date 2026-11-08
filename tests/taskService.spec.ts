import { beforeEach, describe, expect, it } from "vitest"

import type { CreateTaskInput } from "@/core/types"
import { LocalTaskRepository } from "@/store/local"
import { createTaskServiceState, TaskService } from "@/store/taskService"

import { MemoryRepository, MemoryStorage } from "./helpers"

describe("统一任务命令服务", () => {
  let storage: MemoryStorage
  let local: LocalTaskRepository
  let service: TaskService
  let notifications: string[]

  const input = (title: string, parentId?: string): CreateTaskInput => ({
    space: "local",
    title,
    parentId,
    priority: 2,
    status: "todo",
  })

  beforeEach(async () => {
    storage = new MemoryStorage()
    local = new LocalTaskRepository(storage)
    await local.load()
    notifications = []
    service = new TaskService(
      { local, siyuan: new MemoryRepository("siyuan") },
      createTaskServiceState(),
      {
        resolveDefaultDoc: async () => "doc",
        shouldAdvanceRepeat: () => false,
        notify: (message) => notifications.push(message),
      },
    )
    await service.refresh()
  })

  it("创建、编辑后立即重载一致，快速连续编辑以最后命令为准", async () => {
    const created = await service.createTask(input("初版"))
    expect(created).toBeDefined()
    await Promise.all([
      service.updateTask(created!.id, { title: "第二版" }),
      service.updateTask(created!.id, { title: "第三版" }),
      service.updateTask(created!.id, { title: "最终版" }),
    ])
    expect(service.state.tasks.get(created!.id)?.title).toBe("最终版")
    expect((await new LocalTaskRepository(storage).load())[0].title).toBe("最终版")
  })

  it("缩进、反缩进和循环移动约束都在领域层执行", async () => {
    const parent = await service.createTask(input("父"))
    const sibling = await service.createTask(input("兄弟"))
    expect(await service.indentTask(sibling!.id)).toBe(true)
    expect(service.state.tasks.get(sibling!.id)?.parentId).toBe(parent!.id)
    expect(await service.moveTask(parent!.id, { parentId: sibling!.id, position: "last" })).toBe(false)
    expect(service.state.error).toContain("自己的子任务")
    expect(await service.outdentTask(sibling!.id)).toBe(true)
    expect(service.state.tasks.get(sibling!.id)?.parentId).toBe("")
  })

  it("字段编辑和结构移动都可以撤销、重做", async () => {
    const parent = await service.createTask(input("父"))
    const child = await service.createTask(input("子"))
    await service.updateTask(child!.id, { title: "子-编辑" })
    expect(await service.undo()).toBe(true)
    expect(service.state.tasks.get(child!.id)?.title).toBe("子")
    expect(await service.redo()).toBe(true)
    expect(service.state.tasks.get(child!.id)?.title).toBe("子-编辑")

    await service.indentTask(child!.id)
    expect(service.state.tasks.get(child!.id)?.parentId).toBe(parent!.id)
    expect(await service.undo()).toBe(true)
    expect(service.state.tasks.get(child!.id)?.parentId).toBe("")
    expect(await service.redo()).toBe(true)
    expect(service.state.tasks.get(child!.id)?.parentId).toBe(parent!.id)
  })

  it("创建可撤销删除、可重做新建，不依赖原块 ID", async () => {
    const created = await service.createTask(input("可撤销创建"))
    expect(await service.undo()).toBe(true)
    expect(service.state.tasks.has(created!.id)).toBe(false)
    expect(await service.redo()).toBe(true)
    expect(service.snapshot("local")).toHaveLength(1)
    expect(service.snapshot("local")[0].title).toBe("可撤销创建")
  })

  it("回收站级联子树，恢复和永久删除保持相同语义", async () => {
    const parent = await service.createTask(input("父"))
    const child = await service.createTask(input("子", parent!.id))
    await service.createTask(input("孙", child!.id))
    await service.setTrashed(parent!.id, true)
    expect(service.snapshot("local").every((task) => task.trashed)).toBe(true)
    await service.setTrashed(parent!.id, false)
    expect(service.snapshot("local").every((task) => !task.trashed)).toBe(true)
    await service.setTrashed(parent!.id, true)
    await service.deleteTask(parent!.id)
    expect(service.snapshot("local")).toHaveLength(0)
    expect(await new LocalTaskRepository(storage).load()).toHaveLength(0)
  })

  it("保存失败只返回失败并通知，不向界面提交伪造状态", async () => {
    const created = await service.createTask(input("原标题"))
    storage.failCode = 1
    expect(await service.updateTask(created!.id, { title: "失败标题" })).toBe(false)
    expect(service.state.tasks.get(created!.id)?.title).toBe("原标题")
    expect(service.state.error).toContain("模拟内核保存失败")
    expect(notifications).toHaveLength(1)
  })
})
