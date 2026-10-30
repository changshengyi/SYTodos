import { computed } from "vue"

import { taskState } from "./tasks"

export interface ChildStat {
  total: number
  done: number
}

/**
 * parentId → 子任务统计。
 * 模块级 computed：一次遍历全量索引，所有行/卡片共享同一份结果，
 * 避免每个渲染单元各自扫描全表。
 */
export const childStatsMap = computed(() => {
  void taskState.version
  const stats = new Map<string, ChildStat>()
  for (const task of taskState.tasks.values()) {
    if (!task.parentId) {
      continue
    }
    const entry = stats.get(task.parentId) ?? { total: 0, done: 0 }
    entry.total++
    if (task.status === "done") {
      entry.done++
    }
    stats.set(task.parentId, entry)
  }
  return stats
})
