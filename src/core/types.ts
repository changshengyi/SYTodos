/** 优先级：P0 最高、P3 最低。 */
export type Priority = 0 | 1 | 2 | 3

export const PRIORITIES: Priority[] = [0, 1, 2, 3]

/** 任务状态。`done` 映射到任务列表块的 `[x]`，其余存在 `custom-bt-status` 属性里。 */
export type TaskStatus = "todo" | "doing" | "done" | "archived"

export const STATUSES: TaskStatus[] = ["todo", "doing", "done", "archived"]

/** 一条待办在内存中的表示。数据事实源始终是思源笔记里的任务列表块。 */
export interface Task {
  /** 块 ID */
  id: string
  /** 父块 ID：可能是任务块（子任务），也可能是容器块/文档块（根任务） */
  parentId: string
  /** 所属文档 ID */
  rootId: string
  /** 笔记本 ID */
  box: string
  /** 文档人类可读路径 */
  hpath: string
  title: string
  status: TaskStatus
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
  /** 是否属于「独立空间」任务树 */
  inSpace: boolean
  created: string
  updated: string
}

/** 数据范围：全部 / 仅笔记里的任务列表块 / 仅独立空间 */
export type Scope = "all" | "note" | "space"

/** 时间快捷视图 */
export type ViewId = "today" | "week" | "all" | "trash"

/** 展示形态 */
export type ViewMode = "list" | "tree" | "board"

export type DueFilter = "any" | "overdue" | "today" | "week" | "none"

export type GroupBy = "none" | "due" | "priority" | "category" | "doc"

export type SortBy = "manual" | "due" | "priority" | "created" | "title"

/** 扁平渲染行 */
export type Row =
  | { kind: "group"; key: string; label: string; count: number }
  | { kind: "task"; key: string; id: string; depth: number; hasChildren: boolean; collapsed: boolean }

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
  /** 新建笔记待办默认写入的文档 ID；留空表示自动使用当天日记 */
  defaultDocId: string
  /** 自动使用当天日记时的笔记本 ID；留空表示第一个笔记本 */
  defaultBox: string
  /** 独立空间任务树所在文档 ID */
  spaceDocId: string
  /** 独立空间所在的笔记本 ID */
  spaceBox: string
  /** 默认视图 */
  defaultView: ViewId
  /** 默认展示形态 */
  defaultMode: ViewMode
  /** 默认分组方式 */
  defaultGroupBy: GroupBy
  /** 默认排序方式 */
  defaultSortBy: SortBy
  /** 重复任务勾选后自动推进到下一次（不标记为已完成） */
  repeatAdvance: boolean
  /** 「全部」时间视图里是否包含已完成/已归档 */
  showDone: boolean
  /** 关闭动效 */
  reduceMotion: boolean
}

export const DEFAULT_SETTINGS: PluginSettings = {
  defaultDocId: "",
  defaultBox: "",
  spaceDocId: "",
  spaceBox: "",
  defaultView: "today",
  defaultMode: "list",
  defaultGroupBy: "due",
  defaultSortBy: "priority",
  repeatAdvance: true,
  showDone: true,
  reduceMotion: false,
}
