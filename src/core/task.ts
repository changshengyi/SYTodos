import type { Priority, Task, TaskStatus } from "./types"
import { parseIAL, pickAttr } from "./ial"

export const ATTR = {
  priority: "custom-bt-p",
  status: "custom-bt-status",
  start: "custom-bt-start",
  due: "custom-bt-due",
  repeat: "custom-bt-repeat",
  category: "custom-bt-cat",
  note: "custom-bt-note",
  sort: "custom-bt-sort",
  trash: "custom-bt-trash",
} as const

export interface TaskBlockRow {
  id: string
  parent_id?: string
  root_id?: string
  box?: string
  hpath?: string
  content?: string
  markdown?: string
  created?: string
  updated?: string
  ial?: string
  parent_type?: string
  parent_subtype?: string
  container_parent_id?: string
  container_parent_type?: string
  container_parent_subtype?: string
}

const MARKER_RE = /^\s*[-*+]\s*\[([ xX])\]\s*([\s\S]*)$/
const TRAILING_IAL_RE = /\s*\{:\s*[^}\n]*\}\s*$/

export function normalizeTitle(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim()
}

export function parseMarkdown(raw: string): { done: boolean; title: string } {
  const firstLine = raw.replace(/\r\n/g, "\n").split("\n")[0] ?? ""
  const matched = MARKER_RE.exec(firstLine)
  if (!matched) {
    return { done: false, title: firstLine.replace(TRAILING_IAL_RE, "").trim() }
  }
  return {
    done: matched[1].toLowerCase() === "x",
    title: matched[2].replace(TRAILING_IAL_RE, "").trim(),
  }
}

export function buildTaskMarkdown(title: string, done: boolean): string {
  return `* [${done ? "X" : " "}] ${normalizeTitle(title)}`
}

/** 仅改首个任务标记/标题，保留子列表、附加内容和所有块 ID。 */
export function rewriteTaskKramdown(source: string, title: string, done: boolean, changeTitle: boolean): string {
  const lines = source.replace(/\r\n/g, "\n").split("\n")
  const index = lines.findIndex((line) => /^(\s*[-*+]\s*\[)([ xX])(\]\s*)(.*)$/.test(line))
  if (index < 0) {
    throw new Error("无法识别任务块的完成标记，已停止写入")
  }
  const matched = /^(\s*[-*+]\s*\[)([ xX])(\]\s*)(.*)$/.exec(lines[index]) as RegExpExecArray
  let content = matched[4]
  if (changeTitle) {
    const ial = TRAILING_IAL_RE.exec(content)?.[0] ?? ""
    content = `${normalizeTitle(title)}${ial}`
  }
  lines[index] = `${matched[1]}${done ? "X" : " "}${matched[3]}${content}`
  return lines.join("\n")
}

export function normalizePriority(value: unknown): Priority {
  if (value === 0 || value === 1 || value === 2 || value === 3) return value
  const text = String(value ?? "").toUpperCase()
  if (text === "0" || text === "P0") return 0
  if (text === "1" || text === "P1") return 1
  if (text === "2" || text === "P2") return 2
  return 3
}

export function deriveStatus(done: boolean, stored: string): TaskStatus {
  if (done) return "done"
  return stored === "doing" || stored === "archived" ? stored : "todo"
}

export function resolveRowParentId(row: TaskBlockRow): string {
  if (row.parent_type === "i" && row.parent_subtype === "t") {
    return row.parent_id ?? ""
  }
  if (row.container_parent_type === "i" && row.container_parent_subtype === "t") {
    return row.container_parent_id ?? ""
  }
  return ""
}

export function rowToTask(row: TaskBlockRow, attrsInput?: Record<string, string>): Task {
  const attrs = attrsInput ?? parseIAL(row.ial ?? "")
  const parsed = parseMarkdown(row.markdown || row.content || "")
  const storedSort = pickAttr(attrs, ATTR.sort)
  const sort = storedSort.trim() ? Number(storedSort) : 0
  return {
    space: "siyuan",
    id: row.id,
    parentId: resolveRowParentId(row),
    containerId: row.parent_type === "l" ? (row.parent_id ?? "") : "",
    rootId: row.root_id ?? "",
    box: row.box ?? "",
    hpath: row.hpath ?? "",
    title: parsed.title,
    status: deriveStatus(parsed.done, pickAttr(attrs, ATTR.status)),
    priority: normalizePriority(pickAttr(attrs, ATTR.priority)),
    start: pickAttr(attrs, ATTR.start),
    due: pickAttr(attrs, ATTR.due),
    repeat: pickAttr(attrs, ATTR.repeat),
    category: pickAttr(attrs, ATTR.category),
    note: pickAttr(attrs, ATTR.note),
    sort: Number.isFinite(sort) ? sort : 0,
    trashed: pickAttr(attrs, ATTR.trash) !== "",
    created: row.created ?? "",
    updated: row.updated ?? "",
  }
}

export function taskToAttrs(task: Task): Record<string, string> {
  return {
    [ATTR.priority]: `P${task.priority}`,
    [ATTR.status]: task.status === "doing" || task.status === "archived" ? task.status : "",
    [ATTR.start]: task.start,
    [ATTR.due]: task.due,
    [ATTR.repeat]: task.repeat,
    [ATTR.category]: task.category,
    [ATTR.note]: task.note,
    [ATTR.sort]: String(task.sort),
    [ATTR.trash]: task.trashed ? "1" : "",
  }
}

export function diffTaskAttrs(before: Task, after: Task): Record<string, string> {
  const oldAttrs = taskToAttrs(before)
  const newAttrs = taskToAttrs(after)
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(newAttrs)) {
    if (oldAttrs[key] !== value) result[key] = value
  }
  return result
}

export function isActive(status: TaskStatus): boolean {
  return status === "todo" || status === "doing"
}

export function isCompleted(task: Task): boolean {
  return task.status === "done"
}
