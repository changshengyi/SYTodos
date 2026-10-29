import { ref } from "vue"

import type { UndoEntry } from "@/core/types"

const MAX_STACK = 40

const undoStack = ref<UndoEntry[]>([])
const redoStack = ref<UndoEntry[]>([])

export function pushUndo(entry: UndoEntry): void {
  undoStack.value.push(entry)
  if (undoStack.value.length > MAX_STACK) {
    undoStack.value.shift()
  }
  redoStack.value = []
}

export async function undo(): Promise<UndoEntry | undefined> {
  const entry = undoStack.value.pop()
  if (!entry) {
    return undefined
  }
  await entry.undo()
  redoStack.value.push(entry)
  return entry
}

export async function redo(): Promise<UndoEntry | undefined> {
  const entry = redoStack.value.pop()
  if (!entry) {
    return undefined
  }
  await entry.redo?.()
  undoStack.value.push(entry)
  return entry
}
