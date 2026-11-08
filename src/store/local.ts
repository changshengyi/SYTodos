import { nowStamp, parseDate, parseRepeat } from "@/core/date"
import { normalizeTitle } from "@/core/task"
import { validateTaskForest } from "@/core/tree"
import type { ResolvedMove, Task, TaskChange, TaskDraft } from "@/core/types"
import { PRIORITIES, STATUSES } from "@/core/types"
import type { CreateResult, TaskRepository } from "@/data/repository"
import { cloneTasks, cloneTask } from "@/data/repository"
import type { StorageHost } from "@/data/storage"
import { isMissingStorageValue, loadPluginData, savePluginData } from "@/data/storage"

const MAIN_KEY = "sytodos-local-v2"
const BACKUP_KEY = "sytodos-local-backup"
const LEGACY_KEY = "blocktodo-local"

interface Archive {
  version: 2
  tasks: Task[]
}

function text(record: Record<string, unknown>, key: string, fallback = ""): string {
  const value = record[key]
  if (value === undefined || value === null) return fallback
  if (typeof value !== "string") throw new Error(`存档字段 ${key} 类型错误`)
  return value
}

function normalizeTask(input: unknown): Task {
  if (!input || typeof input !== "object") throw new Error("存档中存在无效任务")
  const record = input as Record<string, unknown>
  const id = text(record, "id")
  if (!id.startsWith("local-")) throw new Error(`无效本地任务 ID：${id}`)
  const status = text(record, "status", "todo") as Task["status"]
  if (!STATUSES.includes(status)) throw new Error(`任务 ${id} 的状态无效`)
  const priority = record.priority === undefined ? 3 : Number(record.priority)
  if (!PRIORITIES.includes(priority as Task["priority"])) throw new Error(`任务 ${id} 的优先级无效`)
  const sort = record.sort === undefined ? 0 : Number(record.sort)
  if (!Number.isFinite(sort)) throw new Error(`任务 ${id} 的排序值无效`)
  if (record.trashed !== undefined && typeof record.trashed !== "boolean") {
    throw new Error(`任务 ${id} 的回收站标记无效`)
  }
  const start = text(record, "start")
  const due = text(record, "due")
  const repeat = text(record, "repeat")
  if ((start && !parseDate(start)) || (due && !parseDate(due))) throw new Error(`任务 ${id} 的日期无效`)
  if (repeat && !parseRepeat(repeat)) throw new Error(`任务 ${id} 的重复规则无效`)
  if (start && due && (parseDate(start) as Date).getTime() > (parseDate(due) as Date).getTime()) {
    throw new Error(`任务 ${id} 的起始时间晚于截止时间`)
  }
  return {
    space: "local",
    id,
    parentId: text(record, "parentId"),
    containerId: "",
    rootId: "",
    box: "",
    hpath: "",
    title: text(record, "title"),
    status,
    priority: priority as Task["priority"],
    start,
    due,
    repeat,
    category: text(record, "category"),
    note: text(record, "note"),
    sort,
    trashed: record.trashed === true,
    created: text(record, "created"),
    updated: text(record, "updated"),
  }
}

function parseArchive(input: unknown): Archive {
  if (!input || typeof input !== "object") throw new Error("独立空间存档格式错误")
  const record = input as Record<string, unknown>
  if (record.version !== 1 && record.version !== 2) throw new Error("独立空间存档版本不受支持")
  if (!Array.isArray(record.tasks)) throw new Error("独立空间存档缺少任务列表")
  const tasks = record.tasks.map(normalizeTask)
  validateTaskForest(tasks, "local")
  return { version: 2, tasks }
}

function serialize(task: Task): Record<string, unknown> {
  return {
    id: task.id,
    parentId: task.parentId,
    title: task.title,
    status: task.status,
    priority: task.priority,
    start: task.start,
    due: task.due,
    repeat: task.repeat,
    category: task.category,
    note: task.note,
    sort: task.sort,
    trashed: task.trashed,
    created: task.created,
    updated: task.updated,
  }
}

function newId(index: Map<string, Task>): string {
  for (let attempt = 0; attempt < 10; attempt++) {
    const id = `local-${crypto.randomUUID()}`
    if (!index.has(id)) return id
  }
  throw new Error("无法生成唯一任务 ID")
}

