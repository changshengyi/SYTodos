import { reactive } from "vue"

import type { Filters } from "@/core/filter"
import type {
  DueFilter,
  GroupBy,
  Priority,
  SortBy,
  SpaceId,
  TaskStatus,
  ViewId,
  ViewMode,
} from "@/core/types"
import { STATUSES } from "@/core/types"

import { settings } from "./settings"

export const ui = reactive({
  space: "siyuan" as SpaceId,
  view: "all" as ViewId,
  mode: "list" as ViewMode,
  query: "",
  statuses: [] as TaskStatus[],
  priorities: [] as Priority[],
  dueFilter: "any" as DueFilter,
  category: "",
  filterOpen: false,
  groupBy: "none" as GroupBy,
  sortBy: "manual" as SortBy,
  selectedId: "",
  editingId: "",
  checked: new Set<string>(),
  collapsed: new Set<string>(),
  showSettings: false,
  showHelp: false,
  showCreate: false,
  createParentId: "",
  detailId: "",
  rowHeight: 36,
})

export function currentFilters(): Filters {
  return {
    space: ui.space,
    view: ui.view,
    query: ui.query,
    statuses: ui.statuses,
    priorities: ui.priorities,
    dueFilter: ui.dueFilter,
    category: ui.category,
    showDone: settings.showDone,
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
  if (index >= 0) list.splice(index, 1)
  else list.push(value)
}

export function toggleStatusFilter(status: TaskStatus): void {
  if (!ui.statuses.length) {
    ui.statuses = [status]
    return
  }
  toggleIn(ui.statuses, status)
  if (ui.statuses.length === STATUSES.length) ui.statuses = []
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
  if (ui.collapsed.has(id)) ui.collapsed.delete(id)
  else ui.collapsed.add(id)
}

export function expandAll(): void {
  ui.collapsed.clear()
}

export function collapseAll(ids: string[]): void {
  ui.collapsed.clear()
  for (const id of ids) ui.collapsed.add(id)
}

export function toggleChecked(id: string): void {
  if (ui.checked.has(id)) ui.checked.delete(id)
  else ui.checked.add(id)
}

export function clearChecked(): void {
  ui.checked.clear()
}

export function openCreate(parentId = ""): void {
  ui.createParentId = parentId
  ui.showCreate = true
}

export function resetSelection(): void {
  ui.selectedId = ""
  ui.editingId = ""
  ui.detailId = ""
  ui.checked.clear()
  ui.collapsed.clear()
}
