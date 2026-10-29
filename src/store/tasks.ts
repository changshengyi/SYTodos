import { reactive } from "vue"

import * as kernel from "@/api/kernel"
import type { TaskBlockRow } from "@/api/kernel"
import { nextOccurrence, today } from "@/core/date"
import { collectAncestors, collectDescendants } from "@/core/filter"
import { ATTR, buildMarkdown, rowToTask, toAttrPriority } from "@/core/task"
import type { Priority, Task } from "@/core/types"
import { pushUndo } from "@/store/undo"

import { t } from "./i18n"
import { settings } from "./settings"

/** 待办索引。事实源是思源笔记里的任务列表块，这里只是随时可重建的内存投影。 */
export const taskState = reactive({
  tasks: new Map<string, Task>(),
  loading: false,
  loaded: false,
  error: "" as string,
  /** 每次数据变化自增，用于让依赖方快速失效缓存 */
  version: 0,
})

export function taskIndex(): Map<string, Task> {
  return taskState.tasks
}

export function listTasks(): Task[] {
  return Array.from(taskState.tasks.values())
}

export function bumpVersion(): void {
  taskState.version++
}

/* ------------------------------------------------------------------ *
 * 读取
 * ------------------------------------------------------------------ */

let dailyNoteCache: { key: string; id: string } | undefined

/** 并发受控地补齐旧内核缺失的属性 */
async function hydrate(rows: TaskBlockRow[], hasIal: boolean): Promise<void> {
  if (hasIal) {
    for (const row of rows) {
      taskState.tasks.set(row.id, rowToTask(row))
    }
    return
  }

  const limit = 8
  let cursor = 0
  const worker = async () => {
    while (cursor < rows.length) {
      const row = rows[cursor++]
      let attrs: Record<string, string> = {}
      try {
        attrs = await kernel.getBlockAttrs(row.id)
      } catch {
        attrs = {}
      }
      taskState.tasks.set(row.id, rowToTask(row, attrs))
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, rows.length) }, worker))
}

export async function loadAll(): Promise<void> {
  taskState.loading = true
  taskState.error = ""
  try {
    const { rows, hasIal } = await kernel.fetchTaskRows()
    await hydrate(rows, hasIal)
    taskState.loaded = true
    bumpVersion()
  } catch (error) {
    taskState.error = error instanceof Error ? error.message : String(error)
    await kernel.pushErrMsg(t("loadFailed", "读取待办失败：") + taskState.error)
  } finally {
    taskState.loading = false
  }
}

/**
 * 事务增量同步：只对受影响的块重新查询一次。
 * 相比「每秒全量快照比对」，这里没有定时器、没有全量序列化。
 */
const pendingIds = new Set<string>()
let syncTimer: number | undefined

export function scheduleSync(ids: string[]): void {
  if (ids.length === 0) {
    return
  }
  let schedule = false
  for (const id of ids) {
    if (!pendingIds.has(id)) {
      pendingIds.add(id)
      schedule = true
    }
  }
  if (!schedule) {
    return
  }
  if (syncTimer) {
    window.clearTimeout(syncTimer)
  }
  syncTimer = window.setTimeout(() => {
    syncTimer = undefined
    const batch = Array.from(pendingIds)
    pendingIds.clear()
    void syncIds(batch)
  }, 300)
}

export async function syncIds(ids: string[]): Promise<void> {
  if (ids.length === 0) {
    return
  }
  try {
    const rows = await kernel.fetchRowsByIds(ids)
    const seen = new Set<string>()
    for (const row of rows) {
      seen.add(row.id)
      const existing = taskState.tasks.get(row.id)
      // ial 列可能为空对象，这里退化为基础解析
      const task = rowToTask(row)
      taskState.tasks.set(row.id, existing ? { ...existing, ...task, sort: existing.sort } : task)
    }
    for (const id of ids) {
      if (!seen.has(id)) {
        taskState.tasks.delete(id)
      }
    }
    bumpVersion()
  } catch {
    // 增量失败不打扰用户，等待下一次事务或手动刷新
  }
}

/* ------------------------------------------------------------------ *
 * 写入
 * ------------------------------------------------------------------ */

function nowStamp(): string {
  const d = new Date()
  const pad = (n: number) => `${n}`.padStart(2, "0")
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
}

