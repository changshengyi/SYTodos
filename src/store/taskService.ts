import { nextOccurrence, nowStamp, parseDate, parseRepeat, today } from "@/core/date"
import { normalizeTitle } from "@/core/task"
import {
  collectAncestors,
  collectDescendants,
  isSelfOrDescendant,
  manualCompare,
  siblingKey,
  subtreeIds,
} from "@/core/tree"
import type {
  CreateTaskInput,
  MoveTaskInput,
  ResolvedMove,
  SpaceId,
  Task,
  TaskChange,
  TaskDraft,
  TaskPatch,
} from "@/core/types"
import { PRIORITIES, SPACES, STATUSES } from "@/core/types"
import type { TaskRepository } from "@/data/repository"
import { cloneTask, cloneTasks } from "@/data/repository"

export interface TaskServiceState {
  tasks: Map<string, Task>
  loaded: boolean
  loading: boolean
  busy: number
  error: string
  errors: Record<SpaceId, string>
  version: number
  undoDepth: number
  redoDepth: number
}

export function createTaskServiceState(): TaskServiceState {
  return {
    tasks: new Map(),
    loaded: false,
    loading: false,
    busy: 0,
    error: "",
    errors: { siyuan: "", local: "" },
    version: 0,
    undoDepth: 0,
    redoDepth: 0,
  }
}

interface HistoryEntry {
  undo(): Promise<boolean>
  redo(): Promise<boolean>
}

