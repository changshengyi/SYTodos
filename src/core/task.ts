import type { TaskBlockRow } from "@/api/kernel"

import type { Priority, Task } from "./types"
import { parseIAL, pickAttr } from "./ial"

/** 本插件使用的块属性名（统一 `custom-bt-` 前缀） */
export const ATTR = {
  priority: "custom-bt-p",
  due: "custom-bt-due",
  repeat: "custom-bt-repeat",
  category: "custom-bt-cat",
  note: "custom-bt-note",
  sort: "custom-bt-sort",
  trash: "custom-bt-trash",
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
    done,
    priority: normalizePriority(pickAttr(attrs, ATTR.priority)),
    due: pickAttr(attrs, ATTR.due),
    repeat: pickAttr(attrs, ATTR.repeat),
    category: pickAttr(attrs, ATTR.category),
    note: pickAttr(attrs, ATTR.note),
    sort: Number.isFinite(sort) ? sort : Number.MAX_SAFE_INTEGER,
    trashed: pickAttr(attrs, ATTR.trash) !== "",
    created: row.created ?? "",
    updated: row.updated ?? "",
  }
}

/** Task → 需要写入的属性集合（空串表示删除） */
export function taskToAttrs(task: Task, fitted: Partial<Task>): Record<string, string> {
  const attrs: Record<string, string> = {}
  if (fitted.priority !== undefined) {
    attrs[ATTR.priority] = task.priority === 3 ? "" : toAttrPriority(task.priority)
  }
  if (fitted.due !== undefined) {
    attrs[ATTR.due] = task.due
  }
  if (fitted.repeat !== undefined) {
    attrs[ATTR.repeat] = task.repeat
  }
  if (fitted.category !== undefined) {
    attrs[ATTR.category] = task.category
  }
  if (fitted.note !== undefined) {
    attrs[ATTR.note] = task.note
  }
  if (fitted.sort !== undefined) {
    attrs[ATTR.sort] = String(task.sort)
  }
  if (fitted.trashed !== undefined) {
    attrs[ATTR.trash] = task.trashed ? new Date().toISOString() : ""
  }
  return attrs
}
