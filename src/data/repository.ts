import type { ResolvedMove, SpaceId, Task, TaskChange, TaskDraft } from "@/core/types"

export interface CreateResult {
  created: Task
  snapshot: Task[]
}

/** 每个实现都对“方法返回时已经持久化”负责，并返回最新权威快照。 */
export interface TaskRepository {
  readonly space: SpaceId
  load(): Promise<Task[]>
  create(draft: TaskDraft, previousId: string): Promise<CreateResult>
  update(changes: TaskChange[]): Promise<Task[]>
  move(task: Task, target: ResolvedMove, original: ResolvedMove, changes: TaskChange[]): Promise<Task[]>
  delete(rootId: string): Promise<Task[]>
}

export function cloneTask(task: Task): Task {
  return { ...task }
}

export function cloneTasks(tasks: Iterable<Task>): Task[] {
  return Array.from(tasks, cloneTask)
}
