import { reactive } from "vue"

import type { GroupBy, SortBy, ViewId } from "@/core/types"

/** 纯本地的界面状态，不落盘（除了通过 settings 的默认视图） */
export const ui = reactive({
  view: "today" as ViewId,
  groupBy: "due" as GroupBy,
  sortBy: "priority" as SortBy,
  query: "",
  /** 查看详情的任务 */
  selectedId: "",
  /** 多选集合 */
  checked: new Set<string>(),
  editingId: "",
  showSettings: false,
  /** 是否显示键盘帮助 */
  showHelp: false,
  rowHeight: 36,
})

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
