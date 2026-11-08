import { diffDays, today } from "./date"
import { isActive } from "./task"
import { childrenIndex, withAncestors } from "./tree"
import type {
  DueFilter,
  Group,
  GroupBy,
  Priority,
  Row,
  SortBy,
  SpaceId,
  Task,
  TaskStatus,
  ViewId,
} from "./types"

export interface Filters {
  space: SpaceId
  view: ViewId
  query: string
  statuses: TaskStatus[]
  priorities: Priority[]
  dueFilter: DueFilter
  category: string
  showDone: boolean
}

export const EMPTY_FILTERS: Filters = {
  space: "siyuan",
  view: "all",
  query: "",
  statuses: [],
  priorities: [],
  dueFilter: "any",
  category: "",
  showDone: true,
}

function matchesTimeView(task: Task, filters: Filters): boolean {
  switch (filters.view) {
    case "trash":
      return true
    case "today":
      return isActive(task.status) && !!task.due && diffDays(today(), task.due) <= 0
    case "week": {
      if (!isActive(task.status) || !task.due) return false
      const delta = diffDays(today(), task.due)
      return delta >= 0 && delta <= 6
    }
    case "all":
      return filters.showDone || filters.statuses.length > 0 || isActive(task.status)
  }
}

function matchesDue(task: Task, filter: DueFilter): boolean {
  if (filter === "any") return true
  if (filter === "none") return !task.due
  if (!task.due) return false
  const delta = diffDays(today(), task.due)
  if (filter === "overdue") return delta < 0 && isActive(task.status)
  if (filter === "today") return delta === 0
  return delta >= 0 && delta <= 6
}

export function matchesQuery(task: Task, query: string): boolean {
  const needle = query.trim().toLocaleLowerCase()
  if (!needle) return true
  return [task.title, task.category, task.note, task.hpath].some((value) =>
    value.toLocaleLowerCase().includes(needle),
  )
}

export function matchesFilters(task: Task, filters: Filters): boolean {
  if (task.space !== filters.space) return false
  if (filters.view === "trash" ? !task.trashed : task.trashed) return false
  if (!matchesTimeView(task, filters)) return false
  if (filters.statuses.length > 0 && !filters.statuses.includes(task.status)) return false
  if (filters.priorities.length > 0 && !filters.priorities.includes(task.priority)) return false
  if (!matchesDue(task, filters.dueFilter)) return false
  const category = filters.category.trim().toLocaleLowerCase()
  if (category && !task.category.toLocaleLowerCase().includes(category)) return false
  return matchesQuery(task, filters.query)
}

export interface ViewCounts {
  today: number
  week: number
  all: number
  trash: number
}

export function computeViewCounts(tasks: Iterable<Task>, base: Filters): ViewCounts {
  const counts: ViewCounts = { today: 0, week: 0, all: 0, trash: 0 }
  for (const task of tasks) {
    for (const view of ["today", "week", "all", "trash"] as ViewId[]) {
      if (matchesFilters(task, { ...base, view })) counts[view]++
    }
  }
  return counts
}

export function computeSpaceCounts(tasks: Iterable<Task>): Record<SpaceId, number> {
  const counts: Record<SpaceId, number> = { siyuan: 0, local: 0 }
  for (const task of tasks) if (!task.trashed) counts[task.space]++
  return counts
}

export function computeStatusCounts(tasks: Task[], base: Filters): Record<TaskStatus, number> {
  const counts: Record<TaskStatus, number> = { todo: 0, doing: 0, done: 0, archived: 0 }
  for (const task of tasks) {
    if (matchesFilters(task, { ...base, statuses: [], showDone: true })) counts[task.status]++
  }
  return counts
}

function comparePriority(a: Task, b: Task): number {
  return a.priority - b.priority
}

function compareDue(a: Task, b: Task): number {
  return (a.due || "9999-12-31").localeCompare(b.due || "9999-12-31")
}

