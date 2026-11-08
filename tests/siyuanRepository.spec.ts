import { describe, expect, it } from "vitest"

import type { TaskBlockRow } from "@/core/task"
import type { Task } from "@/core/types"
import { SiyuanTaskRepository } from "@/data/siyuanRepository"
import type { SiyuanKernel } from "@/data/siyuanRepository"

import { makeDraft } from "./helpers"

class FakeKernel implements SiyuanKernel {
  rows: TaskBlockRow[] = []
  attrs = new Map<string, Record<string, string>>()
  sources = new Map<string, string>()
  updates: { id: string; markdown: string }[] = []
  appended: { parentId: string; markdown: string }[] = []
  deleted: string[] = []
  flushCount = 0
  failAttrs = 0
  failFlush = 0
  private sequence = 0

  async fetchTaskRows() {
    return { rows: this.rows, hasIal: false }
  }
  async fetchRowsByIds(ids: string[]) {
    return { rows: this.rows.filter((row) => ids.includes(row.id)), hasIal: false }
  }
  async findTaskIdsByToken(token: string) {
    return this.rows.filter((row) => `${row.markdown ?? ""}${row.content ?? ""}`.includes(token)).map((row) => row.id)
  }
  async getBlockAttrs(id: string) {
    return { ...(this.attrs.get(id) ?? {}) }
  }
  async getBlockKramdown(id: string) {
    return this.sources.get(id) ?? this.rows.find((row) => row.id === id)?.markdown ?? ""
  }
  async updateBlock(id: string, markdown: string) {
    this.updates.push({ id, markdown })
    const row = this.rows.find((item) => item.id === id)
    if (row) row.markdown = markdown
    this.sources.set(id, markdown)
    return null
  }
  async setBlockAttrs(id: string, attrs: Record<string, string>) {
    if (this.failAttrs-- > 0) throw new Error("模拟属性写入失败")
    this.attrs.set(id, { ...this.attrs.get(id), ...attrs })
    return null
  }
  async appendBlock(parentId: string, markdown: string) {
    this.appended.push({ parentId, markdown })
    const id = `new-${++this.sequence}`
    const isTask = parentId.startsWith("parent")
    this.rows.push({
      id,
      parent_id: `list-${id}`,
      root_id: isTask ? this.rows.find((row) => row.id === parentId)?.root_id ?? "doc-a" : parentId,
      parent_type: "l",
      container_parent_id: isTask ? parentId : "",
      container_parent_type: isTask ? "i" : "",
      container_parent_subtype: isTask ? "t" : "",
      markdown,
    })
    return null
  }
  async insertBlock(previousId: string, markdown: string) {
    const previous = this.rows.find((row) => row.id === previousId)
    return this.appendBlock(previous?.container_parent_id || previous?.root_id || "doc-a", markdown)
  }
  async moveBlock(id: string, previousId: string, parentId: string) {
    const row = this.rows.find((item) => item.id === id)
    const previous = this.rows.find((item) => item.id === previousId)
    if (!row) throw new Error("待移动块不存在")
    row.parent_id = previous?.parent_id ?? parentId ?? previous?.parent_id
    row.root_id = previous?.root_id ?? (parentId === "doc-b" ? "doc-b" : parentId === "doc-a" ? "doc-a" : row.root_id)
    if (parentId === "list-b") row.root_id = "doc-b"
    row.container_parent_id = parentId.startsWith("parent") ? parentId : ""
    row.container_parent_type = parentId.startsWith("parent") ? "i" : ""
    row.container_parent_subtype = parentId.startsWith("parent") ? "t" : ""
    return null
  }
  async deleteBlock(id: string) {
    this.deleted.push(id)
    this.rows = this.rows.filter((row) => row.id !== id)
    this.attrs.delete(id)
    return null
  }
  async flushTransaction() {
    this.flushCount++
    if (this.failFlush-- > 0) throw new Error("模拟索引冲刷失败")
    return null
  }
}

function remoteTask(id: string, title = "旧标题"): Task {
  return {
    space: "siyuan",
    id,
    parentId: "",
    containerId: "list-a",
    rootId: "doc-a",
    box: "box",
    hpath: "/日记",
    title,
    status: "todo",
    priority: 2,
    start: "",
    due: "",
    repeat: "",
    category: "",
    note: "",
    sort: 1000,
    trashed: false,
    created: "20260101000000",
    updated: "20260101000000",
  }
}

