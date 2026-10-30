import { reactive } from "vue"

import * as kernel from "@/api/kernel"
import type { TaskBlockRow } from "@/api/kernel"
import { addDays, nextOccurrence, today } from "@/core/date"
import { collectAncestors, collectDescendants } from "@/core/filter"
import { ATTR, buildMarkdown, rowToTask, toAttrPriority, toAttrStatus } from "@/core/task"
import type { Priority, Task, TaskStatus } from "@/core/types"
import { pushUndo } from "@/store/undo"

import { t } from "./i18n"
import { persistSettings, settings } from "./settings"

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

/** 标记任务是否属于独立空间 */
function decorate(task: Task): Task {
  task.inSpace = !!settings.spaceDocId && task.rootId === settings.spaceDocId
  return task
}

/** 独立空间文档变化后重新标注归属 */
export function redecorateAll(): void {
  for (const task of taskState.tasks.values()) {
    decorate(task)
  }
  bumpVersion()
}

/* ------------------------------------------------------------------ *
 * 读取
 * ------------------------------------------------------------------ */

let dailyNoteCache: { key: string; id: string } | undefined

async function hydrate(rows: TaskBlockRow[], hasIal: boolean): Promise<void> {
  if (hasIal) {
    for (const row of rows) {
      taskState.tasks.set(row.id, decorate(rowToTask(row)))
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
      taskState.tasks.set(row.id, decorate(rowToTask(row, attrs)))
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, rows.length) }, worker))
}

