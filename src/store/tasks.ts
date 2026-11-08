import { reactive } from "vue"

import { addDays, today } from "@/core/date"
import type {
  CreateTaskInput,
  MoveTaskInput,
  Priority,
  SpaceId,
  Task,
  TaskPatch,
  TaskStatus,
} from "@/core/types"
import type { TaskRepository } from "@/data/repository"

import { TaskService, createTaskServiceState } from "./taskService"

export const taskState = reactive(createTaskServiceState())

let service: TaskService | undefined
let syncTimer: ReturnType<typeof setTimeout> | undefined

export function configureTaskService(options: {
  repositories: Record<SpaceId, TaskRepository>
  resolveDefaultDoc: () => Promise<string>
  shouldAdvanceRepeat: () => boolean
  notify: (message: string) => void | Promise<void>
}): TaskService {
  service = new TaskService(options.repositories, taskState, {
    resolveDefaultDoc: options.resolveDefaultDoc,
    shouldAdvanceRepeat: options.shouldAdvanceRepeat,
    notify: options.notify,
  })
  return service
}

function tasks(): TaskService {
  if (!service) throw new Error("任务服务尚未初始化")
  return service
}

export function taskIndex(): Map<string, Task> {
  return taskState.tasks
}

export function listTasks(): Task[] {
  return Array.from(taskState.tasks.values())
}

export function loadAll(): Promise<boolean> {
  return tasks().refresh()
}

export function scheduleSync(): void {
  if (syncTimer) clearTimeout(syncTimer)
  syncTimer = setTimeout(() => {
    syncTimer = undefined
    void loadAll()
  }, 250)
}

export function cancelScheduledSync(): void {
  if (syncTimer) clearTimeout(syncTimer)
  syncTimer = undefined
}

export function createTask(input: CreateTaskInput): Promise<Task | undefined> {
  return tasks().createTask(input)
}

export function updateTask(id: string, patch: TaskPatch): Promise<boolean> {
  return tasks().updateTask(id, patch)
}

export function setTitle(id: string, title: string): Promise<boolean> {
  return updateTask(id, { title })
}

export function setStatus(id: string, status: TaskStatus): Promise<boolean> {
  return updateTask(id, { status })
}

export function setPriority(id: string, priority: Priority): Promise<boolean> {
  return updateTask(id, { priority })
}

export function setStart(id: string, start: string): Promise<boolean> {
  return updateTask(id, { start })
}

export function setDue(id: string, due: string): Promise<boolean> {
  return updateTask(id, { due })
}

export function setRepeat(id: string, repeat: string): Promise<boolean> {
  return updateTask(id, { repeat })
}

export function setCategory(id: string, category: string): Promise<boolean> {
  return updateTask(id, { category })
}

export function setNote(id: string, note: string): Promise<boolean> {
  return updateTask(id, { note })
}

export function toggleDone(id: string): Promise<boolean> {
  return tasks().toggleDone(id)
}

export function trashTask(id: string): Promise<boolean> {
  return tasks().setTrashed(id, true)
}

export function restoreTask(id: string): Promise<boolean> {
  return tasks().setTrashed(id, false)
}

export function removeForever(id: string): Promise<boolean> {
  return tasks().deleteTask(id)
}

export function emptyTrash(space: SpaceId): Promise<boolean> {
  return tasks().emptyTrash(space)
}

export function moveTask(id: string, input: MoveTaskInput): Promise<boolean> {
  return tasks().moveTask(id, input)
}

export function indentTask(id: string): Promise<boolean> {
  return tasks().indentTask(id)
}

export function outdentTask(id: string): Promise<boolean> {
  return tasks().outdentTask(id)
}

export function postponeOneDay(id: string): Promise<boolean> {
  const task = taskState.tasks.get(id)
  if (!task) return Promise.resolve(false)
  return updateTask(id, { due: addDays(task.due || today(), 1) })
}

export function undo(): Promise<boolean> {
  return tasks().undo()
}

export function redo(): Promise<boolean> {
  return tasks().redo()
}

export function flushTasks(): Promise<void> {
  return service?.flush() ?? Promise.resolve()
}
