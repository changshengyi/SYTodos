import { computed, ref } from "vue"

import { collectDescendants } from "@/core/tree"
import { moveTask, taskIndex } from "@/store/tasks"
import { ui } from "@/store/ui"

export type DropZone = "" | "before" | "after" | "inside"

export function useTaskDrag() {
  const dragId = ref("")
  const dropId = ref("")
  const dropZone = ref<DropZone>("")
  const blockedIds = ref<Set<string>>(new Set())
  const enabled = computed(() => ui.mode === "tree" && ui.sortBy === "manual" && ui.groupBy === "none" && ui.view !== "trash")

  function reset(): void {
    dragId.value = ""
    dropId.value = ""
    dropZone.value = ""
    blockedIds.value = new Set()
  }

  function start(id: string, event: DragEvent): void {
    if (!enabled.value) {
      event.preventDefault()
      return
    }
    const source = taskIndex().get(id)
    if (!source) return
    dragId.value = id
    blockedIds.value = new Set([id, ...collectDescendants(id, taskIndex()).map((task) => task.id)])
    event.dataTransfer?.setData("text/plain", id)
    if (event.dataTransfer) event.dataTransfer.effectAllowed = "move"
  }

  function zoneOf(event: DragEvent): DropZone {
    const element = event.currentTarget as HTMLElement | null
    if (!element) return "inside"
    const rect = element.getBoundingClientRect()
    const ratio = (event.clientY - rect.top) / Math.max(1, rect.height)
    return ratio < 0.3 ? "before" : ratio > 0.7 ? "after" : "inside"
  }

  function validTarget(id: string): boolean {
    const source = taskIndex().get(dragId.value)
    const target = taskIndex().get(id)
    return !!source && !!target && source.space === target.space && source.trashed === target.trashed && !blockedIds.value.has(id)
  }

  function over(id: string, event: DragEvent): void {
    if (!enabled.value || !validTarget(id)) return
    event.preventDefault()
    dropId.value = id
    dropZone.value = zoneOf(event)
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move"
  }

  async function drop(id: string, event: DragEvent): Promise<boolean> {
    const source = dragId.value
    const zone = zoneOf(event)
    const valid = validTarget(id)
    const target = taskIndex().get(id)
    reset()
    if (!source || !valid || !target) return false
    if (zone === "inside") return moveTask(source, { parentId: id, position: "last" })
    return moveTask(source, {
      parentId: target.parentId,
      docId: target.rootId,
      containerId: target.containerId,
      position: zone === "before" ? "before" : "after",
      anchorId: id,
    })
  }

  function zoneFor(id: string): DropZone {
    return dropId.value === id ? dropZone.value : ""
  }

  return { dragId, enabled, start, over, drop, reset, zoneFor }
}