function attrValues(task: Task): Record<string, string> {
  return {
    [ATTR.priority]: task.priority === 3 ? "" : toAttrPriority(task.priority),
    [ATTR.due]: task.due,
    [ATTR.repeat]: task.repeat,
    [ATTR.category]: task.category,
    [ATTR.note]: task.note,
    [ATTR.sort]: String(task.sort),
    [ATTR.trash]: task.trashed ? "1" : "",
  }
}

function diffAttrs(before: Task, after: Task): Record<string, string> {
  const beforeAttrs = attrValues(before)
  const afterAttrs = attrValues(after)
  const diff: Record<string, string> = {}
  for (const [key, value] of Object.entries(afterAttrs)) {
    if (beforeAttrs[key] !== value) {
      diff[key] = value
    }
  }
  return diff
}

async function writeTask(task: Task, before?: Task): Promise<void> {
  const previous = before ?? task
  if (task.title !== previous.title || task.done !== previous.done) {
    await kernel.updateBlockMarkdown(task.id, buildMarkdown(task.title, task.done))
  }
  const attrs = diffAttrs(previous, task)
  if (Object.keys(attrs).length > 0) {
    await kernel.setBlockAttrs(task.id, attrs)
  }
}

interface PatchOptions {
  label: string
  /** 是否允许撤销 */
  undoable?: boolean
}

async function patch(id: string, changes: Partial<Task>, options: PatchOptions): Promise<void> {
  const task = taskState.tasks.get(id)
  if (!task) {
    return
  }
  const before: Task = { ...task }
  Object.assign(task, changes)
  task.updated = nowStamp()
  bumpVersion()

  try {
    await writeTask(task, before)
    if (options.undoable !== false) {
      pushUndo({
        label: options.label,
        undo: async () => {
          const live = taskState.tasks.get(id)
          if (!live) {
            return
          }
          // 先留下撤销前的值作为写入基线，否则 diff 会算成「无变化」而不落盘
          const beforeUndo = { ...live }
          Object.assign(live, before)
          bumpVersion()
          await writeTask(before, beforeUndo)
        },
        redo: async () => {
          const live = taskState.tasks.get(id)
          await writeTask({ ...before, ...changes }, before)
          if (live) {
            Object.assign(live, changes)
            live.updated = nowStamp()
            bumpVersion()
          }
        },
      })
    }
  } catch (error) {
    Object.assign(task, before)
    bumpVersion()
    await kernel.pushErrMsg(t("saveFailed", "保存失败：") + (error instanceof Error ? error.message : String(error)))
  }
}

/* ------------------------------------------------------------------ *
 * 具体操作
 * ------------------------------------------------------------------ */

export function setTitle(id: string, title: string): Promise<void> {
  return patch(id, { title }, { label: "title" })
}

export function setDue(id: string, due: string): Promise<void> {
  return patch(id, { due }, { label: "due" })
}

export function setRepeat(id: string, repeat: string): Promise<void> {
  return patch(id, { repeat }, { label: "repeat" })
}

export function setCategory(id: string, category: string): Promise<void> {
  return patch(id, { category }, { label: "category" })
}

export function setNote(id: string, note: string): Promise<void> {
  return patch(id, { note }, { label: "note" })
}

export function setPriority(id: string, priority: Priority): Promise<void> {
  return patch(id, { priority }, { label: "priority" })
}

