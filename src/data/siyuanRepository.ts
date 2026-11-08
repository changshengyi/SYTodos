import * as kernel from "@/api/kernel"
import { nowStamp } from "@/core/date"
import {
  buildTaskMarkdown,
  diffTaskAttrs,
  rewriteTaskKramdown,
  rowToTask,
  taskToAttrs,
} from "@/core/task"
import type { TaskBlockRow } from "@/core/task"
import { validateTaskForest } from "@/core/tree"
import type { ResolvedMove, Task, TaskChange, TaskDraft } from "@/core/types"
import type { CreateResult, TaskRepository } from "./repository"

export interface SiyuanKernel {
  fetchTaskRows(): Promise<{ rows: TaskBlockRow[]; hasIal: boolean }>
  fetchRowsByIds(ids: string[]): Promise<{ rows: TaskBlockRow[]; hasIal: boolean }>
  findTaskIdsByToken(token: string): Promise<string[]>
  getBlockAttrs(id: string): Promise<Record<string, string>>
  getBlockKramdown(id: string): Promise<string>
  updateBlock(id: string, markdown: string): Promise<unknown>
  setBlockAttrs(id: string, attrs: Record<string, string>): Promise<null>
  appendBlock(parentId: string, markdown: string): Promise<unknown>
  insertBlock(previousId: string, markdown: string): Promise<unknown>
  moveBlock(id: string, previousId: string, parentId: string): Promise<unknown>
  deleteBlock(id: string): Promise<unknown>
  flushTransaction(): Promise<null>
}

interface WriteAttempt {
  change: TaskChange
  oldKramdown?: string
  contentAttempted: boolean
  attrsAttempted: boolean
}

const PERSISTED_FIELDS = [
  "title",
  "status",
  "priority",
  "start",
  "due",
  "repeat",
  "category",
  "note",
  "sort",
  "trashed",
] as const

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function token(): string {
  return `sytodos-${crypto.randomUUID()}`
}

function assertSamePersisted(expected: Task, actual: Task): void {
  for (const field of PERSISTED_FIELDS) {
    if (expected[field] !== actual[field]) {
      throw new Error(`任务 ${expected.id} 的 ${field} 写入后回读不一致`)
    }
  }
}

export class SiyuanTaskRepository implements TaskRepository {
  readonly space = "siyuan" as const

  constructor(private readonly api: SiyuanKernel = kernel) {}

  private async hydrate(rows: TaskBlockRow[], hasIal: boolean): Promise<Task[]> {
    const tasks: Task[] = []
    if (hasIal) {
      for (const row of rows) tasks.push(rowToTask(row))
    } else {
      let cursor = 0
      const worker = async (): Promise<void> => {
        while (cursor < rows.length) {
          const row = rows[cursor++]
          tasks.push(rowToTask(row, await this.api.getBlockAttrs(row.id)))
        }
      }
      await Promise.all(Array.from({ length: Math.min(8, rows.length) }, worker))
    }
    validateTaskForest(tasks, "siyuan")
    return tasks
  }

  async load(): Promise<Task[]> {
    const { rows, hasIal } = await this.api.fetchTaskRows()
    return this.hydrate(rows, hasIal)
  }

  private async rollback(attempts: WriteAttempt[]): Promise<string[]> {
    const errors: string[] = []
    for (const attempt of attempts.slice().reverse()) {
      try {
        if (attempt.oldKramdown !== undefined) {
          await this.api.updateBlock(attempt.change.before.id, attempt.oldKramdown)
        }
        if (attempt.attrsAttempted) {
          await this.api.setBlockAttrs(attempt.change.before.id, taskToAttrs(attempt.change.before))
        }
      } catch (error) {
        errors.push(`${attempt.change.before.id}: ${message(error)}`)
      }
    }
    return errors
  }

  private async applyChanges(changes: TaskChange[]): Promise<WriteAttempt[]> {
    const attempts: WriteAttempt[] = []
    try {
      for (const change of changes) {
        const attempt: WriteAttempt = { change, contentAttempted: false, attrsAttempted: false }
        attempts.push(attempt)
        const titleChanged = change.before.title !== change.after.title
        const doneChanged = (change.before.status === "done") !== (change.after.status === "done")
        if (titleChanged || doneChanged) {
          attempt.oldKramdown = await this.api.getBlockKramdown(change.before.id)
          const nextSource = rewriteTaskKramdown(
            attempt.oldKramdown,
            change.after.title,
            change.after.status === "done",
            titleChanged,
          )
          attempt.contentAttempted = true
          await this.api.updateBlock(change.before.id, nextSource)
        }
        const attrs = diffTaskAttrs(change.before, change.after)
        if (Object.keys(attrs).length) {
          attempt.attrsAttempted = true
          await this.api.setBlockAttrs(change.before.id, attrs)
        }
      }
      return attempts
    } catch (error) {
      const rollbackErrors = await this.rollback(attempts)
      await this.api.flushTransaction().catch(() => null)
      throw new Error(`${message(error)}${rollbackErrors.length ? `；回滚失败：${rollbackErrors.join("；")}` : ""}`)
    }
  }

