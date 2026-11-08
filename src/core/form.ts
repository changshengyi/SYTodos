import { parseDate, parseRepeat, todayEnd, todayStart } from "./date"
import type { Priority, Task, TaskStatus } from "./types"

export interface TaskForm {
  title: string
  parentId: string
  priority: Priority
  status: TaskStatus
  start: string
  due: string
  repeat: string
  category: string
  note: string
}

export type TaskFormField = keyof TaskForm

export function createEmptyForm(): TaskForm {
  return {
    title: "",
    parentId: "",
    priority: 2,
    status: "todo",
    start: todayStart(),
    due: todayEnd(),
    repeat: "",
    category: "",
    note: "",
  }
}

export function formFromTask(task: Task): TaskForm {
  return {
    title: task.title,
    parentId: task.parentId,
    priority: task.priority,
    status: task.status,
    start: task.start,
    due: task.due,
    repeat: task.repeat,
    category: task.category,
    note: task.note,
  }
}

export function validateForm(form: TaskForm): TaskFormField[] {
  const invalid: TaskFormField[] = []
  if (!form.title.trim()) invalid.push("title")
  if (form.start && !parseDate(form.start)) invalid.push("start")
  if (form.due && !parseDate(form.due)) invalid.push("due")
  if (form.repeat && !parseRepeat(form.repeat)) invalid.push("repeat")
  if (form.start && form.due && parseDate(form.start) && parseDate(form.due)) {
    if ((parseDate(form.start) as Date).getTime() > (parseDate(form.due) as Date).getTime()) {
      invalid.push("start", "due")
    }
  }
  return Array.from(new Set(invalid))
}

export function isFormValid(form: TaskForm): boolean {
  return validateForm(form).length === 0
}

export function diffForm(previous: TaskForm, next: TaskForm): Partial<TaskForm> {
  const patch: Partial<TaskForm> = {}
  for (const key of Object.keys(next) as TaskFormField[]) {
    if (previous[key] !== next[key]) patch[key] = next[key] as never
  }
  return patch
}
