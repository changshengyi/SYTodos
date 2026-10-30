import { reactive } from "vue"

import type { Filters } from "@/core/filter"
import type {
  DueFilter,
  GroupBy,
  Priority,
  Scope,
  SortBy,
  TaskStatus,
  ViewId,
  ViewMode,
} from "@/core/types"

import { settings } from "./settings"

/** 纯本地的界面状态，不落盘（除了通过 settings 的默认视图） */
export const ui = reactive({
  view: "today" as ViewId,
  mode: "list" as ViewMode,
  scope: "all" as Scope,
  query: "",
  /** 高级搜索：状态 / 优先级 / 截止 / 分类，空数组或默认值表示不限制 */
  statuses: [] as TaskStatus[],
  priorities: [] as Priority[],
  dueFilter: "any" as DueFilter,
  category: "",
  filterOpen: false,

  groupBy: "due" as GroupBy,
  sortBy: "priority" as SortBy,

  selectedId: "",
  editingId: "",
  checked: new Set<string>(),
  /** 树形/列表里被折叠的任务 ID */
  collapsed: new Set<string>(),

  showSettings: false,
  showHelp: false,
  rowHeight: 36,
})

/** 由当前界面状态组装筛选快照 */
export function currentFilters(): Filters {
  return {
    view: ui.view,
    scope: ui.scope,
    spaceDocId: settings.spaceDocId,
    query: ui.query,
    statuses: ui.statuses,
    priorities: ui.priorities,
    dueFilter: ui.dueFilter,
    category: ui.category,
  }
}

export function hasActiveFilters(): boolean {
  return (
    ui.statuses.length > 0 ||
    ui.priorities.length > 0 ||
    ui.dueFilter !== "any" ||
    ui.category.trim() !== "" ||
    ui.query.trim() !== ""
  )
}

function toggleIn<T>(list: T[], value: T): void {
  const index = list.indexOf(value)
  if (index >= 0) {
    list.splice(index, 1)
  } else {
    list.push(value)
  }
}

export function toggleStatusFilter(status: TaskStatus): void {
  toggleIn(ui.statuses, status)
}

export function togglePriorityFilter(priority: Priority): void {
  toggleIn(ui.priorities, priority)
}

export function resetFilters(): void {
  ui.query = ""
  ui.statuses = []
  ui.priorities = []
  ui.dueFilter = "any"
  ui.category = ""
}

export function toggleCollapsed(id: string): void {
  if (ui.collapsed.has(id)) {
    ui.collapsed.delete(id)
  } else {
    ui.collapsed.add(id)
  }
}

export function expandAll(): void {
  ui.collapsed.clear()
}

export function toggleChecked(id: string): void {
  if (ui.checked.has(id)) {
    ui.checked.delete(id)
  } else {
    ui.checked.add(id)
  }
}

export function clearChecked(): void {
  ui.checked.clear()
}
