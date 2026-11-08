import { describe, expect, it } from "vitest"

import { activeConfirm, cancelAllConfirms, requestConfirm, resolveConfirm } from "@/store/confirm"

function request(title: string) {
  return { title, message: `${title} message`, confirmLabel: "Delete", cancelLabel: "Cancel", danger: true }
}

describe("统一确认队列", () => {
  it("多个请求顺序展示且分别返回各自的确认结果", async () => {
    const first = requestConfirm(request("first"))
    const second = requestConfirm(request("second"))
    expect(activeConfirm.value?.title).toBe("first")

    resolveConfirm(true)
    await expect(first).resolves.toBe(true)
    expect(activeConfirm.value?.title).toBe("second")

    resolveConfirm(false)
    await expect(second).resolves.toBe(false)
    expect(activeConfirm.value).toBeNull()
  })

  it("界面卸载时所有待确认请求都按取消处理", async () => {
    const first = requestConfirm(request("first"))
    const second = requestConfirm(request("second"))
    cancelAllConfirms()
    await expect(first).resolves.toBe(false)
    await expect(second).resolves.toBe(false)
    expect(activeConfirm.value).toBeNull()
  })
})