interface ServiceOptions {
  resolveDefaultDoc(): Promise<string>
  shouldAdvanceRepeat(): boolean
  notify(message: string): void | Promise<void>
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export class TaskService {
  private tail: Promise<void> = Promise.resolve()
  private readonly undoStack: HistoryEntry[] = []
  private readonly redoStack: HistoryEntry[] = []
  private historyPaused = 0
  private historyBusy = false

  constructor(
    private readonly repositories: Record<SpaceId, TaskRepository>,
    readonly state: TaskServiceState,
    private readonly options: ServiceOptions,
  ) {}

  private enqueue<T>(work: () => Promise<T>): Promise<T | undefined> {
    const run = this.tail.then(async () => {
      this.state.busy++
      this.state.error = ""
      try {
        return await work()
      } catch (error) {
        this.state.error = errorMessage(error)
        try {
          await this.options.notify(this.state.error)
        } catch {
          // 通知失败不影响已确定的操作结果。
        }
        return undefined
      } finally {
        this.state.busy = Math.max(0, this.state.busy - 1)
        this.state.version++
      }
    })
    this.tail = run.then(() => undefined, () => undefined)
    return run
  }

  async flush(): Promise<void> {
    await this.tail
  }

  private replaceSpace(space: SpaceId, tasks: Task[]): void {
    for (const [id, task] of this.state.tasks) {
      if (task.space === space) this.state.tasks.delete(id)
    }
    for (const task of tasks) this.state.tasks.set(task.id, cloneTask(task))
    this.state.errors[space] = ""
    this.state.version++
  }

  refresh(): Promise<boolean> {
    return this.enqueue(async () => {
      this.state.loading = true
      const failures: string[] = []
      try {
        for (const space of SPACES) {
          try {
            const snapshot = await this.repositories[space].load()
            this.replaceSpace(space, snapshot)
          } catch (error) {
            this.state.errors[space] = errorMessage(error)
            failures.push(`${space}: ${this.state.errors[space]}`)
          }
        }
        this.state.loaded = true
        if (failures.length) throw new Error(`读取待办失败：${failures.join("；")}`)
        return true
      } finally {
        this.state.loading = false
      }
    }).then((result) => result === true)
  }

  private normalizePatch(current: Task | undefined, patch: TaskPatch): TaskPatch {
    const result: TaskPatch = { ...patch }
    if (result.title !== undefined) {
      result.title = normalizeTitle(result.title)
      if (!result.title) throw new Error("任务标题不能为空")
    }
    if (result.status !== undefined && !STATUSES.includes(result.status)) throw new Error("任务状态无效")
    if (result.priority !== undefined && !PRIORITIES.includes(result.priority)) throw new Error("任务优先级无效")
    if (result.sort !== undefined && !Number.isFinite(result.sort)) throw new Error("任务排序值无效")
    for (const field of ["start", "due"] as const) {
      const value = result[field]
      if (value !== undefined && value && !parseDate(value)) throw new Error(`${field === "due" ? "截止" : "起始"}时间无效`)
    }
    if (result.repeat && !parseRepeat(result.repeat)) throw new Error("重复规则无效")
    const start = result.start ?? current?.start ?? ""
    const due = result.due ?? current?.due ?? ""
    if (start && due && parseDate(start) && parseDate(due)) {
      if ((parseDate(start) as Date).getTime() > (parseDate(due) as Date).getTime()) {
        throw new Error("起始时间不能晚于截止时间")
      }
    }
    return result
  }

  private record(entry: HistoryEntry): void {
    if (this.historyPaused) return
    this.undoStack.push(entry)
    if (this.undoStack.length > 50) this.undoStack.shift()
    this.redoStack.length = 0
    this.syncHistoryState()
  }

  private syncHistoryState(): void {
    this.state.undoDepth = this.undoStack.length
    this.state.redoDepth = this.redoStack.length
  }

  private restoreSnapshots(snapshots: Task[]): Promise<boolean> {
    return this.enqueue(async () => {
      const changes: TaskChange[] = snapshots.map((snapshot) => {
        const current = this.state.tasks.get(snapshot.id)
        if (!current) throw new Error(`无法恢复已不存在的任务：${snapshot.title || snapshot.id}`)
        return { before: cloneTask(current), after: { ...cloneTask(snapshot), updated: nowStamp() } }
      })
      const bySpace = new Map<SpaceId, TaskChange[]>()
      for (const change of changes) {
        const bucket = bySpace.get(change.after.space) ?? []
        bucket.push(change)
        bySpace.set(change.after.space, bucket)
      }
      for (const [space, spaceChanges] of bySpace) {
        this.replaceSpace(space, await this.repositories[space].update(spaceChanges))
      }
      return true
    }).then((result) => result === true)
  }

  private recordUpdate(changes: TaskChange[]): void {
    const before = changes.map((change) => cloneTask(change.before))
    const after = changes.map((change) => cloneTask(change.after))
    this.record({
      undo: () => this.restoreSnapshots(before),
      redo: () => this.restoreSnapshots(after),
    })
  }

  private async applyPatches(patches: Map<string, TaskPatch>, recordHistory = true): Promise<boolean> {
    const changes: TaskChange[] = []
    for (const [id, rawPatch] of patches) {
      const current = this.state.tasks.get(id)
      if (!current) throw new Error(`任务不存在：${id}`)
      const patch = this.normalizePatch(current, rawPatch)
      const changed = (Object.keys(patch) as (keyof TaskPatch)[]).some(
        (key) => patch[key] !== undefined && current[key] !== patch[key],
      )
      if (!changed) continue
      const after: Task = { ...current, ...patch, updated: nowStamp() }
      changes.push({ before: cloneTask(current), after })
    }
    if (!changes.length) return true
    const bySpace = new Map<SpaceId, TaskChange[]>()
    for (const change of changes) {
      const bucket = bySpace.get(change.after.space) ?? []
      bucket.push(change)
      bySpace.set(change.after.space, bucket)
    }
    for (const [space, spaceChanges] of bySpace) {
      this.replaceSpace(space, await this.repositories[space].update(spaceChanges))
    }
    if (recordHistory) this.recordUpdate(changes)
    return true
  }

  updateTask(id: string, patch: TaskPatch): Promise<boolean> {
    return this.enqueue(() => this.applyPatches(new Map([[id, patch]]))).then((result) => result === true)
  }

  toggleDone(id: string): Promise<boolean> {
    return this.enqueue(async () => {
      const task = this.state.tasks.get(id)
      if (!task) throw new Error("任务不存在")
      const completing = task.status !== "done"
      if (completing && task.repeat && this.options.shouldAdvanceRepeat()) {
        return this.applyPatches(
          new Map([[id, { due: nextOccurrence(task.due || today(), task.repeat), status: "todo" }]]),
        )
      }
      const patches = new Map<string, TaskPatch>([[id, { status: completing ? "done" : "todo" }]])
      if (completing) {
        for (const child of collectDescendants(id, this.state.tasks)) {
          if (child.status !== "done" && child.status !== "archived") patches.set(child.id, { status: "done" })
        }
      } else {
        for (const parent of collectAncestors(id, this.state.tasks)) {
          if (parent.status === "done") patches.set(parent.id, { status: "todo" })
        }
      }
      return this.applyPatches(patches)
    }).then((result) => result === true)
  }

  setTrashed(id: string, trashed: boolean): Promise<boolean> {
    return this.enqueue(() => {
      if (!this.state.tasks.has(id)) throw new Error("任务不存在")
      const patches = new Map<string, TaskPatch>()
      for (const taskId of subtreeIds(id, this.state.tasks)) patches.set(taskId, { trashed })
      return this.applyPatches(patches)
    }).then((result) => result === true)
  }

  deleteTask(id: string): Promise<boolean> {
    return this.enqueue(async () => {
      const task = this.state.tasks.get(id)
      if (!task) throw new Error("任务不存在")
      this.replaceSpace(task.space, await this.repositories[task.space].delete(id))
      return true
    }).then((result) => result === true)
  }

  emptyTrash(space: SpaceId): Promise<boolean> {
    return this.enqueue(async () => {
      const roots = Array.from(this.state.tasks.values()).filter((task) => {
        if (task.space !== space || !task.trashed) return false
        return !task.parentId || !this.state.tasks.get(task.parentId)?.trashed
      })
      for (const root of roots) this.replaceSpace(space, await this.repositories[space].delete(root.id))
      return true
    }).then((result) => result === true)
  }

  private createSiblings(space: SpaceId, parentId: string, rootId: string): Task[] {
    return Array.from(this.state.tasks.values())
      .filter((task) => task.space === space && task.parentId === parentId && task.rootId === rootId && !task.trashed)
      .sort(manualCompare)
  }

  createTask(input: CreateTaskInput): Promise<Task | undefined> {
    return this.enqueue(async () => {
      const title = normalizeTitle(input.title)
      if (!title) throw new Error("任务标题不能为空")
      const parent = input.parentId ? this.state.tasks.get(input.parentId) : undefined
      if (input.parentId && !parent) throw new Error("父任务不存在")
      if (parent && (parent.space !== input.space || parent.trashed)) throw new Error("父任务与当前空间或回收站状态不一致")
      const rootId = input.space === "local" ? "" : parent?.rootId || input.docId || (await this.options.resolveDefaultDoc())
      if (input.space === "siyuan" && !rootId) throw new Error("缺少目标文档")
      const siblings = this.createSiblings(input.space, parent?.id ?? "", rootId)
      const previous = siblings[siblings.length - 1]
      const draft: TaskDraft = {
        space: input.space,
        title,
        parentId: parent?.id ?? "",
        containerId: "",
        rootId,
        box: parent?.box ?? "",
        hpath: parent?.hpath ?? "",
        status: input.status ?? "todo",
        priority: input.priority ?? 3,
        start: input.start ?? "",
        due: input.due ?? "",
        repeat: input.repeat ?? "",
        category: input.category?.trim() ?? "",
        note: input.note ?? "",
        sort: previous ? previous.sort + 1000 : 1000,
        trashed: false,
      }
      this.normalizePatch(undefined, draft)
      const { created, snapshot } = await this.repositories[input.space].create(draft, previous?.id ?? "")
      this.replaceSpace(input.space, snapshot)
      let createdId = created.id
      const redoInput: CreateTaskInput = { ...input, title }
      this.record({
        undo: () => this.deleteTask(createdId),
        redo: async () => {
          const recreated = await this.createTask(redoInput)
          if (!recreated) return false
          createdId = recreated.id
          return true
        },
      })
      return created
    })
  }

  private targetSiblings(task: Task, parentId: string, rootId: string, containerId: string): Task[] {
    return Array.from(this.state.tasks.values())
      .filter((candidate) => {
        if (candidate.id === task.id || candidate.space !== task.space || candidate.trashed !== task.trashed) return false
        if (candidate.parentId !== parentId || candidate.rootId !== rootId) return false
        return task.space === "local" || !containerId || candidate.containerId === containerId
      })
      .sort(manualCompare)
  }

  private resolvedRequest(resolved: ResolvedMove): MoveTaskInput {
    return {
      parentId: resolved.parentId,
      docId: resolved.rootId,
      containerId: resolved.containerId,
      position: resolved.previousId ? "after" : "first",
      anchorId: resolved.previousId || undefined,
    }
  }

  moveTask(id: string, input: MoveTaskInput): Promise<boolean> {
    return this.enqueue(async () => {
      const task = this.state.tasks.get(id)
      if (!task) throw new Error("任务不存在")
      const parent = input.parentId ? this.state.tasks.get(input.parentId) : undefined
      if (input.parentId && !parent) throw new Error("目标父任务不存在")
      if (parent) {
        if (parent.space !== task.space || parent.trashed !== task.trashed) throw new Error("不能移动到其他空间或回收站之外")
        if (isSelfOrDescendant(parent.id, task.id, this.state.tasks)) throw new Error("不能把任务移动到自己或自己的子任务下")
      }
      const rootId = task.space === "local" ? "" : parent?.rootId || input.docId || task.rootId
      let containerId = task.space === "local" ? "" : parent ? "" : input.containerId || ""
      let anchor: Task | undefined
      if (input.position === "before" || input.position === "after") {
        anchor = input.anchorId ? this.state.tasks.get(input.anchorId) : undefined
        if (!anchor || anchor.id === task.id) throw new Error("拖拽锚点无效")
        if (anchor.space !== task.space || anchor.parentId !== input.parentId || anchor.rootId !== rootId) {
          throw new Error("拖拽锚点不属于目标层级")
        }
        if (anchor.trashed !== task.trashed) throw new Error("不能跨回收站移动")
        containerId = anchor.containerId
      }
      let siblings = this.targetSiblings(task, input.parentId, rootId, containerId)
      if (!containerId && siblings.length && task.space === "siyuan") containerId = siblings[0].containerId
      if (!containerId && task.space === "siyuan" && !input.parentId && !task.parentId && rootId === task.rootId) {
        containerId = task.containerId
      }
      siblings = this.targetSiblings(task, input.parentId, rootId, containerId)

      let insertAt = siblings.length
      let previousId = siblings[siblings.length - 1]?.id ?? ""
      if (input.position === "first") {
        insertAt = 0
        previousId = ""
      } else if (anchor) {
        const anchorAt = siblings.findIndex((item) => item.id === anchor?.id)
        if (anchorAt < 0) throw new Error("拖拽锚点不在目标兄弟列表中")
        insertAt = input.position === "before" ? anchorAt : anchorAt + 1
        previousId = input.position === "after" ? anchor.id : siblings[anchorAt - 1]?.id ?? ""
      }

      const originalSiblings = this.targetSiblings(task, task.parentId, task.rootId, task.containerId)
      const originalAt = originalSiblings.findIndex((item) => manualCompare(item, task) > 0)
      const originalPrevious = originalAt > 0 ? originalSiblings[originalAt - 1] : originalSiblings[originalSiblings.length - 1]
      const original: ResolvedMove = {
        parentId: task.parentId,
        rootId: task.rootId,
        containerId: task.containerId,
        previousId: originalPrevious?.id ?? "",
      }
      const target: ResolvedMove = { parentId: input.parentId, rootId, containerId, previousId }
      const ordered = siblings.slice()
      ordered.splice(insertAt, 0, task)
      const affectedBefore = new Map<string, Task>()
      for (const item of [...originalSiblings, ...siblings, task]) affectedBefore.set(item.id, cloneTask(item))
      const changes: TaskChange[] = ordered.map((item, index) => {
        const before = item.id === task.id ? task : item
        const after: Task = {
          ...before,
          parentId: item.id === task.id ? input.parentId : before.parentId,
          rootId: item.id === task.id ? rootId : before.rootId,
          containerId: item.id === task.id ? containerId : before.containerId,
          sort: (index + 1) * 1000,
          updated: nowStamp(),
        }
        return { before: cloneTask(before), after }
      })
      const unchanged = changes.every(
        (change) =>
          change.before.parentId === change.after.parentId &&
          change.before.rootId === change.after.rootId &&
          change.before.containerId === change.after.containerId &&
          change.before.sort === change.after.sort,
      )
      if (unchanged) return true
      const snapshot = await this.repositories[task.space].move(task, target, original, changes)
      this.replaceSpace(task.space, snapshot)
      const beforeSnapshots = Array.from(affectedBefore.values(), cloneTask)
      const afterSnapshots = changes.map((change) => cloneTask(change.after))
      const undoRequest = this.resolvedRequest(original)
      const redoRequest = this.resolvedRequest(target)
      this.record({
        undo: async () => {
          if (!(await this.moveTask(id, undoRequest))) return false
          return this.restoreSnapshots(beforeSnapshots.filter((item) => this.state.tasks.has(item.id)))
        },
        redo: async () => {
          if (!(await this.moveTask(id, redoRequest))) return false
          return this.restoreSnapshots(afterSnapshots.filter((item) => this.state.tasks.has(item.id)))
        },
      })
      return true
    }).then((result) => result === true)
  }

  indentTask(id: string): Promise<boolean> {
    const task = this.state.tasks.get(id)
    if (!task) return Promise.resolve(false)
    const siblings = Array.from(this.state.tasks.values())
      .filter((item) => siblingKey(item) === siblingKey(task) && item.trashed === task.trashed)
      .sort(manualCompare)
    const at = siblings.findIndex((item) => item.id === id)
    if (at <= 0) return Promise.resolve(false)
    return this.moveTask(id, { parentId: siblings[at - 1].id, position: "last" })
  }

  outdentTask(id: string): Promise<boolean> {
    const task = this.state.tasks.get(id)
    if (!task?.parentId) return Promise.resolve(false)
    const parent = this.state.tasks.get(task.parentId)
    if (!parent) return Promise.resolve(false)
    return this.moveTask(id, {
      parentId: parent.parentId,
      docId: parent.rootId,
      containerId: parent.containerId,
      position: "after",
      anchorId: parent.id,
    })
  }

  private async runHistory(direction: "undo" | "redo"): Promise<boolean> {
    if (this.historyBusy) return false
    const source = direction === "undo" ? this.undoStack : this.redoStack
    const target = direction === "undo" ? this.redoStack : this.undoStack
    const entry = source.pop()
    this.syncHistoryState()
    if (!entry) return false
    this.historyBusy = true
    this.historyPaused++
    try {
      const ok = await entry[direction]()
      if (ok) target.push(entry)
      else source.push(entry)
      this.syncHistoryState()
      return ok
    } finally {
      this.historyPaused--
      this.historyBusy = false
      this.syncHistoryState()
    }
  }

  undo(): Promise<boolean> {
    return this.runHistory("undo")
  }

  redo(): Promise<boolean> {
    return this.runHistory("redo")
  }

  snapshot(space?: SpaceId): Task[] {
    return cloneTasks(Array.from(this.state.tasks.values()).filter((task) => !space || task.space === space))
  }
}
