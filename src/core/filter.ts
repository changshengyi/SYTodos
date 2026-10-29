import type { Group, GroupBy, Row, SortBy, Task, ViewId } from "./types"
import { today, diffDays } from "./date"

export interface ViewCounts {
  today: number
  week: number
  all: number
  done: number
  trash: number
}

export function matchesView(task: Task, view: ViewId): boolean {
  if (task.trashed) {
    return view === "trash"
  }
  switch (view) {
    case "trash":
      return false
    case "done":
      return task.done
    case "today":
      return !task.done && !!task.due && diffDays(task.due, today()) >= 0
    case "week": {
      if (task.done || !task.due) {
        return false
      }
      const delta = diffDays(today(), task.due)
      return delta >= -1 && delta <= 7
    }
    case "all":
    default:
      return !task.done
  }
}

export function matchesQuery(task: Task, query: string): boolean {
  if (!query) {
    return true
  }
  const needle = query.trim().toLowerCase()
  if (!needle) {
    return true
  }
  return (
    task.title.toLowerCase().includes(needle) ||
    task.category.toLowerCase().includes(needle) ||
    task.note.toLowerCase().includes(needle) ||
    task.hpath.toLowerCase().includes(needle)
  )
}

export function computeCounts(tasks: Iterable<Task>): ViewCounts {
  const counts: ViewCounts = { today: 0, week: 0, all: 0, done: 0, trash: 0 }
  for (const task of tasks) {
    if (matchesView(task, "trash")) {
      counts.trash++
    } else if (task.done) {
      counts.done++
    } else {
      counts.all++
      if (matchesView(task, "today")) {
        counts.today++
      }
      if (matchesView(task, "week")) {
        counts.week++
      }
    }
  }
  return counts
}

const PRIORITY_ORDER: Record<number, number> = { 0: 0, 1: 1, 2: 2, 3: 3 }

export function sortTasks(tasks: Task[], sortBy: SortBy): Task[] {
  const clone = tasks.slice()
  switch (sortBy) {
    case "due":
      clone.sort((a, b) => (a.due || "9999-99-99").localeCompare(b.due || "9999-99-99") || comparePriority(a, b))
      break
    case "priority":
      clone.sort((a, b) => comparePriority(a, b) || compareDue(a, b))
      break
    case "created":
      clone.sort((a, b) => b.created.localeCompare(a.created))
      break
    case "title":
      clone.sort((a, b) => a.title.localeCompare(b.title, "zh-Hans-CN"))
      break
    case "manual":
    default:
      clone.sort((a, b) => a.sort - b.sort || a.created.localeCompare(b.created))
      break
  }
  return clone
}

function comparePriority(a: Task, b: Task): number {
  return (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9)
}

function compareDue(a: Task, b: Task): number {
  return (a.due || "9999-99-99").localeCompare(b.due || "9999-99-99")
}

/** 把一个任务集合按父子关系整理成「父在前、子孙紧随」的顺序 */
export function orderedForest(tasks: Task[], ids: Set<string>): Task[] {
  const children = new Map<string, Task[]>()
  const roots: Task[] = []
  for (const task of tasks) {
    const parentId = task.parentId
    if (parentId && ids.has(parentId)) {
      const bucket = children.get(parentId)
      if (bucket) {
        bucket.push(task)
      } else {
        children.set(parentId, [task])
      }
    } else {
      roots.push(task)
    }
  }
  const result: Task[] = []
  const walk = (task: Task, depth: number) => {
    result.push(task)
    const kids = children.get(task.id)
    if (!kids || depth >= 4) {
      return
    }
    for (const kid of kids) {
      walk(kid, depth + 1)
    }
  }
  for (const root of roots) {
    walk(root, 0)
  }
  return result
}