export function sortTasks(tasks: Task[], sortBy: SortBy): Task[] {
  const result = tasks.slice()
  result.sort((a, b) => {
    let compared = 0
    if (sortBy === "due") compared = compareDue(a, b) || comparePriority(a, b)
    else if (sortBy === "priority") compared = comparePriority(a, b) || compareDue(a, b)
    else if (sortBy === "created") compared = b.created.localeCompare(a.created)
    else if (sortBy === "title") compared = a.title.localeCompare(b.title, "zh-Hans-CN")
    else compared = a.sort - b.sort || a.created.localeCompare(b.created)
    return compared || a.id.localeCompare(b.id)
  })
  return result
}

function groupKey(task: Task, groupBy: GroupBy, i18n: Record<string, string>): string {
  if (groupBy === "priority") return `P${task.priority}`
  if (groupBy === "category") return task.category || i18n.uncategorized || "未分类"
  if (groupBy === "doc") return task.hpath || task.rootId || i18n.spaceLocal || "独立空间"
  if (!task.due) return i18n.groupNoDate || "无日期"
  if (!isActive(task.status)) {
    return task.status === "archived" ? i18n.statusArchived || "已归档" : i18n.statusDone || "已完成"
  }
  const delta = diffDays(today(), task.due)
  if (delta < 0) return i18n.groupOverdue || "逾期"
  if (delta === 0) return i18n.today || "今天"
  if (delta === 1) return i18n.tomorrow || "明天"
  if (delta <= 6) return i18n.groupThisWeek || "本周内"
  return i18n.groupLater || "以后"
}

export function groupTasks(tasks: Task[], groupBy: GroupBy, sortBy: SortBy, i18n: Record<string, string>): Group[] {
  const sorted = sortTasks(tasks, sortBy)
  if (groupBy === "none") return [{ key: "", label: "", count: sorted.length, ids: sorted.map((task) => task.id) }]
  const buckets = new Map<string, string[]>()
  for (const task of sorted) {
    const key = groupKey(task, groupBy, i18n)
    const bucket = buckets.get(key)
    if (bucket) bucket.push(task.id)
    else buckets.set(key, [task.id])
  }
  return Array.from(buckets, ([key, ids]) => ({ key, label: key, count: ids.length, ids })).sort((a, b) =>
    a.key.localeCompare(b.key, "zh-Hans-CN"),
  )
}

/**
 * 列表视图只输出平铺任务：顺序由 groupTasks 的分组/排序决定，
 * 父子关系仅作为任务数据展示，不参与行顺序、缩进或折叠。
 */
export function buildListRows(groups: Group[]): Row[] {
  const rows: Row[] = []
  for (const group of groups) {
    if (group.label) rows.push({ kind: "group", key: `g:${group.key}`, label: group.label, count: group.count })
    for (const id of group.ids) {
      rows.push({
        kind: "task",
        key: `${group.key}:${id}`,
        id,
        depth: 0,
        hasChildren: false,
        collapsed: false,
        muted: false,
      })
    }
  }
  return rows
}

export function buildTreeRows(index: Map<string, Task>, matched: Set<string>, sortBy: SortBy, collapsed: Set<string>): Row[] {
  const included = withAncestors(matched, index)
  const members = Array.from(included, (id) => index.get(id)).filter((task): task is Task => !!task)
  const byParent = childrenIndex(members)
  const roots = sortTasks(members.filter((task) => !task.parentId || !included.has(task.parentId)), sortBy)
  const rows: Row[] = []
  const visited = new Set<string>()
  const walk = (task: Task, depth: number): void => {
    if (visited.has(task.id)) return
    visited.add(task.id)
    const children = byParent.get(task.id) ?? []
    const isCollapsed = children.length > 0 && collapsed.has(task.id)
    rows.push({
      kind: "task",
      key: task.id,
      id: task.id,
      depth,
      hasChildren: children.length > 0,
      collapsed: isCollapsed,
      muted: !matched.has(task.id),
    })
    if (!isCollapsed) for (const child of sortTasks(children, sortBy)) walk(child, depth + 1)
  }
  for (const root of roots) walk(root, 0)
  return rows
}
