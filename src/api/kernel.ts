import type { TaskBlockRow } from "@/core/task"

export interface ApiResponse<T> {
  code: number
  msg: string
  data: T
}

const REQUEST_TIMEOUT = 20_000
const PAGE_SIZE = 500

async function post<T>(url: string, body: Record<string, unknown> = {}): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`HTTP ${response.status} ${url}`)
    const payload = (await response.json()) as ApiResponse<T>
    if (!payload || typeof payload !== "object" || typeof payload.code !== "number") {
      throw new Error(`内核响应格式错误：${url}`)
    }
    if (payload.code !== 0) throw new Error(payload.msg || `内核请求失败：${url}`)
    return payload.data
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`内核请求超时：${url}`)
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}

export function sql<T = Record<string, string>[]>(statement: string): Promise<T> {
  return post<T>("/api/query/sql", { stmt: statement })
}

export function flushTransaction(): Promise<null> {
  return post<null>("/api/sqlite/flushTransaction")
}

const TASK_COLUMNS = `t.id, t.parent_id, t.root_id, t.box, t.hpath, t.content, t.markdown, t.created, t.updated,
  p.type AS parent_type, p.subtype AS parent_subtype,
  g.id AS container_parent_id, g.type AS container_parent_type, g.subtype AS container_parent_subtype`
const TASK_FROM = "FROM blocks t LEFT JOIN blocks p ON p.id = t.parent_id LEFT JOIN blocks g ON g.id = p.parent_id"
const TASK_WHERE = "t.type = 'i' AND t.subtype = 't'"

async function queryTasks(where: string, limit: number, offset = 0, withIal = true): Promise<TaskBlockRow[]> {
  const columns = withIal ? `${TASK_COLUMNS}, t.ial` : TASK_COLUMNS
  const statement = `SELECT ${columns} ${TASK_FROM} WHERE ${TASK_WHERE} AND (${where}) ORDER BY t.id LIMIT ${limit} OFFSET ${offset}`
  const rows = await sql<TaskBlockRow[]>(statement)
  return Array.isArray(rows) ? rows : []
}

async function queryTasksCompatible(where: string, limit: number, offset = 0): Promise<{ rows: TaskBlockRow[]; hasIal: boolean }> {
  try {
    return { rows: await queryTasks(where, limit, offset, true), hasIal: true }
  } catch (error) {
    return { rows: await queryTasks(where, limit, offset, false), hasIal: false }
  }
}

export async function fetchTaskRows(): Promise<{ rows: TaskBlockRow[]; hasIal: boolean }> {
  const rows: TaskBlockRow[] = []
  let hasIal = true
  for (let offset = 0; ; offset += PAGE_SIZE) {
    let page: TaskBlockRow[]
    try {
      page = await queryTasks("1 = 1", PAGE_SIZE, offset, hasIal)
    } catch (error) {
      if (!hasIal || offset > 0) throw error
      hasIal = false
      page = await queryTasks("1 = 1", PAGE_SIZE, offset, false)
    }
    rows.push(...page)
    if (page.length < PAGE_SIZE) break
    if (offset >= 1_000_000) throw new Error("任务数量超过安全读取上限，请分批整理任务")
  }
  return { rows, hasIal }
}

export async function fetchRowsByIds(ids: string[]): Promise<{ rows: TaskBlockRow[]; hasIal: boolean }> {
  if (!ids.length) return { rows: [], hasIal: true }
  const rows: TaskBlockRow[] = []
  let hasIal = true
  for (let offset = 0; offset < ids.length; offset += 200) {
    const chunk = ids.slice(offset, offset + 200)
    const clause = `t.id IN (${chunk.map((id) => `'${escapeLiteral(id)}'`).join(",")})`
    const result = await queryTasksCompatible(clause, chunk.length)
    hasIal = hasIal && result.hasIal
    rows.push(...result.rows)
  }
  return { rows, hasIal }
}