describe("思源仓库协议", () => {
  it("新建全字段任务通过唯一标记定位并在回读验证后提交", async () => {
    const api = new FakeKernel()
    const repository = new SiyuanTaskRepository(api)
    const result = await repository.create(
      makeDraft({
        space: "siyuan",
        rootId: "doc-a",
        title: "完整任务",
        status: "done",
        priority: 0,
        start: "2026-01-01 08:00:00",
        due: "2026-01-02 09:00:00",
        repeat: "1w",
        category: "工作",
        note: "备注",
      }),
      "",
    )
    expect(api.appended[0].markdown).toContain("[X]")
    expect(api.appended[0].markdown).not.toContain("完整任务")
    expect(result.created).toMatchObject({
      title: "完整任务",
      status: "done",
      priority: 0,
      start: "2026-01-01 08:00:00",
      due: "2026-01-02 09:00:00",
      category: "工作",
      note: "备注",
    })
    expect(api.attrs.get(result.created.id)?.["custom-bt-p"]).toBe("P0")
    expect(api.flushCount).toBeGreaterThanOrEqual(2)
  })

  it("创建属性写入失败会删除刚创建的真实块", async () => {
    const api = new FakeKernel()
    api.failAttrs = 1
    const repository = new SiyuanTaskRepository(api)
    await expect(repository.create(makeDraft({ space: "siyuan", rootId: "doc-a" }), "")).rejects.toThrow("模拟属性写入失败")
    expect(api.deleted).toEqual(["new-1"])
    expect(api.rows).toHaveLength(0)
  })

  it("创建后首次索引冲刷失败也会找回临时块并清理", async () => {
    const api = new FakeKernel()
    api.failFlush = 1
    const repository = new SiyuanTaskRepository(api)
    await expect(repository.create(makeDraft({ space: "siyuan", rootId: "doc-a" }), "")).rejects.toThrow("模拟索引冲刷失败")
    expect(api.deleted).toEqual(["new-1"])
    expect(api.rows).toHaveLength(0)
  })

  it("标题与完成状态更新保留完整 kramdown 子树", async () => {
    const api = new FakeKernel()
    const task = remoteTask("task-a")
    const source = `* [ ] 旧标题\n  * [ ] 子任务\n    {: id="child"}\n{: id="task-a"}`
    api.rows.push({ id: task.id, parent_id: "list-a", root_id: "doc-a", parent_type: "l", markdown: "* [ ] 旧标题" })
    api.sources.set(task.id, source)
    const repository = new SiyuanTaskRepository(api)
    const before = (await repository.load())[0]
    await repository.update([{ before, after: { ...before, title: "新标题", status: "done" } }])
    expect(api.updates[0].markdown).toContain("* [X] 新标题")
    expect(api.updates[0].markdown).toContain('* [ ] 子任务\n    {: id="child"}')
    expect(api.updates[0].markdown.endsWith('{: id="task-a"}')).toBe(true)
  })

  it("属性阶段失败会同时回滚 Markdown 和属性", async () => {
    const api = new FakeKernel()
    const task = remoteTask("task-a")
    api.rows.push({ id: task.id, parent_id: "list-a", root_id: "doc-a", parent_type: "l", markdown: "* [ ] 旧标题" })
    api.sources.set(task.id, "* [ ] 旧标题\n{: id=\"task-a\"}")
    api.failAttrs = 1
    const repository = new SiyuanTaskRepository(api)
    const before = (await repository.load())[0]
    await expect(repository.update([{ before, after: { ...before, title: "新标题", status: "done", priority: 0 } }])).rejects.toThrow()
    expect(api.updates.at(-1)?.markdown).toContain("[ ] 旧标题")
    expect(api.updates.at(-1)?.markdown).not.toContain("新标题")
  })

  it("跨文档移动回读后同步 rootId 和 containerId", async () => {
    const api = new FakeKernel()
    const task = remoteTask("task-a")
    api.rows.push({ id: task.id, parent_id: "list-a", root_id: "doc-a", parent_type: "l", markdown: "* [ ] 任务" })
    const repository = new SiyuanTaskRepository(api)
    const snapshot = await repository.move(
      task,
      { parentId: "", rootId: "doc-b", containerId: "list-b", previousId: "" },
      { parentId: "", rootId: "doc-a", containerId: "list-a", previousId: "" },
      [],
    )
    expect(snapshot[0]).toMatchObject({ rootId: "doc-b", containerId: "list-b", parentId: "" })
  })
})
