import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { EMPTY_FILTERS, matchesFilters } from "@/core/filter"
import { siblingKey, validateTaskForest } from "@/core/tree"

import { makeTask } from "./helpers"

describe("树约束与筛选", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-11-08T12:00:00"))
  })
  afterEach(() => vi.useRealTimers())

  it("拒绝重复 ID、悬空父级和循环父子", () => {
    expect(() => validateTaskForest([makeTask(), makeTask()])).toThrow("重复")
    expect(() => validateTaskForest([makeTask({ parentId: "missing" })])).toThrow("父任务不存在")
    expect(() =>
      validateTaskForest([
        makeTask({ id: "a", parentId: "b" }),
        makeTask({ id: "b", parentId: "a" }),
      ]),
    ).toThrow("环")
  })

  it("思源父子不能跨文档，根兄弟不能跨列表容器", () => {
    const parent = makeTask({ space: "siyuan", id: "p", rootId: "doc-a" })
    const child = makeTask({ space: "siyuan", id: "c", parentId: "p", rootId: "doc-b" })
    expect(() => validateTaskForest([parent, child], "siyuan")).toThrow("同一文档")
    const a = makeTask({ space: "siyuan", id: "a", rootId: "doc", containerId: "list-a" })
    const b = makeTask({ space: "siyuan", id: "b", rootId: "doc", containerId: "list-b" })
    expect(siblingKey(a)).not.toBe(siblingKey(b))
  })

  it("近七天严格为未来七天内，全部设置和显式状态筛选语义正确", () => {
    const active = makeTask({ space: "siyuan", due: "2026-11-14 23:59:59" })
    const later = makeTask({ space: "siyuan", id: "later", due: "2026-11-15 23:59:59" })
    const done = makeTask({ space: "siyuan", id: "done", status: "done" })
    expect(matchesFilters(active, { ...EMPTY_FILTERS, view: "week" })).toBe(true)
    expect(matchesFilters(later, { ...EMPTY_FILTERS, view: "week" })).toBe(false)
    expect(matchesFilters(done, { ...EMPTY_FILTERS, showDone: false })).toBe(false)
    expect(matchesFilters(done, { ...EMPTY_FILTERS, showDone: false, statuses: ["done"] })).toBe(true)
  })

  it("回收站与普通视图互斥，空间筛选互不可见", () => {
    const trashed = makeTask({ space: "siyuan", trashed: true })
    expect(matchesFilters(trashed, EMPTY_FILTERS)).toBe(false)
    expect(matchesFilters(trashed, { ...EMPTY_FILTERS, view: "trash" })).toBe(true)
    expect(matchesFilters(trashed, { ...EMPTY_FILTERS, space: "local", view: "trash" })).toBe(false)
  })
})
