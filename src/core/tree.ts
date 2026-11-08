import type { Task } from "./types"

export function manualCompare(a: Task, b: Task): number {
  return a.sort - b.sort || a.created.localeCompare(b.created) || a.id.localeCompare(b.id)
}

export function siblingKey(task: Task): string {
  return `${task.space}|${task.rootId}|${task.containerId}|${task.parentId}`
}

export function childrenIndex(tasks: Iterable<Task>): Map<string, Task[]> {
  const map = new Map<string, Task[]>()
  for (const task of tasks) {
    if (!task.parentId) continue
    const bucket = map.get(task.parentId)
    if (bucket) bucket.push(task)
    else map.set(task.parentId, [task])
  }
  for (const bucket of map.values()) bucket.sort(manualCompare)
  return map
}

export function collectDescendants(rootId: string, index: Map<string, Task>): Task[] {
  const byParent = childrenIndex(index.values())
  const result: Task[] = []
  const visited = new Set([rootId])
  const stack = [rootId]
  while (stack.length) {
    const current = stack.pop() as string
    for (const child of byParent.get(current) ?? []) {
      if (visited.has(child.id)) continue
      visited.add(child.id)
      result.push(child)
      stack.push(child.id)
    }
  }
  return result
}

export function collectAncestors(id: string, index: Map<string, Task>): Task[] {
  const result: Task[] = []
  const visited = new Set([id])
  let cursor = index.get(id)?.parentId ?? ""
  while (cursor && !visited.has(cursor)) {
    visited.add(cursor)
    const parent = index.get(cursor)
    if (!parent) break
    result.push(parent)
    cursor = parent.parentId
  }
  return result
}

export function isSelfOrDescendant(candidateId: string, rootId: string, index: Map<string, Task>): boolean {
  return candidateId === rootId || collectDescendants(rootId, index).some((task) => task.id === candidateId)
}

export function siblingsOf(task: Task, index: Map<string, Task>, includeSelf = true): Task[] {
  const key = siblingKey(task)
  return Array.from(index.values())
    .filter((item) => siblingKey(item) === key && !item.trashed && (includeSelf || item.id !== task.id))
    .sort(manualCompare)
}

export function previousSibling(task: Task, index: Map<string, Task>): Task | undefined {
  const siblings = siblingsOf(task, index)
  const at = siblings.findIndex((item) => item.id === task.id)
  return at > 0 ? siblings[at - 1] : undefined
}

export function subtreeIds(rootId: string, index: Map<string, Task>): string[] {
  return [rootId, ...collectDescendants(rootId, index).map((task) => task.id)]
}

export function withAncestors(matched: Set<string>, index: Map<string, Task>): Set<string> {
  const result = new Set(matched)
  for (const id of matched) {
    const source = index.get(id)
    if (!source) continue
    let cursor = source.parentId
    const visited = new Set([id])
    while (cursor && !visited.has(cursor)) {
      visited.add(cursor)
      const parent = index.get(cursor)
      if (!parent || parent.space !== source.space || parent.trashed !== source.trashed) break
      result.add(cursor)
      cursor = parent.parentId
    }
  }
  return result
}

export function validateTaskForest(tasks: Task[], expectedSpace?: Task["space"]): void {
  const index = new Map<string, Task>()
  for (const task of tasks) {
    if (!task.id) throw new Error("任务 ID 不能为空")
    if (index.has(task.id)) throw new Error(`任务 ID 重复：${task.id}`)
    if (expectedSpace && task.space !== expectedSpace) throw new Error(`任务空间错误：${task.id}`)
    index.set(task.id, task)
  }
  for (const task of tasks) {
    if (!task.parentId) continue
    if (task.parentId === task.id) throw new Error(`任务不能以自己为父级：${task.id}`)
    const parent = index.get(task.parentId)
    if (!parent) throw new Error(`父任务不存在：${task.id} → ${task.parentId}`)
    if (parent.space !== task.space) throw new Error(`父子任务不能跨空间：${task.id}`)
    if (task.space === "siyuan" && parent.rootId !== task.rootId) {
      throw new Error(`思源父子任务必须属于同一文档：${task.id}`)
    }
    const visited = new Set([task.id])
    let cursor: string = parent.id
    while (cursor) {
      if (visited.has(cursor)) throw new Error(`任务父子关系存在环：${task.id}`)
      visited.add(cursor)
      cursor = index.get(cursor)?.parentId ?? ""
    }
  }
}