export async function toggleDone(id: string): Promise<void> {
  const task = taskState.tasks.get(id)
  if (!task) {
    return
  }

  if (!task.done && task.repeat && settings.repeatAdvance) {
    const next = nextOccurrence(task.due || today(), task.repeat)
    await patch(id, { due: next, done: false }, { label: "repeat-next" })
    return
  }

  const nextDone = !task.done
  const targets: string[] = [id]
  if (nextDone) {
    // 完成父任务时级联完成所有子孙
    for (const child of collectDescendants(id, taskState.tasks)) {
      if (!child.done) {
        targets.push(child.id)
      }
    }
  } else {
    // 取消某个子任务时，把祖先重新标记为未完成
    for (const parent of collectAncestors(id, taskState.tasks)) {
      if (parent.done) {
        targets.push(parent.id)
      }
    }
  }

  const snapshots = targets
    .map((targetId) => taskState.tasks.get(targetId))
    .filter((item): item is Task => !!item)
    .map((item) => ({ ...item }))

  for (const snapshot of snapshots) {
    const live = taskState.tasks.get(snapshot.id)
    if (live) {
      live.done = nextDone
      live.updated = nowStamp()
    }
  }
  bumpVersion()

  try {
    for (const snapshot of snapshots) {
      const updated = taskState.tasks.get(snapshot.id) as Task
      await kernel.updateBlockMarkdown(updated.id, buildMarkdown(updated.title, nextDone))
    }
    pushUndo({
      label: nextDone ? "complete" : "reopen",
      undo: async () => {
        for (const snapshot of snapshots) {
          const live = taskState.tasks.get(snapshot.id)
          if (live) {
            live.done = snapshot.done
            bumpVersion()
          }
          await kernel.updateBlockMarkdown(snapshot.id, buildMarkdown(snapshot.title, snapshot.done))
        }
      },
      redo: async () => {
        for (const snapshot of snapshots) {
          await kernel.updateBlockMarkdown(snapshot.id, buildMarkdown(snapshot.title, nextDone))
        }
        for (const snapshot of snapshots) {
          const live = taskState.tasks.get(snapshot.id)
          if (live) {
            live.done = nextDone
          }
        }
        bumpVersion()
      },
    })
  } catch (error) {
    for (const snapshot of snapshots) {
      const live = taskState.tasks.get(snapshot.id)
      if (live) {
        live.done = snapshot.done
      }
    }
    bumpVersion()
    await kernel.pushErrMsg(t("saveFailed", "保存失败：") + (error instanceof Error ? error.message : String(error)))
  }
}

export function trashTask(id: string): Promise<void> {
  return patch(id, { trashed: true }, { label: "trash" })
}

export function restoreTask(id: string): Promise<void> {
  return patch(id, { trashed: false }, { label: "restore" })
}

export async function removeForever(id: string): Promise<void> {
  const task = taskState.tasks.get(id)
  if (!task) {
    return
  }
  const snapshot = { ...task }
  taskState.tasks.delete(id)
  bumpVersion()
  try {
    await kernel.deleteBlock(id)
  } catch (error) {
    taskState.tasks.set(id, snapshot)
    bumpVersion()
    await kernel.pushErrMsg(t("deleteFailed", "删除失败：") + (error instanceof Error ? error.message : String(error)))
  }
}

export async function emptyTrash(): Promise<void> {
  const trashed = listTasks().filter((task) => task.trashed)
  for (const task of trashed) {
    await removeForever(task.id)
  }
}

async function resolveTargetDoc(): Promise<string> {
  if (settings.defaultDocId) {
    return settings.defaultDocId
  }
  const box = settings.defaultBox || (await kernel.listNotebooks())[0]?.id || ""
  if (!box) {
    throw new Error(t("noNotebook", "没有可用的笔记本"))
  }
  const cacheKey = `${box}|${today()}`
  if (dailyNoteCache?.key === cacheKey) {
    return dailyNoteCache.id
  }
  const id = await kernel.createDailyNote(box)
  dailyNoteCache = { key: cacheKey, id }
  return id
}

async function docMeta(docId: string): Promise<{ box: string; hpath: string }> {
  try {
    const rows = await kernel.sql<{ box: string; hpath: string }[]>(
      `SELECT box, hpath FROM blocks WHERE id = '${docId.replace(/'/g, "''")}'`,
    )
    return rows?.[0] ?? { box: "", hpath: "" }
  } catch {
    return { box: "", hpath: "" }
  }
}

export interface CreateInput {
  title: string
  priority?: Priority
  due?: string
  repeat?: string
  category?: string
  parentId?: string
  docId?: string
}

