import { redo as redoTask, taskState, undo as undoTask } from "./tasks"

export const canUndo = () => taskState.undoDepth > 0
export const canRedo = () => taskState.redoDepth > 0

export function undo(): Promise<boolean> {
  return undoTask()
}

export function redo(): Promise<boolean> {
  return redoTask()
}
