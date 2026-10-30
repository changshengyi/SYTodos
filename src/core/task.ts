import type { TaskBlockRow } from "@/api/kernel"

import type { Priority, Task, TaskStatus } from "./types"
import { parseIAL, pickAttr } from "./ial"

/** 本插件使用的块属性名（统一 `custom-bt-` 前缀） */
export const ATTR = {
  priority: "custom-bt-p",
  status: "custom-bt-status",
  due: "custom-bt-due",
  repeat: "custom-bt-repeat",
  category: "custom-bt-cat",
  note: "custom-bt-note",
  sort: "custom-bt-sort",
  trash: "custom-bt-trash",
  space: "custom-bt-space",
} as const

const MARKER_RE = /^\s*(?:[-*+])\s*\[([ xX])\]\s*([\s\S]*)$/

/** 去掉行尾 IAL，例如 `{: id="xxx" custom-bt-p="P1"}` */
export function stripIAL(text: string): string {
  return text.replace(/\s*\{\:\s*[\s\S]*?\}\s*$/, "").trimEnd()
}

/** 从块 markdown / content 中拆出「完成状态 + 标题」 */
export function parseMarkdown(raw: string): { done: boolean; title: string } {
  const source = (raw ?? "").replace(/\r\n/g, "\n")
  const withoutIAL = stripIAL(source)
  const matched = MARKER_RE.exec(withoutIAL)
  if (matched) {
    return { done: matched[1] !== " ", title: matched[2].trim() }
  }
  const plain = withoutIAL.replace(/^\s*[-*+]\s*/, "").trim()
  return { done: false, title: plain }
}

/** 构造写入用 markdown */
export function buildMarkdown(title: string, done: boolean): string {
  return `* [${done ? "X" : " "}] ${title}`
}

export function normalizePriority(value: string): Priority {
  if (value !== "") {
    const numeric = Number(value)
    if (numeric === 0 || numeric === 1 || numeric === 2 || numeric === 3) {
      return numeric
    }
  }
  const upper = (value || "").toUpperCase()
  if (upper === "P0" || upper === "HIGHEST") {
    return 0
  }
  if (upper === "P1" || upper === "HIGH") {
    return 1
  }
  if (upper === "P2" || upper === "MEDIUM") {
    return 2
  }
  return 3
}

export function toAttrPriority(priority: Priority): string {
  return `P${priority}`
}

/** 属性里保存的状态值：todo 用空值表示，减少无意义属性 */
export function toAttrStatus(status: TaskStatus): string {
  return status === "todo" || status === "done" ? "" : status
}

/**
 * 状态是「块 markdown 的勾选态」与「属性」的组合：
 * - `[x]` 一律视为已完成（与笔记原生行为保持一致）
 * - 否则读 `custom-bt-status`，缺省为待办
 */
export function deriveStatus(done: boolean, attrStatus: string): TaskStatus {
  if (done) {
    return "done"
  }
  if (attrStatus === "doing" || attrStatus === "archived") {
    return attrStatus
  }
  return "todo"
}

/** 把一条 SQL 行转换成 Task */
export function rowToTask(row: TaskBlockRow, attrsInput?: Record<string, string>): Task {
  const attrs = attrsInput ?? parseIAL(row.ial ?? "")
  const { done, title } = parseMarkdown(row.markdown || row.content || "")
  const sort = Number(pickAttr(attrs, ATTR.sort))
  return {
    id: row.id,
    parentId: row.parent_id ?? "",
    rootId: row.root_id ?? "",
    box: row.box ?? "",
    hpath: row.hpath ?? "",
    title,
    status: deriveStatus(done, pickAttr(attrs, ATTR.status)),
    priority: normalizePriority(pickAttr(attrs, ATTR.priority)),
    due: pickAttr(attrs, ATTR.due),
    repeat: pickAttr(attrs, ATTR.repeat),
    category: pickAttr(attrs, ATTR.category),
    note: pickAttr(attrs, ATTR.note),
    sort: Number.isFinite(sort) ? sort : Number.MAX_SAFE_INTEGER,
    trashed: pickAttr(attrs, ATTR.trash) !== "",
    inSpace: false,
    created: row.created ?? "",
    updated: row.updated ?? "",
  }
}

export function isActive(status: TaskStatus): boolean {
  return status === "todo" || status === "doing"
}

export function isCompleted(task: Task): boolean {
  return task.status === "done"
}