export async function createTask(input: CreateInput): Promise<Task | undefined> {
  const title = input.title.trim()
  if (!title) {
    return undefined
  }
  let docId = input.docId || input.parentId
  if (!docId) {
    docId = await resolveTargetDoc()
  }
  const parentId = input.parentId || docId

  const known = new Set(taskState.tasks.keys())
  const maxSort = listTasks().reduce((max, item) => Math.max(max, item.sort), 0)

  let createdId: string | undefined
  try {
    const result = await kernel.appendBlock(parentId, buildMarkdown(title, false))
    createdId = kernel.extractInsertedId(result)
    if (!createdId) {
      const rows = await kernel.sql<{ id: string }[]>(
        `SELECT id FROM blocks WHERE type = 'i' AND subtype = 't' AND root_id = '${docId.replace(/'/g, "''")}'`,
      )
      createdId = (rows ?? []).map((row) => row.id).find((id) => !known.has(id))
    }
    if (!createdId) {
      throw new Error(t("createFailed", "创建失败，未能定位新块"))
    }

    const meta = await docMeta(docId)
    const task: Task = {
      id: createdId,
      parentId,
      rootId: docId,
      box: meta.box,
      hpath: meta.hpath,
      title,
      done: false,
      priority: input.priority ?? 3,
      due: input.due ?? "",
      repeat: input.repeat ?? "",
      category: input.category ?? "",
      note: "",
      sort: maxSort + 1000,
      trashed: false,
      created: nowStamp(),
      updated: nowStamp(),
    }
    taskState.tasks.set(task.id, task)
    bumpVersion()
    await kernel.setBlockAttrs(task.id, diffAttrs({ ...task, priority: 3, sort: 0, due: "", repeat: "", category: "" }, task))
    return task
  } catch (error) {
    await kernel.pushErrMsg(t("createFailed", "创建失败：") + (error instanceof Error ? error.message : String(error)))
    return undefined
  }
}

/** 手动排序：一次性为一组同级任务重写 sort 权重 */
export async function reorderSiblings(orderedIds: string[]): Promise<void> {
  const snapshots = orderedIds
    .map((id) => taskState.tasks.get(id))
    .filter((item): item is Task => !!item)
    .map((item) => ({ ...item }))

  const updates: Task[] = []
  orderedIds.forEach((id, index) => {
    const live = taskState.tasks.get(id)
    if (!live) {
      return
    }
    const sort = (index + 1) * 1000
    if (live.sort !== sort) {
      live.sort = sort
      live.updated = nowStamp()
      updates.push(live)
    }
  })
  if (updates.length === 0) {
    return
  }
  bumpVersion()
  try {
    for (const task of updates) {
      await kernel.setBlockAttrs(task.id, { [ATTR.sort]: String(task.sort) })
    }
    pushUndo({
      label: "reorder",
      undo: async () => {
        for (const snapshot of snapshots) {
          const live = taskState.tasks.get(snapshot.id)
          if (live) {
            live.sort = snapshot.sort
          }
          await kernel.setBlockAttrs(snapshot.id, { [ATTR.sort]: String(snapshot.sort) })
        }
        bumpVersion()
      },
    })
  } catch (error) {
    for (const snapshot of snapshots) {
      const live = taskState.tasks.get(snapshot.id)
      if (live) {
        live.sort = snapshot.sort
      }
    }
    bumpVersion()
    await kernel.pushErrMsg(t("saveFailed", "保存失败：") + (error instanceof Error ? error.message : String(error)))
  }
}

/** 缩进为上一个同级的子任务（真实改变块层级） */
export async function indentTask(id: string): Promise<void> {
  const task = taskState.tasks.get(id)
  if (!task) {
    return
  }
  const siblings = listTasks().filter((item) => item.id !== id && item.parentId === task.parentId)
  const previous = siblings.sort((a, b) => a.sort - b.sort).filter((item) => item.sort < task.sort).pop()
  if (!previous) {
    return
  }
  const before = { ...task }
  task.parentId = previous.id
  bumpVersion()
  try {
    await kernel.moveBlock(id, "", previous.id)
    scheduleSync([id])
  } catch (error) {
    Object.assign(task, before)
    bumpVersion()
    await kernel.pushErrMsg(t("moveFailed", "移动失败：") + (error instanceof Error ? error.message : String(error)))
  }
}

/** 反缩进为父任务的下一段 */
export async function outdentTask(id: string): Promise<void> {
  const task = taskState.tasks.get(id)
  if (!task || !task.parentId) {
    return
  }
  const parent = taskState.tasks.get(task.parentId)
  if (!parent) {
    return
  }
  const before = { ...task }
  task.parentId = parent.parentId
  bumpVersion()
  try {
    await kernel.moveBlock(id, parent.id, parent.parentId || task.rootId)
    scheduleSync([id])
  } catch (error) {
    Object.assign(task, before)
    bumpVersion()
    await kernel.pushErrMsg(t("moveFailed", "移动失败：") + (error instanceof Error ? error.message : String(error)))
  }
}
