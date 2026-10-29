/**
 * 思源内核 HTTP API 薄封装。
 *
 * 只依赖同源 `fetch`（插件运行在思源前端页面里），不引入任何第三方请求库。
 */

export interface ApiResponse<T> {
  code: number
  msg: string
  data: T
}

async function post<T>(url: string, body: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${url}`)
  }
  const payload = (await response.json()) as ApiResponse<T>
  if (payload && typeof payload === "object" && "code" in payload) {
    if (payload.code !== 0) {
      throw new Error(payload.msg || `request failed: ${url}`)
    }
    return payload.data
  }
  return payload as T
}

/** 执行只读 SQL（`blocks` / `attributes` 等索引表） */
export function sql<T = Record<string, string>[]>(stmt: string): Promise<T> {
  return post<T>("/api/query/sql", { stmt })
}

/** `blocks` 表里一条任务列表块记录 */
export interface TaskBlockRow {
  id: string
  parent_id?: string
  root_id?: string
  box?: string
  hpath?: string
  content?: string
  markdown?: string
  created?: string
  updated?: string
  ial?: string
}

const BLOCK_COLUMNS = "id, parent_id, root_id, box, hpath, content, markdown, created, updated"
const BLOCK_WHERE = "type = 'i' AND subtype = 't'"

/**
 * 取出全工作空间的任务列表块。
 *
 * 优先带上 `ial` 列（一次请求即可拿到全部块属性）；若内核版本不支持该列，
 * 自动降级为不带 `ial` 的查询，由调用方自行按需懒加载属性。
 */
export async function fetchTaskRows(rootId?: string): Promise<{ rows: TaskBlockRow[]; hasIal: boolean }> {
  const scope = rootId ? `${BLOCK_WHERE} AND root_id = '${escapeLiteral(rootId)}'` : BLOCK_WHERE
  try {
    const rows = await sql<TaskBlockRow[]>(
      `SELECT ${BLOCK_COLUMNS}, ial FROM blocks WHERE ${scope}`,
    )
    return { rows: Array.isArray(rows) ? rows : [], hasIal: true }
  } catch {
    const rows = await sql<TaskBlockRow[]>(
      `SELECT ${BLOCK_COLUMNS} FROM blocks WHERE ${scope}`,
    )
    return { rows: Array.isArray(rows) ? rows : [], hasIal: false }
  }
}

/** 只取指定块（用于事务增量刷新），同样优先带 `ial` */
export async function fetchRowsByIds(ids: string[]): Promise<TaskBlockRow[]> {
  if (ids.length === 0) {
    return []
  }
  const inClause = ids.map((id) => `'${escapeLiteral(id)}'`).join(",")
  try {
    return await sql<TaskBlockRow[]>(
      `SELECT ${BLOCK_COLUMNS}, ial FROM blocks WHERE type = 'i' AND subtype = 't' AND id IN (${inClause})`,
    )
  } catch {
    return await sql<TaskBlockRow[]>(
      `SELECT ${BLOCK_COLUMNS} FROM blocks WHERE type = 'i' AND subtype = 't' AND id IN (${inClause})`,
    )
  }
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

/** 获取（不存在则创建）当天日记文档 ID */
export async function createDailyNote(box: string): Promise<string> {
  const data = await post<{ id: string }>("/api/filetree/createDailyNote", { notebook: box })
  return data?.id ?? ""
}

export function setBlockAttrs(id: string, attrs: Record<string, string>): Promise<null> {
  // 值为空字符串表示删除该属性
  return post<null>("/api/attr/setBlockAttrs", { id, attrs })
}

export function getBlockAttrs(id: string): Promise<Record<string, string>> {
  return post<Record<string, string>>("/api/attr/getBlockAttrs", { id })
}

export function updateBlockMarkdown(id: string, markdown: string): Promise<unknown> {
  return post<unknown>("/api/block/updateBlock", { id, dataType: "markdown", data: markdown })
}

/** 作为最后一个子块插入 */
export function appendBlock(parentId: string, markdown: string): Promise<unknown> {
  return post<unknown>("/api/block/appendBlock", { parentID: parentId, dataType: "markdown", data: markdown })
}

/** 移动到新的父块 / 新位置 */
export function moveBlock(id: string, previousId: string, parentId: string): Promise<unknown> {
  return post<unknown>("/api/block/moveBlock", { id, previousID: previousId, parentID: parentId })
}

export function deleteBlock(id: string): Promise<unknown> {
  return post<unknown>("/api/block/deleteBlock", { id })
}

/** 推送错误提示 */
export function pushErrMsg(msg: string, timeout = 6000): Promise<unknown> {
  return post<unknown>("/api/notification/pushErrMsg", { msg, timeout })
}

/**
 * 从 insert/append 的返回值里尽力提取新块 ID。
 * 不同内核版本返回结构不一致，这里统一兜底为 `undefined`，由调用方重新查询。
 */
export function extractInsertedId(result: unknown): string | undefined {
  if (!result) {
    return undefined
  }
  const visit = (node: unknown): string | undefined => {
    if (typeof node === "string" && /^\d{14}-[a-z0-9]{7}$/.test(node)) {
      return node
    }
    if (Array.isArray(node)) {
      for (const item of node) {
        const found = visit(item)
        if (found) {
          return found
        }
      }
      return undefined
    }
    if (typeof node === "object" && node !== null) {
      const record = node as Record<string, unknown>
      if (typeof record.id === "string" && /^\d{14}-[a-z0-9]{7}$/.test(record.id)) {
        return record.id
      }
      return visit(record.doOperations ?? record.data)
    }
    return undefined
  }
  return visit(result)
}

function escapeLiteral(value: string): string {
  return value.replace(/'/g, "''")
}
