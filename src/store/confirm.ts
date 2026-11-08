import { shallowRef } from "vue"

export interface ConfirmRequest {
  title: string
  message: string
  confirmLabel: string
  cancelLabel: string
  danger?: boolean
}

interface QueuedConfirm extends ConfirmRequest {
  resolve: (confirmed: boolean) => void
}

const queue: QueuedConfirm[] = []
export const activeConfirm = shallowRef<QueuedConfirm | null>(null)

function showNext(): void {
  activeConfirm.value = queue.shift() ?? null
}

export function requestConfirm(request: ConfirmRequest): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    queue.push({ ...request, resolve })
    if (!activeConfirm.value) showNext()
  })
}

export function resolveConfirm(confirmed: boolean): void {
  const current = activeConfirm.value
  if (!current) return
  activeConfirm.value = null
  current.resolve(confirmed)
  showNext()
}

export function cancelAllConfirms(): void {
  const pending: QueuedConfirm[] = []
  const current = activeConfirm.value
  if (current) pending.push(current)
  pending.push(...queue.splice(0))
  activeConfirm.value = null
  for (const request of pending) request.resolve(false)
}