export async function loadAll(): Promise<void> {
  taskState.loading = true
  taskState.error = ""
  try {
    const { rows, hasIal } = await kernel.fetchTaskRows()
    taskState.tasks.clear()
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
      const fresh = rowToTask(row)
      taskState.tasks.set(
        row.id,
        decorate(existing ? { ...existing, ...fresh, sort: existing.sort, note: fresh.note } : fresh),
      )
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
    [ATTR.status]: toAttrStatus(task.status),
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
  const wasDone = previous.status === "done"
  const isDone = task.status === "done"
  if (task.title !== previous.title || wasDone !== isDone) {
    await kernel.updateBlockMarkdown(task.id, buildMarkdown(task.title, isDone))
  }
  const attrs = diffAttrs(previous, task)
  if (Object.keys(attrs).length > 0) {
    await kernel.setBlockAttrs(task.id, attrs)
  }
}

interface PatchOptions {
  label: string
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
 * 字段写入
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

export function setStatus(id: string, status: TaskStatus): Promise<void> {
  return patch(id, { status }, { label: "status" })
}

/**
 * 切换完成态：
 * - 勾选时级联完成所有子孙
 * - 取消勾选时把祖先恢复为未完成
 * - 开启「重复推进」时，完成重复任务改为把截止日期推到下一次
 */
export async function toggleDone(id: string): Promise<void> {
  const task = taskState.tasks.get(id)
  if (!task) {
    return
  }

  const becomesDone = task.status !== "done"

  if (becomesDone && task.repeat && settings.repeatAdvance) {
    const next = nextOccurrence(task.due || today(), task.repeat)
    await patch(id, { due: next, status: "todo" }, { label: "repeat-next" })
    return
  }

  const targets: string[] = [id]
  if (becomesDone) {
    for (const child of collectDescendants(id, taskState.tasks)) {
      if (child.status !== "done" && child.status !== "archived") {
        targets.push(child.id)
      }
    }
  } else {
    for (const parent of collectAncestors(id, taskState.tasks)) {
      if (parent.status === "done") {
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
      live.status = becomesDone ? "done" : "todo"
      live.updated = nowStamp()
    }
  }
  bumpVersion()

  try {
    for (const snapshot of snapshots) {
      const live = taskState.tasks.get(snapshot.id) as Task
      await kernel.updateBlockMarkdown(live.id, buildMarkdown(live.title, becomesDone))
      if (!becomesDone) {
        await kernel.setBlockAttrs(live.id, { [ATTR.status]: "" })
      }
    }
    pushUndo({
      label: becomesDone ? "complete" : "reopen",
      undo: async () => {
        for (const snapshot of snapshots) {
          const live = taskState.tasks.get(snapshot.id)
          if (live) {
            live.status = snapshot.status
          }
          await kernel.updateBlockMarkdown(
            snapshot.id,
            buildMarkdown(snapshot.title, snapshot.status === "done"),
          )
          await kernel.setBlockAttrs(snapshot.id, { [ATTR.status]: toAttrStatus(snapshot.status) })
        }
        bumpVersion()
      },
      redo: async () => {
        for (const snapshot of snapshots) {
          await kernel.updateBlockMarkdown(snapshot.id, buildMarkdown(snapshot.title, becomesDone))
        }
        for (const snapshot of snapshots) {
          const live = taskState.tasks.get(snapshot.id)
          if (live) {
            live.status = becomesDone ? "done" : "todo"
          }
        }
        bumpVersion()
      },
    })
  } catch (error) {
    for (const snapshot of snapshots) {
      const live = taskState.tasks.get(snapshot.id)
      if (live) {
        live.status = snapshot.status
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

/* ------------------------------------------------------------------ *
 * 文档解析
 * ------------------------------------------------------------------ */

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

/** 独立空间任务树文档的默认标题 */
export const SPACE_DOC_TITLE = "SY 待办 任务树"

/** 获取（必要时创建）独立空间任务树所在文档 */
export async function ensureSpaceDoc(): Promise<string> {
  if (settings.spaceDocId && (await kernel.docExists(settings.spaceDocId))) {
    return settings.spaceDocId
  }
  // 重装或改插件 id 后配置会丢，先按标题找回已有的任务树，避免出现两棵树
  try {
    const rows = await kernel.sql<{ id: string }[]>(
      `SELECT id FROM blocks WHERE type = 'd' AND content = '${SPACE_DOC_TITLE}' LIMIT 1`,
    )
    const found = rows?.[0]?.id
    if (found) {
      settings.spaceDocId = found
      persistSettings()
      redecorateAll()
      return found
    }
  } catch {
    // 查不到就继续走创建流程
  }
  const box = settings.spaceBox || settings.defaultBox || (await kernel.listNotebooks())[0]?.id || ""
  if (!box) {
    throw new Error(t("noNotebook", "没有可用的笔记本"))
  }
  const id = await kernel.createDocWithMd(box, `/${SPACE_DOC_TITLE}`, "")
  settings.spaceDocId = id
  settings.spaceBox = box
  persistSettings()
  redecorateAll()
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

/* ------------------------------------------------------------------ *
 * 创建 / 移动
 * ------------------------------------------------------------------ */

export interface CreateInput {
  title: string
  priority?: Priority
  status?: TaskStatus
  due?: string
  repeat?: string
  category?: string
  /** 父任务块 ID；留空表示创建到 scope 对应文档的根层 */
  parentId?: string
  /** 指定写入的文档 ID */
  docId?: string
  /** 创建到哪个空间，默认笔记 */
  scope?: "note" | "space"
}

export async function createTask(input: CreateInput): Promise<Task | undefined> {
  const title = input.title.trim()
  if (!title) {
    return undefined
  }

  let docId = input.docId
  let parentId = input.parentId

  try {
    // 有父任务时直接挂到父任务下，文档由父任务决定
    if (parentId) {
      const parent = taskState.tasks.get(parentId)
      docId = docId || parent?.rootId
    }
    if (!docId) {
      docId = input.scope === "space" ? await ensureSpaceDoc() : await resolveTargetDoc()
    }
    if (!parentId) {
      parentId = docId
    }

    const known = new Set(taskState.tasks.keys())
    const maxSort = listTasks().reduce((max, item) => Math.max(max, item.sort), 0)

    const result = await kernel.appendBlock(parentId, buildMarkdown(title, false))
    let createdId = kernel.extractInsertedId(result)
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
    const task: Task = decorate({
      id: createdId,
      parentId,
      rootId: docId,
      box: meta.box,
      hpath: meta.hpath,
      title,
      status: input.status ?? "todo",
      priority: input.priority ?? 3,
      due: input.due ?? "",
      repeat: input.repeat ?? "",
      category: input.category ?? "",
      note: "",
      sort: maxSort + 1000,
      trashed: false,
      inSpace: false,
      created: nowStamp(),
      updated: nowStamp(),
    })
    taskState.tasks.set(task.id, task)
    bumpVersion()

    const needsAttrs =
      task.status !== "todo" || task.priority !== 3 || !!task.due || !!task.repeat || !!task.category
    if (needsAttrs) {
      const blank: Task = {
        ...task,
        status: "todo",
        priority: 3,
        due: "",
        repeat: "",
        category: "",
        sort: 0,
      }
      await kernel.setBlockAttrs(task.id, diffAttrs(blank, task))
    }
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

/** 把任务移动到新的父节点下（真实改变块层级），previousId 为空表示放到子节点首位 */
export async function moveTask(id: string, newParentId: string, previousId = ""): Promise<void> {
  const task = taskState.tasks.get(id)
  if (!task || newParentId === task.id) {
    return
  }
  const before = { ...task }
  task.parentId = newParentId
  bumpVersion()
  try {
    await kernel.moveBlock(id, previousId, newParentId)
    scheduleSync([id])
  } catch (error) {
    Object.assign(task, before)
    bumpVersion()
    await kernel.pushErrMsg(t("moveFailed", "移动失败：") + (error instanceof Error ? error.message : String(error)))
  }
}

/** 缩进为上一个同级的子节点 */
export async function indentTask(id: string): Promise<void> {
  const task = taskState.tasks.get(id)
  if (!task) {
    return
  }
  const siblings = listTasks().filter((item) => item.id !== id && item.parentId === task.parentId)
  const previous = siblings
    .sort((a, b) => a.sort - b.sort)
    .filter((item) => item.sort < task.sort)
    .pop()
  if (!previous) {
    return
  }
  await moveTask(id, previous.id, "")
}

/** 反缩进，成为父节点的下一个兄弟 */
export async function outdentTask(id: string): Promise<void> {
  const task = taskState.tasks.get(id)
  if (!task) {
    return
  }
  const parent = taskState.tasks.get(task.parentId)
  if (!parent) {
    return
  }
  await moveTask(id, parent.parentId || parent.rootId || task.rootId, parent.id)
}

/** 快捷：把任务顺延到下一天 */
export function postponeOneDay(id: string): Promise<void> {
  const task = taskState.tasks.get(id)
  if (!task) {
    return Promise.resolve()
  }
  return patch(id, { due: addDays(task.due || today(), 1) }, { label: "postpone" })
}
