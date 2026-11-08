import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ updateTask: vi.fn() }))
vi.mock("@/store/tasks", () => ({ updateTask: mocks.updateTask }))

import { draftValues, flushAllDrafts, flushDraft, hasDraft, stageDraft } from "@/store/drafts"

describe("详情草稿", () => {
  beforeEach(() => {
    mocks.updateTask.mockReset()
    mocks.updateTask.mockResolvedValue(true)
  })

  it("待保存文本严格绑定原任务 ID", async () => {
    stageDraft("task-a", { note: "A 的备注" })
    stageDraft("task-b", { note: "B 的备注" })
    await flushDraft("task-a")
    expect(mocks.updateTask).toHaveBeenCalledWith("task-a", { note: "A 的备注" })
    expect(mocks.updateTask).not.toHaveBeenCalledWith("task-a", { note: "B 的备注" })
    await flushAllDrafts()
    expect(mocks.updateTask).toHaveBeenCalledWith("task-b", { note: "B 的备注" })
  })

  it("保存期间的新输入不会被失败后的旧草稿覆盖", async () => {
    let finishFirst: ((ok: boolean) => void) | undefined
    mocks.updateTask.mockImplementationOnce(() => new Promise<boolean>((resolve) => { finishFirst = resolve }))
    stageDraft("task-a", { title: "旧标题", note: "旧备注" })
    const flushing = flushDraft("task-a")
    stageDraft("task-a", { note: "新备注" })
    finishFirst?.(false)
    await expect(flushing).resolves.toBe(false)
    expect(draftValues("task-a")).toEqual({ title: "旧标题", note: "新备注" })
    mocks.updateTask.mockResolvedValue(true)
    await expect(flushDraft("task-a")).resolves.toBe(true)
    expect(mocks.updateTask).toHaveBeenLastCalledWith("task-a", { title: "旧标题", note: "新备注" })
  })

  it("保存失败保留草稿且不会无限重试", async () => {
    mocks.updateTask.mockResolvedValue(false)
    stageDraft("task-a", { title: "未保存标题" })
    await expect(flushDraft("task-a")).resolves.toBe(false)
    expect(hasDraft("task-a")).toBe(true)
    expect(mocks.updateTask).toHaveBeenCalledTimes(1)
    await flushAllDrafts()
    expect(mocks.updateTask).toHaveBeenCalledTimes(2)
  })
})
