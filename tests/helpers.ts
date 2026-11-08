import type { ResolvedMove, SpaceId, Task, TaskChange, TaskDraft } from "@/core/types"
import { validateTaskForest } from "@/core/tree"
import type { CreateResult, TaskRepository } from "@/data/repository"
import { cloneTask, cloneTasks } from "@/data/repository"
import type { StorageHost } from "@/data/storage"

export function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    space: "local",
    id: "local-task",
    parentId: "",
    containerId: "",
    rootId: "",
    box: "",
    hpath: "",
    title: "任务",
    status: "todo",
    priority: 2,
    start: "",
    due: "",
    repeat: "",
    category: "",
    note: "",
    sort: 1000,
    trashed: false,
    created: "20260101000000",
    updated: "20260101000000",
    ...overrides,
  }
}

export function makeDraft(overrides: Partial<TaskDraft> = {}): TaskDraft {
  return {
    space: "local",
    title: "新任务",
    parentId: "",
    containerId: "",
    rootId: "",
    box: "",
    hpath: "",
    sort: 1000,
    trashed: false,
    status: "todo",
    priority: 2,
    start: "",
    due: "",
    repeat: "",
    category: "",
    note: "",
    ...overrides,
  }
}

export class MemoryStorage implements StorageHost {
  readonly data = new Map<string, unknown>()
  failCode = 0
  failThrow = false
  saves: string[] = []

  async loadData(key: string): Promise<unknown> {
    return structuredClone(this.data.get(key) ?? null)
  }

  async saveData(key: string, value: unknown): Promise<{ code: number; msg: string }> {
    this.saves.push(key)
    if (this.failThrow) throw new Error("模拟磁盘错误")
    if (this.failCode) return { code: this.failCode, msg: "模拟内核保存失败" }
    this.data.set(key, structuredClone(value))
    return { code: 0, msg: "" }
  }
}

export class MemoryRepository implements TaskRepository {
  tasks: Task[]
  delay = 0
  private sequence = 0

  constructor(readonly space: SpaceId, initial: Task[] = []) {
    this.tasks = cloneTasks(initial)
  }

  private async wait(): Promise<void> {
    if (this.delay) await new Promise((resolve) => setTimeout(resolve, this.delay))
  }

  async load(): Promise<Task[]> {
    await this.wait()
    return cloneTasks(this.tasks)
  }

  async create(draft: TaskDraft): Promise<CreateResult> {
    await this.wait()
    const created: Task = {
      ...makeTask(),
      ...draft,
      id: `${this.space}-created-${++this.sequence}`,
      created: "20260101000000",
      updated: "20260101000000",
    } as Task
    this.tasks.push(created)
    return { created: cloneTask(created), snapshot: cloneTasks(this.tasks) }
  }

  async update(changes: TaskChange[]): Promise<Task[]> {
    await this.wait()
    for (const change of changes) {
      const at = this.tasks.findIndex((task) => task.id === change.after.id)
      if (at < 0) throw new Error("任务不存在")
      this.tasks[at] = cloneTask(change.after)
    }
    validateTaskForest(this.tasks)
    return cloneTasks(this.tasks)
  }

  async move(_task: Task, target: ResolvedMove, _original: ResolvedMove, changes: TaskChange[]): Promise<Task[]> {
    await this.update(changes)
    const moved = this.tasks.find((task) => task.id === _task.id)
    if (moved) {
      moved.parentId = target.parentId
      moved.rootId = target.rootId
      moved.containerId = target.containerId
    }
    return cloneTasks(this.tasks)
  }

  async delete(rootId: string): Promise<Task[]> {
    await this.wait()
    const ids = new Set([rootId])
    let changed = true
    while (changed) {
      changed = false
      for (const task of this.tasks) {
        if (task.parentId && ids.has(task.parentId) && !ids.has(task.id)) {
          ids.add(task.id)
          changed = true
        }
      }
    }
    this.tasks = this.tasks.filter((task) => !ids.has(task.id))
    return cloneTasks(this.tasks)
  }
}
