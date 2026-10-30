import { diffDays, today } from "./date"
import { isActive } from "./task"
import type {
  DueFilter,
  Group,
  GroupBy,
  Priority,
  Row,
  Scope,
  SortBy,
  Task,
  TaskStatus,
  ViewId,
} from "./types"

/** 一次性描述当前所有筛选条件的快照 */
export interface Filters {
  view: ViewId
  /** 数据范围 */
  scope: Scope
  /** 独立空间文档 ID，用于区分归属 */
  spaceDocId: string
  query: string
  /** 空数组代表不限制 */
  statuses: TaskStatus[]
  priorities: Priority[]
  dueFilter: DueFilter
  category: string
}

export const EMPTY_FILTERS: Filters = {
  view: "all",
  scope: "all",
  spaceDocId: "",
  query: "",
  statuses: [],
  priorities: [],
  dueFilter: "any",
  category: "",
}

/* ------------------------------------------------------------------ *
 * 匹配
 * ------------------------------------------------------------------ */

export function matchesFilters(task: Task, filters: Filters): boolean {
  // 回收站是独立时间视图，其他时间视图一律排除已删除
  if (filters.view === "trash") {
    if (!task.trashed) {
      return false
    }
  } else if (task.trashed) {
    return false
  }

  if (filters.scope === "space" && !task.inSpace) {
    return false
  }
  if (filters.scope === "note" && task.inSpace) {
    return false
  }

  if (!matchesTimeView(task, filters.view)) {
    return false
  }

  if (filters.statuses.length > 0 && !filters.statuses.includes(task.status)) {
    return false
  }
  if (filters.priorities.length > 0 && !filters.priorities.includes(task.priority)) {
    return false
  }
  if (!matchesDue(task, filters.dueFilter)) {
    return false
  }
  if (filters.category && !task.category.toLowerCase().includes(filters.category.trim().toLowerCase())) {
    return false
  }
  return matchesQuery(task, filters.query)
}

function matchesTimeView(task: Task, view: ViewId): boolean {
  switch (view) {
    case "trash":
      return true
    case "today":
      return isActive(task.status) && !!task.due && diffDays(task.due, today()) >= 0
    case "week": {
      if (!isActive(task.status) || !task.due) {
        return false
      }
      const delta = diffDays(today(), task.due)
      return delta >= -1 && delta <= 7
    }
    case "all":
    default:
      return true
  }
}

function matchesDue(task: Task, dueFilter: DueFilter): boolean {
  if (dueFilter === "any") {
    return true
  }
  if (dueFilter === "none") {
    return !task.due
  }
  if (!task.due) {
    return false
  }
  const delta = diffDays(today(), task.due)
  switch (dueFilter) {
    case "overdue":
      return delta < 0 && isActive(task.status)
    case "today":
      return delta === 0
    case "week":
      return delta >= -1 && delta <= 7
    default:
      return true
  }
}