/** 创建时使用一次性标记定位真实 i/t 块，绝不猜响应中的第一个 ID。 */
export async function findTaskIdsByToken(token: string): Promise<string[]> {
  const literal = escapeLiteral(token)
  const rows = await sql<{ id: string }[]>(
    `SELECT id FROM blocks WHERE type = 'i' AND subtype = 't' AND (markdown LIKE '%${literal}%' OR content LIKE '%${literal}%') ORDER BY id LIMIT 2`,
  )
  return (rows ?? []).map((row) => row.id)
}

export interface NotebookInfo {
  id: string
  name: string
  closed: boolean
}

export async function listNotebooks(): Promise<NotebookInfo[]> {
  const data = await post<{ notebooks: NotebookInfo[] }>("/api/notebook/lsNotebooks")
  return data?.notebooks ?? []
}

export async function createDailyNote(box: string): Promise<string> {
  const data = await post<{ id: string } | string>("/api/filetree/createDailyNote", { notebook: box })
  const id = typeof data === "string" ? data : data?.id
  if (!id) throw new Error("创建日记后未获得文档 ID")
  return id
}

export async function listDocuments(): Promise<{ id: string; hpath: string; box: string }[]> {
  const rows = await sql<{ id: string; hpath: string; box: string }[]>(
    "SELECT id, hpath, box FROM blocks WHERE type = 'd' ORDER BY updated DESC, id LIMIT 500",
  )
  return rows ?? []
}

export async function docMeta(docId: string): Promise<{ box: string; hpath: string }> {
  const rows = await sql<{ box: string; hpath: string }[]>(
    `SELECT box, hpath FROM blocks WHERE id = '${escapeLiteral(docId)}' AND type = 'd' LIMIT 1`,
  )
  const meta = rows?.[0]
  if (!meta) throw new Error(`目标文档不存在：${docId}`)
  return meta
}

export function setBlockAttrs(id: string, attrs: Record<string, string>): Promise<null> {
  return post<null>("/api/attr/setBlockAttrs", { id, attrs })
}

export async function getBlockAttrs(id: string): Promise<Record<string, string>> {
  const attrs = await post<Record<string, string>>("/api/attr/getBlockAttrs", { id })
  return attrs ?? {}
}

export async function getBlockKramdown(id: string): Promise<string> {
  const data = await post<{ kramdown: string }>("/api/block/getBlockKramdown", { id })
  if (typeof data?.kramdown !== "string") throw new Error(`无法读取任务块源码：${id}`)
  return data.kramdown
}

export function updateBlock(id: string, markdown: string): Promise<unknown> {
  return post("/api/block/updateBlock", { id, dataType: "markdown", data: markdown, lockType: true })
}

export function appendBlock(parentId: string, markdown: string): Promise<unknown> {
  return post("/api/block/appendBlock", { parentID: parentId, dataType: "markdown", data: markdown })
}

export function insertBlock(previousId: string, markdown: string): Promise<unknown> {
  return post("/api/block/insertBlock", { previousID: previousId, nextID: "", parentID: "", dataType: "markdown", data: markdown })
}

export function moveBlock(id: string, previousId: string, parentId: string): Promise<unknown> {
  return post("/api/block/moveBlock", { id, previousID: previousId, parentID: parentId })
}

export function deleteBlock(id: string): Promise<unknown> {
  return post("/api/block/deleteBlock", { id })
}

export async function childBlocks(id: string): Promise<{ id: string; type?: string; subType?: string }[]> {
  const rows = await post<{ id: string; type?: string; subType?: string }[]>("/api/block/getChildBlocks", { id })
  return Array.isArray(rows) ? rows : []
}

export function pushErrMsg(msg: string, timeout = 7000): Promise<unknown> {
  return post("/api/notification/pushErrMsg", { msg, timeout })
}

export function pushMsg(msg: string, timeout = 4000): Promise<unknown> {
  return post("/api/notification/pushMsg", { msg, timeout })
}

function escapeLiteral(value: string): string {
  return value.replace(/'/g, "''")
}
