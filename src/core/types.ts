/** 优先级：P0 最高、P3 最低。 */
export type Priority = 0 | 1 | 2 | 3

export const PRIORITIES: Priority[] = [0, 1, 2, 3]

/** 一条待办在内存中的表示。数据事实源始终是思源笔记里的任务列表块。 */
export interface Task {
  /** 块 ID */
  id: string
  /** 父块 ID（可能是任务块 —— 即它是子任务，也可能是容器块/文档块） */
  parentId: string
  /** 所属文档 ID */
  rootId: string
  /** 笔记本 ID */
  box: string
  /** 文档人类可读路径 */
  hpath: string
  title: string
  done: boolean
  priority: Priority
  /** YYYY-MM-DD，空字符串代表没有截止日期 */
  due: string
  /** 重复规则，形如 `1d` `3d` `1w` `1m` `1y`，空字符串代表不重复 */
  repeat: string
  category: string
  note: string
  /** 手动排序权重 */
  sort: number
  trashed: boolean
  created: string
  updated: string
}

export type ViewId = "today" | "week" | "all" | "done" | "trash"

export type GroupBy = "none" | "due" | "priority" | "category" | "doc"

export type SortBy = "manual" | "due" | "priority" | "created" | "title"

/** 扁平渲染行 */
export type Row =
  | { kind: "group"; key: string; label: string; count: number }
  | { kind: "task"; key: string; id: string; depth: number }

export interface Group {
  key: string
  label: string
  count: number
  ids: string[]
}

/** 撤销栈条目 */
export interface UndoEntry {
  label: string
  undo: () => Promise<void>
  redo?: () => Promise<void>
}

export interface PluginSettings {
  /** 新建待办默认写入的文档 ID；留空表示自动使用当天日记 */
  defaultDocId: string
  /** 自动使用当天日记时的笔记本 ID；留空表示第一个笔记本 */
  defaultBox: string
  /** 默认视图 */
  defaultView: ViewId
  /** 默认分组方式 */
  defaultGroupBy: GroupBy
  /** 默认排序方式 */
  defaultSortBy: SortBy
  /** 重复任务勾选后自动推进到下一次（不标记为已完成） */
  repeatAdvance: boolean
  /** 显示已完成的任务 */
  showDone: boolean
  /** 关闭动效 */
  reduceMotion: boolean
}

export const DEFAULT_SETTINGS: PluginSettings = {
  defaultDocId: "",
  defaultBox: "",
  defaultView: "today",
  defaultGroupBy: "due",
  defaultSortBy: "priority",
  repeatAdvance: true,
  showDone: false,
  reduceMotion: false,
}