export function matchesQuery(task: Task, query: string): boolean {
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

/* ------------------------------------------------------------------ *
 * 计数
 * ------------------------------------------------------------------ */

export interface ViewCounts {
  today: number
  week: number
  all: number
  trash: number
}

export function computeViewCounts(tasks: Iterable<Task>, base: Filters): ViewCounts {
  const counts: ViewCounts = { today: 0, week: 0, all: 0, trash: 0 }
  for (const task of tasks) {
    if (task.trashed) {
      counts.trash++
      continue
    }
    if (base.scope === "space" && !task.inSpace) {
      continue
    }
    if (base.scope === "note" && task.inSpace) {
      continue
    }
    if (!matchesQuery(task, base.query)) {
      continue
    }
    counts.all++
    if (isActive(task.status)) {
      if (task.due && diffDays(task.due, today()) >= 0) {
        counts.today++
      }
      if (task.due) {
        const delta = diffDays(today(), task.due)
        if (delta >= -1 && delta <= 7) {
          counts.week++
        }
      }
    }
  }
  return counts
}

export function computeStatusCounts(tasks: Task[], base: Filters): Record<TaskStatus, number> {
  const counts: Record<TaskStatus, number> = { todo: 0, doing: 0, done: 0, archived: 0 }
  for (const task of tasks) {
    if (!matchesFilters(task, { ...base, statuses: [] })) {
      continue
    }
    counts[task.status]++
  }
  return counts
}

/* ------------------------------------------------------------------ *
 * 排序
 * ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ *
 * 父子关系
 * ------------------------------------------------------------------ */

/** 建立 parentId → children 索引 */
export function childrenIndex(tasks: Iterable<Task>): Map<string, Task[]> {
  const map = new Map<string, Task[]>()
  for (const task of tasks) {
    if (!task.parentId) {
      continue
    }
    const bucket = map.get(task.parentId)
    if (bucket) {
      bucket.push(task)
    } else {
      map.set(task.parentId, [task])
    }
  }
  return map
}

/** 把任务集合整理成「父在前、子孙紧随」的顺序（同级按 sortBy 排序） */
export function orderedForest(tasks: Task[], ids: Set<string>, sortBy: SortBy = "manual"): Task[] {
  const children = new Map<string, Task[]>()
  const roots: Task[] = []
  for (const task of tasks) {
    if (task.parentId && ids.has(task.parentId)) {
      const bucket = children.get(task.parentId)
      if (bucket) {
        bucket.push(task)
      } else {
        children.set(task.parentId, [task])
      }
    } else {
      roots.push(task)
    }
  }
  const result: Task[] = []
  const walk = (task: Task) => {
    result.push(task)
    const kids = children.get(task.id)
    if (!kids) {
      return
    }
    for (const kid of sortTasks(kids, sortBy)) {
      walk(kid)
    }
  }
  for (const root of sortTasks(roots, sortBy)) {
    walk(root)
  }
  return result
}

export function collectDescendants(rootId: string, index: Map<string, Task>): Task[] {
  const byParent = childrenIndex(index.values())
  const out: Task[] = []
  const stack = [rootId]
  const guard = new Set<string>()
  while (stack.length > 0) {
    const current = stack.pop() as string
    if (guard.has(current)) {
      continue
    }
    guard.add(current)
    for (const child of byParent.get(current) ?? []) {
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

/** 计算相对深度（受限于 maxDepth，防止异常数据导致爆栈） */
function depthOf(task: Task, ids: Set<string>, index: Map<string, Task>, maxDepth = 12): number {
  let depth = 0
  let cursor = task.parentId
  const guard = new Set<string>()
  while (cursor && ids.has(cursor) && !guard.has(cursor)) {
    guard.add(cursor)
    depth++
    cursor = index.get(cursor)?.parentId ?? ""
    if (depth >= maxDepth) {
      break
    }
  }
  return depth
}

/* ------------------------------------------------------------------ *
 * 分组 & 渲染行
 * ------------------------------------------------------------------ */

export function groupTasks(tasks: Task[], groupBy: GroupBy, sortBy: SortBy, i18n: Record<string, string>): Group[] {
  const sorted = sortTasks(tasks, sortBy)
  if (groupBy === "none") {
    return [{ key: "", label: "", count: sorted.length, ids: sorted.map((task) => task.id) }]
  }

  const buckets = new Map<string, string[]>()
  for (const task of sorted) {
    const key = groupKey(task, groupBy, i18n)
    const bucket = buckets.get(key)
    if (bucket) {
      bucket.push(task.id)
    } else {
      buckets.set(key, [task.id])
    }
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
      if (task.inSpace) {
        return i18n.spaceTitle || "独立空间"
      }
      return task.hpath || task.rootId
    case "due":
    default: {
      if (!task.due) {
        return i18n.groupNoDate || "无日期"
      }
      const delta = diffDays(today(), task.due)
      if (!isActive(task.status)) {
        return task.status === "archived" ? (i18n.statusArchived || "已归档") : (i18n.statusDone || "已完成")
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

/** 把分组结果压平成渲染行（含层级深度与折叠状态） */
export function buildRows(
  groups: Group[],
  index: Map<string, Task>,
  sortBy: SortBy,
  collapsed: Set<string>,
): Row[] {
  const allIds = new Set<string>()
  for (const group of groups) {
    for (const id of group.ids) {
      allIds.add(id)
    }
  }
  const parentCount = new Map<string, number>()
  for (const id of allIds) {
    const parentId = index.get(id)?.parentId
    if (parentId) {
      parentCount.set(parentId, (parentCount.get(parentId) ?? 0) + 1)
    }
  }

  // 子孙关系只建一次索引，避免每个折叠节点都重新扫描全表
  const byParent = childrenIndex(index.values())

  const rows: Row[] = []
  for (const group of groups) {
    if (group.label) {
      rows.push({ kind: "group", key: `g:${group.key}`, label: group.label, count: group.count })
    }
    const members = group.ids
      .map((id) => index.get(id))
      .filter((task): task is Task => !!task)
    const ids = new Set(members.map((task) => task.id))
    const ordered = orderedForest(members, ids, sortBy)

    // 折叠父节点时跳过其所有子孙
    const hidden = new Set<string>()
    for (const task of ordered) {
      if (hidden.has(task.id)) {
        continue
      }
      const depth = Math.min(depthOf(task, ids, index), 6)
      const hasChildren = (parentCount.get(task.id) ?? 0) > 0
      const isCollapsed = hasChildren && collapsed.has(task.id)
      rows.push({ kind: "task", key: task.id, id: task.id, depth, hasChildren, collapsed: isCollapsed })
      if (isCollapsed) {
        const stack = [task.id]
        const guard = new Set<string>()
        while (stack.length > 0) {
          const current = stack.pop() as string
          if (guard.has(current)) {
            continue
          }
          guard.add(current)
          for (const child of byParent.get(current) ?? []) {
            hidden.add(child.id)
            stack.push(child.id)
          }
        }
      }
    }
  }
  return rows
}

/** 树形视图专用：只渲染可见的树节点 */
export function buildTreeRows(
  tasks: Task[],
  sortBy: SortBy,
  collapsed: Set<string>,
): Row[] {
  const ids = new Set(tasks.map((task) => task.id))
  const byParent = childrenIndex(tasks)
  const roots = sortTasks(
    tasks.filter((task) => !task.parentId || !ids.has(task.parentId)),
    sortBy,
  )

  const rows: Row[] = []
  const walk = (task: Task, depth: number) => {
    const children = byParent.get(task.id) ?? []
    const isCollapsed = children.length > 0 && collapsed.has(task.id)
    rows.push({
      kind: "task",
      key: task.id,
      id: task.id,
      depth: Math.min(depth, 12),
      hasChildren: children.length > 0,
      collapsed: isCollapsed,
    })
    if (isCollapsed) {
      return
    }
    for (const child of sortTasks(children, sortBy)) {
      walk(child, depth + 1)
    }
  }
  for (const root of roots) {
    walk(root, 0)
  }
  return rows
}
