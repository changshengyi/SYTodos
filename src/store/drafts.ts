import { reactive } from "vue"

import type { TaskPatch } from "@/core/types"

import { updateTask } from "./tasks"

interface PendingDraft {
  values: TaskPatch
  timer?: ReturnType<typeof setTimeout>
}

const pending = new Map<string, PendingDraft>()
const saving = new Map<string, Promise<boolean>>()
export const draftState = reactive({ version: 0 })

function changed(): void {
  draftState.version++
}

export function stageDraft(id: string, patch: TaskPatch): void {
  const draft = pending.get(id) ?? { values: {} }
  Object.assign(draft.values, patch)
  if (draft.timer) clearTimeout(draft.timer)
  draft.timer = setTimeout(() => void flushDraft(id), 400)
  pending.set(id, draft)
  changed()
}

export function hasDraft(id: string): boolean {
  return pending.has(id) || saving.has(id)
}

export function draftValues(id: string): TaskPatch | undefined {
  const draft = pending.get(id)
  return draft ? { ...draft.values } : undefined
}

export function flushDraft(id: string): Promise<boolean> {
  const existing = saving.get(id)
  if (existing) return existing
  const current = pending.get(id)
  if (current?.timer) clearTimeout(current.timer)

  const run = (async () => {
    while (pending.has(id)) {
      const draft = pending.get(id) as PendingDraft
      pending.delete(id)
      const ok = await updateTask(id, draft.values)
      if (!ok) {
        const newer = pending.get(id)
        pending.set(id, {
          values: { ...draft.values, ...newer?.values },
          timer: newer?.timer,
        })
        return false
      }
    }
    return true
  })()
  saving.set(id, run)
  changed()
  return run.finally(() => {
    saving.delete(id)
    changed()
  })
}

export async function flushAllDrafts(): Promise<boolean> {
  let allSaved = true
  while (pending.size || saving.size) {
    const ids = new Set([...pending.keys(), ...saving.keys()])
    const results = await Promise.all(Array.from(ids, flushDraft))
    if (results.some((result) => !result)) {
      allSaved = false
      break
    }
  }
  return allSaved && pending.size === 0
}

export function discardDraft(id: string): void {
  const draft = pending.get(id)
  if (draft?.timer) clearTimeout(draft.timer)
  pending.delete(id)
  changed()
}
