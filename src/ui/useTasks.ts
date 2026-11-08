import { computed } from "vue"

import {
  buildListRows,
  buildTreeRows,
  computeSpaceCounts,
  computeStatusCounts,
  computeViewCounts,
  groupTasks,
  matchesFilters,
  sortTasks,
} from "@/core/filter"
import type { Row, Task, TaskStatus } from "@/core/types"
import { STATUSES } from "@/core/types"
import { strings } from "@/store/i18n"
import { listTasks, taskIndex, taskState } from "@/store/tasks"
import { currentFilters, ui } from "@/store/ui"

export function useTasks() {
  const filters = computed(() => {
    void taskState.version
    return currentFilters()
  })
  const counts = computed(() => computeViewCounts(listTasks(), filters.value))
  const spaceCounts = computed(() => computeSpaceCounts(listTasks()))
  const statusCounts = computed<Record<TaskStatus, number>>(() => computeStatusCounts(listTasks(), filters.value))
  const matched = computed<Task[]>(() => {
    void taskState.version
    return listTasks().filter((task) => matchesFilters(task, filters.value))
  })
  const matchedIds = computed(() => new Set(matched.value.map((task) => task.id)))
  const rows = computed<Row[]>(() => {
    void taskState.version
    return buildListRows(groupTasks(matched.value, ui.groupBy, ui.sortBy, strings))
  })
  const treeRows = computed<Row[]>(() => {
    void taskState.version
    void ui.collapsed
    return buildTreeRows(taskIndex(), matchedIds.value, ui.sortBy, ui.collapsed)
  })
  const columns = computed(() => {
    void taskState.version
    return STATUSES.map((status) => ({
      status,
      tasks: sortTasks(matched.value.filter((task) => task.status === status), ui.sortBy),
    }))
  })
  const navigableIds = computed<string[]>(() => {
    if (ui.mode === "board") return columns.value.flatMap((column) => column.tasks.map((task) => task.id))
    const source = ui.mode === "tree" ? treeRows.value : rows.value
    return source.filter((row) => row.kind === "task").map((row) => row.id)
  })
  const categories = computed<string[]>(() => {
    void taskState.version
    const result = new Set<string>()
    for (const task of listTasks()) {
      if (task.space === ui.space && !task.trashed && task.category) result.add(task.category)
    }
    return Array.from(result).sort((a, b) => a.localeCompare(b, "zh-Hans-CN"))
  })
  const summary = computed(() => {
    void taskState.version
    const scoped = listTasks().filter((task) => task.space === ui.space)
    return {
      total: scoped.length,
      trashed: scoped.filter((task) => task.trashed).length,
      visible: matched.value.length,
      space: ui.space,
    }
  })
  return { filters, counts, spaceCounts, statusCounts, matched, matchedIds, rows, treeRows, columns, navigableIds, categories, summary }
}