/** 计算某个父任务下的所有子孙（用于级联完成） */
export function collectDescendants(rootId: string, index: Map<string, Task>): Task[] {
  const childrenByParent = new Map<string, Task[]>()
  for (const task of index.values()) {
    if (!task.parentId) {
      continue
    }
    const bucket = childrenByParent.get(task.parentId)
    if (bucket) {
      bucket.push(task)
    } else {
      childrenByParent.set(task.parentId, [task])
    }
  }
  const out: Task[] = []
  const stack = [rootId]
  while (stack.length > 0) {
    const current = stack.pop() as string
    for (const child of childrenByParent.get(current) ?? []) {
      out.push(child)
      stack.push(child.id)
    }
  }
  return out
}

export function collectAncestors(id: string, index: Map<string, Task>): Task[] {
  const out: Task[] = []
  let current = index.get(id)
  const guard = new Set<string>()
  while (current?.parentId) {
    if (guard.has(current.parentId)) {
      break
    }
    guard.add(current.parentId)
    const parent = index.get(current.parentId)
    if (!parent) {
      break
    }
    out.push(parent)
    current = parent
  }
  return out
}

/** 按 groupBy 生成分组；每组内部已经是包含深度信息的扁平结构所需的顺序 */
export function groupTasks(tasks: Task[], groupBy: GroupBy, sortBy: SortBy, i18n: Record<string, string>): Group[] {
  const sorted = sortTasks(tasks, sortBy)
  if (groupBy === "none") {
    return [{ key: "", label: "", count: sorted.length, ids: sorted.map((task) => task.id) }]
  }

  const buckets = new Map<string, string[]>()
  const push = (key: string, id: string) => {
    const bucket = buckets.get(key)
    if (bucket) {
      bucket.push(id)
    } else {
      buckets.set(key, [id])
    }
  }

  for (const task of sorted) {
    push(groupKey(task, groupBy, i18n), task.id)
  }

  const groups: Group[] = []
  for (const [key, ids] of buckets) {
    groups.push({ key, label: key, count: ids.length, ids })
  }
  groups.sort((a, b) => a.key.localeCompare(b.key, "zh-Hans-CN"))
  return groups
}

function groupKey(task: Task, groupBy: GroupBy, i18n: Record<string, string>): string {
  switch (groupBy) {
    case "priority":
      return `${i18n.priorityShort ?? "P"}${task.priority}`
    case "category":
      return task.category || i18n.uncategorized || "未分类"
    case "doc":
      return task.hpath || task.rootId
    case "due":
    default: {
      if (!task.due) {
        return i18n.groupNoDate || "无日期"
      }
      const delta = diffDays(today(), task.due)
      if (task.done) {
        return i18n.groupDone || "已完成"
      }
      if (delta < 0) {
        return i18n.groupOverdue || "逾期"
      }
      if (delta === 0) {
        return i18n.today || "今天"
      }
      if (delta === 1) {
        return i18n.tomorrow || "明天"
      }
      if (delta <= 7) {
        return i18n.groupThisWeek || "本周内"
      }
      return i18n.groupLater || "以后"
    }
  }
}

/** 把分组结果压平成渲染行（含层级深度） */
export function buildRows(
  groups: Group[],
  index: Map<string, Task>,
  sortBy: SortBy,
): Row[] {
  const rows: Row[] = []
  for (const group of groups) {
    if (group.label) {
      rows.push({ kind: "group", key: `g:${group.key}`, label: group.label, count: group.count })
    }
    const members = group.ids
      .map((id) => index.get(id))
      .filter((task): task is Task => !!task)
    const ids = new Set(members.map((task) => task.id))
    const ordered = orderedForest(sortTasks(members, sortBy), ids)
    const depthById = new Map<string, number>()
    for (const task of ordered) {
      let depth = 0
      let cursor = task.parentId
      const guard = new Set<string>()
      while (cursor && ids.has(cursor) && !guard.has(cursor)) {
        guard.add(cursor)
        depth++
        cursor = index.get(cursor)?.parentId ?? ""
      }
      depthById.set(task.id, Math.min(depth, 4))
    }
    for (const task of ordered) {
      rows.push({ kind: "task", key: task.id, id: task.id, depth: depthById.get(task.id) ?? 0 })
    }
  }
  return rows
}