  async update(changes: TaskChange[]): Promise<Task[]> {
    if (!changes.length) return this.load()
    const attempts = await this.applyChanges(changes)
    await this.api.flushTransaction()
    const snapshot = await this.load()
    const index = new Map(snapshot.map((task) => [task.id, task]))
    try {
      for (const change of changes) {
        const actual = index.get(change.after.id)
        if (!actual) throw new Error(`任务 ${change.after.id} 写入后不存在`)
        assertSamePersisted(change.after, actual)
      }
      return snapshot
    } catch (error) {
      const rollbackErrors = await this.rollback(attempts)
      await this.api.flushTransaction().catch(() => null)
      throw new Error(`${message(error)}${rollbackErrors.length ? `；回滚失败：${rollbackErrors.join("；")}` : ""}`)
    }
  }

  /** 用唯一临时标题和冲刷后的索引定位新块，避免误用列表容器或旧块 ID。 */
  private async createRaw(marker: string, done: boolean, previousId: string, parentId: string): Promise<string> {
    let requestError: unknown
    try {
      if (previousId) await this.api.insertBlock(previousId, buildTaskMarkdown(marker, done))
      else await this.api.appendBlock(parentId, buildTaskMarkdown(marker, done))
    } catch (error) {
      requestError = error
    }
    await this.api.flushTransaction()
    const ids = await this.api.findTaskIdsByToken(marker)
    if (ids.length !== 1) {
      if (requestError) throw requestError
      throw new Error(ids.length ? "新任务定位不唯一，已停止写入" : "新任务未进入块索引，已停止写入")
    }
    return ids[0]
  }

  async create(draft: TaskDraft, previousId: string): Promise<CreateResult> {
    const parentOrDoc = draft.parentId || draft.rootId
    if (!parentOrDoc) throw new Error("缺少新任务的目标文档或父任务")
    const marker = token()
    let id = ""
    try {
      id = await this.createRaw(marker, draft.status === "done", previousId, parentOrDoc)
      const stamp = nowStamp()
      const expected: Task = {
        ...draft,
        id,
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
      await this.api.updateBlock(id, buildTaskMarkdown(draft.title, draft.status === "done"))
      await this.api.setBlockAttrs(id, taskToAttrs(expected))
      await this.api.flushTransaction()
      const snapshot = await this.load()
      const created = snapshot.find((task) => task.id === id)
      if (!created) throw new Error("新任务写入后回读不存在")
      if (created.parentId !== draft.parentId || created.rootId !== draft.rootId) {
        throw new Error("新任务的父任务或所属文档回读不一致")
      }
      assertSamePersisted(expected, created)
      return { created, snapshot }
    } catch (error) {
      let cleanupError = ""
      try {
        if (!id) {
          await this.api.flushTransaction()
          const candidates = await this.api.findTaskIdsByToken(marker)
          if (candidates.length === 1) id = candidates[0]
        }
        if (id) {
          await this.api.deleteBlock(id)
          await this.api.flushTransaction()
        }
      } catch (cleanup) {
        cleanupError = `；失败块清理未完成：${message(cleanup)}`
      }
      throw new Error(`${message(error)}${cleanupError}`)
    }
  }

  private async createListPlaceholder(parentId: string): Promise<{ id: string; containerId: string }> {
    const id = await this.createRaw(token(), false, "", parentId)
    try {
      const { rows } = await this.api.fetchRowsByIds([id])
      const containerId = rows[0]?.parent_id ?? ""
      if (!containerId) throw new Error("无法确定目标列表容器")
      return { id, containerId }
    } catch (error) {
      await this.api.deleteBlock(id).catch(() => null)
      await this.api.flushTransaction().catch(() => null)
      throw error
    }
  }

  async move(task: Task, target: ResolvedMove, original: ResolvedMove, changes: TaskChange[]): Promise<Task[]> {
    const effective = { ...target }
    let placeholderId = ""
    try {
      if (!effective.previousId && !effective.containerId) {
        const placeholder = await this.createListPlaceholder(effective.parentId || effective.rootId)
        placeholderId = placeholder.id
        effective.containerId = placeholder.containerId
      }
      await this.api.moveBlock(task.id, effective.previousId, effective.containerId)
      if (placeholderId) {
        await this.api.deleteBlock(placeholderId)
        placeholderId = ""
      }
      if (!changes.length) await this.api.flushTransaction()
      const snapshot = changes.length ? await this.update(changes) : await this.load()
      const moved = snapshot.find((item) => item.id === task.id)
      if (!moved || moved.parentId !== target.parentId || moved.rootId !== target.rootId) {
        throw new Error("移动后的父任务或文档回读不一致")
      }
      if (moved.containerId !== effective.containerId) {
        throw new Error("移动后的列表容器回读不一致")
      }
      return snapshot
    } catch (error) {
      const recoveryErrors: string[] = []
      if (placeholderId) {
        try {
          await this.api.deleteBlock(placeholderId)
        } catch (cleanup) {
          recoveryErrors.push(message(cleanup))
        }
      }
      try {
        await this.api.moveBlock(task.id, original.previousId, original.containerId || original.rootId)
        await this.api.flushTransaction()
      } catch (rollback) {
        recoveryErrors.push(message(rollback))
      }
      throw new Error(`${message(error)}${recoveryErrors.length ? `；位置回滚失败：${recoveryErrors.join("；")}` : ""}`)
    }
  }

  async delete(rootId: string): Promise<Task[]> {
    await this.api.deleteBlock(rootId)
    await this.api.flushTransaction()
    return this.load()
  }
}
