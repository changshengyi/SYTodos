import { describe, expect, it } from "vitest"

import { buildListRows, buildTreeRows, groupTasks } from "@/core/filter"
import type { Row, Task } from "@/core/types"

import { makeTask } from "./helpers"

function fixture(): Task[] {
  const base = { created: "20260101000000" }
  return [
    makeTask({ ...base, id: "a", title: "A", priority: 0, sort: 0 }),
    makeTask({ ...base, id: "b", title: "B", parentId: "a", priority: 1, sort: 0 }),
    makeTask({ ...base, id: "c", title: "C", parentId: "b", priority: 2, sort: 0 }),
    makeTask({ ...base, id: "d", title: "D", priority: 3, sort: 1 }),
  ]
}

function taskRows(rows: Row[]): Extract<Row, { kind: "task" }>[] {
  return rows.filter((row): row is Extract<Row, { kind: "task" }> => row.kind === "task")
}

describe("三种视图的行模型", () => {
  it("列表只生成平铺行，完全不受父子关系和折叠状态影响", () => {
    const tasks = fixture()
    const groups = groupTasks(tasks, "none", "manual", {})
    const rows = taskRows(buildListRows(groups))
    expect(rows).toHaveLength(4)
    expect(rows.map((row) => row.id)).toEqual(["a", "b", "c", "d"])
    expect(rows.every((row) => row.depth === 0 && !row.hasChildren && !row.collapsed && !row.muted)).toBe(true)
    expect(taskRows(buildListRows(groupTasks(tasks, "none", "manual", {})))).toHaveLength(4)
  })

  it("列表分组只产生分组标题，组内仍为独立平铺行", () => {
    const groups = groupTasks(fixture(), "priority", "manual", {})
    const rows = buildListRows(groups)
    expect(rows.filter((row) => row.kind === "group")).toHaveLength(4)
    expect(taskRows(rows).every((row) => row.depth === 0 && !row.hasChildren)).toBe(true)
  })

  it("只有树形行按父子关系计算深度、折叠和祖先上下文", () => {
    const tasks = fixture()
    const index = new Map(tasks.map((task) => [task.id, task]))
    const matched = new Set(tasks.map((task) => task.id))
    const rows = taskRows(buildTreeRows(index, matched, "manual", new Set()))
    expect(rows.map((row) => row.id)).toEqual(["a", "b", "c", "d"])
    expect(rows.map((row) => row.depth)).toEqual([0, 1, 2, 0])
    expect(rows.map((row) => row.hasChildren)).toEqual([true, true, false, false])

    const collapsed = taskRows(buildTreeRows(index, matched, "manual", new Set(["a"])))
    expect(collapsed.map((row) => row.id)).toEqual(["a", "d"])
    expect(collapsed[0].collapsed).toBe(true)
  })

  it("筛选只命中子任务时，列表不补祖先而树形保留祖先上下文", () => {
    const tasks = fixture()
    const index = new Map(tasks.map((task) => [task.id, task]))
    const onlyGrandchild = new Set(["c"])
    const list = taskRows(buildListRows(groupTasks(tasks.filter((task) => onlyGrandchild.has(task.id)), "none", "manual", {})))
    const tree = taskRows(buildTreeRows(index, onlyGrandchild, "manual", new Set()))
    expect(list.map((row) => row.id)).toEqual(["c"])
    expect(list[0].muted).toBe(false)
    expect(tree.map((row) => row.id)).toEqual(["a", "b", "c"])
    expect(tree.map((row) => row.muted)).toEqual([true, true, false])
  })
})
