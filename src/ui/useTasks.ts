import { computed } from "vue"

import { buildRows, computeCounts, groupTasks, matchesQuery, matchesView, orderedForest, sortTasks } from "@/core/filter"
import type { Task } from "@/core/types"
import { strings } from "@/store/i18n"
import { settings } from "@/store/settings"
import { listTasks, taskIndex, taskState } from "@/store/tasks"
import { ui } from "@/store/ui"

/**
 * 界面共用的派生数据。所有 computed 都依赖 `taskState.version`，
 * 因此任何写入都只会触发一次重算，不依赖定时器轮询。
 */
export function useTasks() {
  const counts = computed(() => {
    void taskState.version
    return computeCounts(listTasks())
  })

  const visible = computed<Task[]>(() => {
    void taskState.version
    return listTasks().filter((task) => {
      if (!matchesQuery(task, ui.query)) {
        return false
      }
      if (!matchesView(task, ui.view)) {
        return false
      }
      if (ui.view === "all" && task.done && !settings.showDone) {
        return false
      }
      return true
    })
  })

  const rows = computed(() => {
    void taskState.version
    void ui.groupBy
    void ui.sortBy
    const index = taskIndex()
    const groups = groupTasks(visible.value, ui.groupBy, ui.sortBy, strings)
    return buildRows(groups, index, ui.sortBy)
  })

  /** 拖拽重排使用的任务序列（保持当前视图内的父子顺序） */
  const flatVisibleIds = computed<string[]>(() => {
    void taskState.version
    const ids = new Set(visible.value.map((task) => task.id))
    return orderedForest(sortTasks(visible.value, ui.sortBy), ids).map((task) => task.id)
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

  return { counts, visible, rows, flatVisibleIds, categories, total }
}