export class LocalTaskRepository implements TaskRepository {
  readonly space = "local" as const
  private tasks = new Map<string, Task>()
  private lastSaved: Archive | undefined
  private loaded = false

  constructor(private readonly host: StorageHost) {}

  async load(): Promise<Task[]> {
    let main: unknown
    let mainError: unknown
    try {
      main = await loadPluginData(this.host, MAIN_KEY)
    } catch (error) {
      mainError = error
    }

    if (!isMissingStorageValue(main)) {
      try {
        return this.commitLoaded(parseArchive(main))
      } catch (error) {
        mainError = error
      }
    }

    try {
      const backup = await loadPluginData(this.host, BACKUP_KEY)
      if (!isMissingStorageValue(backup)) return this.commitLoaded(parseArchive(backup))
    } catch (error) {
      mainError ||= error
    }

    if (isMissingStorageValue(main)) {
      try {
        const legacy = await loadPluginData(this.host, LEGACY_KEY)
        if (!isMissingStorageValue(legacy)) return this.commitLoaded(parseArchive(legacy))
      } catch (error) {
        mainError ||= error
      }
    }
    if (mainError) throw mainError
    return this.commitLoaded({ version: 2, tasks: [] })
  }

  private commitLoaded(archive: Archive): Task[] {
    this.lastSaved = { version: 2, tasks: cloneTasks(archive.tasks) }
    this.tasks = new Map(archive.tasks.map((task) => [task.id, cloneTask(task)]))
    this.loaded = true
    return this.snapshot()
  }

  private snapshot(): Task[] {
    return cloneTasks(this.tasks.values())
  }

  private async persist(next: Map<string, Task>): Promise<void> {
    const nextTasks = cloneTasks(next.values())
    if (this.lastSaved) {
      await savePluginData(this.host, BACKUP_KEY, {
        version: 2,
        tasks: this.lastSaved.tasks.map((task) => serialize(task)),
      })
    }
    await savePluginData(this.host, MAIN_KEY, {
      version: 2,
      tasks: nextTasks.map((task) => serialize(task)),
    })
    this.lastSaved = { version: 2, tasks: nextTasks }
    this.tasks = new Map(nextTasks.map((task) => [task.id, cloneTask(task)]))
  }

  private assertLoaded(): void {
    if (!this.loaded) throw new Error("独立空间尚未加载")
  }

  async create(draft: TaskDraft): Promise<CreateResult> {
    this.assertLoaded()
    const next = new Map(this.tasks)
    const stamp = nowStamp()
    const task: Task = {
      ...draft,
      id: newId(next),
      title: normalizeTitle(draft.title),
      status: draft.status ?? "todo",
      priority: draft.priority ?? 3,
      start: draft.start ?? "",
      due: draft.due ?? "",
      repeat: draft.repeat ?? "",
      category: draft.category ?? "",
      note: draft.note ?? "",
      trashed: false,
      created: stamp,
      updated: stamp,
    }
    next.set(task.id, task)
    validateTaskForest(Array.from(next.values()), "local")
    await this.persist(next)
    return { created: cloneTask(task), snapshot: this.snapshot() }
  }

  async update(changes: TaskChange[]): Promise<Task[]> {
    this.assertLoaded()
    const next = new Map(this.tasks)
    for (const change of changes) {
      if (!next.has(change.after.id)) throw new Error(`任务不存在：${change.after.id}`)
      next.set(change.after.id, cloneTask(change.after))
    }
    validateTaskForest(Array.from(next.values()), "local")
    await this.persist(next)
    return this.snapshot()
  }

  async move(_task: Task, _target: ResolvedMove, _original: ResolvedMove, changes: TaskChange[]): Promise<Task[]> {
    return this.update(changes)
  }

  async delete(rootId: string): Promise<Task[]> {
    this.assertLoaded()
    if (!this.tasks.has(rootId)) throw new Error(`任务不存在：${rootId}`)
    const next = new Map(this.tasks)
    const visiting = new Set<string>()
    const remove = (id: string): void => {
      if (visiting.has(id)) throw new Error("任务树存在环，停止删除")
      visiting.add(id)
      for (const task of next.values()) {
        if (task.parentId === id) remove(task.id)
      }
      next.delete(id)
      visiting.delete(id)
    }
    remove(rootId)
    await this.persist(next)
    return this.snapshot()
  }
}

export function isLocalId(id: string): boolean {
  return id.startsWith("local-")
}
