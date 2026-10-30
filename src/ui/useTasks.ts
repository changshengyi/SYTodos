import { computed } from "vue"

import {
  buildRows,
  buildTreeRows,
  computeStatusCounts,
  computeViewCounts,
  groupTasks,
  matchesFilters,
  orderedForest,
  sortTasks,
} from "@/core/filter"
import type { Task, TaskStatus } from "@/core/types"
import { STATUSES } from "@/core/types"
import { strings } from "@/store/i18n"
import { listTasks, taskIndex, taskState } from "@/store/tasks"
import { currentFilters, ui } from "@/store/ui"

/**
 * 界面共用的派生数据。所有 computed 都依赖 `taskState.version`，
 * 因此任何写入都只会触发一次重算，不依赖定时器轮询。
 */
export function useTasks() {
  const filters = computed(() => {
    void taskState.version
    return currentFilters()
  })

  const counts = computed(() => {
    void taskState.version
    return computeViewCounts(listTasks(), filters.value)
  })

  const statusCounts = computed<Record<TaskStatus, number>>(() => {
    void taskState.version
    return computeStatusCounts(listTasks(), filters.value)
  })

  /** 当前筛选后的任务集合 */
  const visible = computed<Task[]>(() => {
    void taskState.version
    return listTasks().filter((task) => matchesFilters(task, filters.value))
  })

  /** 列表视图：按分组 + 层级压平 */
  const rows = computed(() => {
    void taskState.version
    void ui.groupBy
    void ui.sortBy
    void ui.collapsed
    const groups = groupTasks(visible.value, ui.groupBy, ui.sortBy, strings)
    return buildRows(groups, taskIndex(), ui.sortBy, ui.collapsed)
  })

  /** 树形视图：只保留任务间的层级关系 */
  const treeRows = computed(() => {
    void taskState.version
    void ui.sortBy
    void ui.collapsed
    return buildTreeRows(visible.value, ui.sortBy, ui.collapsed)
  })

  /** 看板视图：按状态分列 */
  const columns = computed(() => {
    void taskState.version
    void ui.sortBy
    return STATUSES.map((status) => ({
      status,
      tasks: sortTasks(
        visible.value.filter((task) => task.status === status),
        ui.sortBy,
      ),
    }))
  })

  /** 拖拽重排使用的任务序列（保持当前视图内的父子顺序） */
  const flatVisibleIds = computed<string[]>(() => {
    void taskState.version
    const ids = new Set(visible.value.map((task) => task.id))
    return orderedForest(sortTasks(visible.value, ui.sortBy), ids, ui.sortBy).map((task) => task.id)
  })

  const categories = computed<string[]>(() => {
    void taskState.version
    const set = new Set<string>()
    for (const task of listTasks()) {
      if (task.category) {
        set.add(task.category)
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "zh-Hans-CN"))
  })

  const total = computed(() => listTasks().length)

  return { filters, counts, statusCounts, visible, rows, treeRows, columns, flatVisibleIds, categories, total }
}
