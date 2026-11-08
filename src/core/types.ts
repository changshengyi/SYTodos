export type SpaceId = "siyuan" | "local"
export type Priority = 0 | 1 | 2 | 3
export type TaskStatus = "todo" | "doing" | "done" | "archived"
export type ViewId = "today" | "week" | "all" | "trash"
export type ViewMode = "list" | "tree" | "board"
export type DueFilter = "any" | "overdue" | "today" | "week" | "none"
export type GroupBy = "none" | "due" | "priority" | "category" | "doc"
export type SortBy = "manual" | "due" | "priority" | "created" | "title"

export const SPACES: SpaceId[] = ["siyuan", "local"]
export const PRIORITIES: Priority[] = [0, 1, 2, 3]
export const STATUSES: TaskStatus[] = ["todo", "doing", "done", "archived"]

export interface Task {
  space: SpaceId
  id: string
  /** 最近的父任务 ID；根任务为空。 */
  parentId: string
  /** 思源列表容器 ID。排序和移动必须以它为兄弟作用域。 */
  containerId: string
  rootId: string
  box: string
  hpath: string
  title: string
  status: TaskStatus
  priority: Priority
  start: string
  due: string
  repeat: string
  category: string
  note: string
  sort: number
  trashed: boolean
  created: string
  updated: string
}

export type EditableTaskField =
  | "title"
  | "status"
  | "priority"
  | "start"
  | "due"
  | "repeat"
  | "category"
  | "note"
  | "sort"
  | "trashed"

export type TaskPatch = Partial<Pick<Task, EditableTaskField>>

export interface CreateTaskInput extends TaskPatch {
  space: SpaceId
  title: string
  parentId?: string
  docId?: string
}

export interface TaskDraft extends TaskPatch {
  space: SpaceId
  title: string
  parentId: string
  containerId: string
  rootId: string
  box: string
  hpath: string
  sort: number
  trashed: boolean
}

export interface MoveTaskInput {
  parentId: string
  /** 根任务跨文档移动时必须指定目标文档。 */
  docId?: string
  /** 根任务在同一文档有多个列表时，用它消除排序歧义。 */
  containerId?: string
  position: "first" | "last" | "before" | "after"
  anchorId?: string
}

export interface ResolvedMove {
  parentId: string
  rootId: string
  containerId: string
  previousId: string
}

export interface TaskChange {
  before: Task
  after: Task
}

export type Row =
  | { kind: "group"; key: string; label: string; count: number }
  | {
      kind: "task"
      key: string
      id: string
      depth: number
      hasChildren: boolean
      collapsed: boolean
      muted: boolean
    }

export interface Group {
  key: string
  label: string
  count: number
  ids: string[]
}

export interface PluginSettings {
  defaultSpace: SpaceId
  defaultDocId: string
  defaultBox: string
  defaultView: ViewId
  defaultMode: ViewMode
  defaultGroupBy: GroupBy
  defaultSortBy: SortBy
  repeatAdvance: boolean
  showDone: boolean
  reduceMotion: boolean
}

export const DEFAULT_SETTINGS: PluginSettings = {
  defaultSpace: "siyuan",
  defaultDocId: "",
  defaultBox: "",
  defaultView: "all",
  defaultMode: "list",
  defaultGroupBy: "none",
  defaultSortBy: "manual",
  repeatAdvance: true,
  showDone: true,
  reduceMotion: false,
}
