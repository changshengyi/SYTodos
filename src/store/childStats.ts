import { computed } from "vue"

import { taskState } from "./tasks"

export interface ChildStat {
  total: number
  done: number
}

export const childStatsMap = computed(() => {
  void taskState.version
  const stats = new Map<string, ChildStat>()
  for (const task of taskState.tasks.values()) {
    if (!task.parentId) continue
    const parent = taskState.tasks.get(task.parentId)
    if (!parent || parent.trashed !== task.trashed) continue
    const entry = stats.get(task.parentId) ?? { total: 0, done: 0 }
    entry.total++
    if (task.status === "done") entry.done++
    stats.set(task.parentId, entry)
  }
  return stats
})
