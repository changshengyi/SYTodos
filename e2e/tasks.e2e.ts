import { expect, test } from "@playwright/test"
import type { Page } from "@playwright/test"

async function openApp(page: Page): Promise<void> {
  await page.goto("/e2e/harness.html")
  await expect(page.locator(".bt-app")).toBeVisible()
}

async function createTask(page: Page, title: string): Promise<void> {
  await page.getByTitle("新建任务").click()
  const dialog = page.getByRole("dialog")
  await dialog.getByPlaceholder("待办标题").fill(title)
  await dialog.getByRole("button", { name: "确认添加" }).click()
  await expect(page.locator(".bt-row__title", { hasText: title })).toBeVisible()
}

async function createSubtask(page: Page, parentTitle: string, title: string): Promise<void> {
  const row = page.locator(".bt-row", { hasText: parentTitle })
  await row.hover()
  await row.getByTitle("新建子任务").click()
  const dialog = page.getByRole("dialog")
  await dialog.getByPlaceholder("待办标题").fill(title)
  await dialog.getByRole("button", { name: "确认添加" }).click()
  await expect(page.locator(".bt-row__title", { hasText: title })).toBeVisible()
}

async function readArchive(page: Page): Promise<{ tasks: { id: string; title: string; parentId: string; status: string; note: string; trashed: boolean }[] }> {
  const raw = await page.evaluate(() => localStorage.getItem("sytodos-e2e:sytodos-local-v2"))
  return JSON.parse(raw || '{"tasks":[]}')
}

async function confirmDeletion(page: Page, action: string): Promise<void> {
  const dialog = page.getByRole("alertdialog")
  await expect(dialog).toBeVisible()
  await dialog.getByRole("button", { name: action, exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await page.evaluate(() => window.__sytodos.flush())
}

test("创建全字段任务、父子关系并在刷新后恢复", async ({ page }) => {
  await openApp(page)
  await createTask(page, "项目根任务")
  await createSubtask(page, "项目根任务", "拆解子任务")
  await page.evaluate(() => window.__sytodos.flush())
  const archive = await readArchive(page)
  const parent = archive.tasks.find((task) => task.title === "项目根任务")
  const child = archive.tasks.find((task) => task.title === "拆解子任务")
  expect(parent).toBeDefined()
  expect(child?.parentId).toBe(parent?.id)
  await page.reload()
  await expect(page.locator(".bt-row__title", { hasText: "项目根任务" })).toBeVisible()
  await expect(page.locator(".bt-row__title", { hasText: "拆解子任务" })).toBeVisible()
})

test("详情自动保存和看板拖拽真实提交", async ({ page }) => {
  await openApp(page)
  await createTask(page, "需要补充备注")
  const row = page.locator(".bt-row", { hasText: "需要补充备注" })
  await row.locator(".bt-row__meta").dblclick()
  const dialog = page.getByRole("dialog")
  await dialog.locator("textarea").fill("第一行\n第二行")
  await dialog.getByRole("button", { name: "收起详情" }).click()
  await page.evaluate(() => window.__sytodos.flush())
  await page.reload()
  const reloadedRow = page.locator(".bt-row", { hasText: "需要补充备注" })
  await reloadedRow.locator(".bt-row__meta").dblclick()
  await expect(page.getByRole("dialog").locator("textarea")).toHaveValue("第一行\n第二行")
  await page.getByRole("dialog").getByRole("button", { name: "收起详情" }).click()

  await page.getByRole("button", { name: "看板", exact: true }).click()
  const card = page.locator(".bt-card", { hasText: "需要补充备注" })
  await card.dragTo(page.locator(".bt-col--doing .bt-col__body"))
  await page.evaluate(() => window.__sytodos.flush())
  await expect(page.locator(".bt-col--doing .bt-card", { hasText: "需要补充备注" })).toBeVisible()
  expect((await readArchive(page)).tasks[0].status).toBe("doing")
})

test("键盘缩进、撤销重做和回收站子树删除", async ({ page }) => {
  await openApp(page)
  await createTask(page, "父级 A")
  await createTask(page, "任务 B")
  await page.getByRole("button", { name: "树形", exact: true }).click()
  await page.locator(".bt-row__title", { hasText: "任务 B" }).click()
  await page.keyboard.press("Tab")
  await page.evaluate(() => window.__sytodos.flush())
  let archive = await readArchive(page)
  expect(archive.tasks.find((task) => task.title === "任务 B")?.parentId).toBe(archive.tasks.find((task) => task.title === "父级 A")?.id)

  await page.getByTitle("撤销").click()
  expect((await readArchive(page)).tasks.find((task) => task.title === "任务 B")?.parentId).toBe("")
  await page.getByTitle("重做").click()
  expect((await readArchive(page)).tasks.find((task) => task.title === "任务 B")?.parentId).not.toBe("")

  const parentRow = page.locator(".bt-row", { hasText: "父级 A" })
  await parentRow.getByTitle("移入回收站").click()
  await confirmDeletion(page, "移入回收站")
  await page.getByTitle("高级搜索").click()
  await page.getByRole("button", { name: /回收站/ }).click()
  await expect(page.locator(".bt-row__title", { hasText: "父级 A" })).toBeVisible()
  await expect(page.locator(".bt-row__title", { hasText: "任务 B" })).toBeVisible()
  await page.getByRole("button", { name: "清空回收站" }).click()
  await confirmDeletion(page, "清空回收站")
  archive = await readArchive(page)
  expect(archive.tasks).toHaveLength(0)
})

test("列表严格平铺，树形显示层级，看板按状态分列", async ({ page }) => {
  await openApp(page)
  await createTask(page, "视图父任务")
  await createSubtask(page, "视图父任务", "视图子任务")
  await page.evaluate(() => window.__sytodos.flush())
  const archive = await readArchive(page)
  const parent = archive.tasks.find((task) => task.title === "视图父任务")
  const child = archive.tasks.find((task) => task.title === "视图子任务")
  expect(parent).toBeDefined()
  expect(child?.parentId).toBe(parent?.id)

  const listRows = page.locator(".bt-row")
  await expect(listRows).toHaveCount(2)
  await expect(page.locator(".bt-row--flat")).toHaveCount(2)
  await expect(page.locator("button.bt-caret")).toHaveCount(0)
  const listDepths = await listRows.evaluateAll((rows) => rows.map((row) => (row as HTMLElement).style.getPropertyValue("--bt-depth")))
  expect(listDepths).toEqual(["0", "0"])

  await page.locator(".bt-row__title", { hasText: "视图子任务" }).click()
  await page.keyboard.press("Shift+Tab")
  await page.evaluate(() => window.__sytodos.flush())
  expect((await readArchive(page)).tasks.find((task) => task.id === child?.id)?.parentId).toBe(parent?.id)

  await page.getByRole("button", { name: "树形", exact: true }).click()
  await expect(page.locator("button.bt-caret")).toHaveCount(1)
  const treeDepths = await page.locator(".bt-row").evaluateAll((rows) => rows.map((row) => (row as HTMLElement).style.getPropertyValue("--bt-depth")))
  expect(treeDepths).toContain("1")
  await page.locator("button.bt-caret").click()
  await expect(page.locator(".bt-row__title", { hasText: "视图子任务" })).toHaveCount(0)

  await page.getByRole("button", { name: "看板", exact: true }).click()
  await expect(page.locator(".bt-col--todo .bt-card")).toHaveCount(2)
})

test("删除确认框可取消，确认后才提交删除", async ({ page }) => {
  await openApp(page)
  await createTask(page, "确认删除任务")
  const row = page.locator(".bt-row", { hasText: "确认删除任务" })
  await row.getByTitle("移入回收站").click()

  const dialog = page.getByRole("alertdialog")
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText("确认移入回收站")
  await expect(dialog).toContainText("确认删除任务")
  await dialog.getByRole("button", { name: "取消", exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(row).toBeVisible()
  expect((await readArchive(page)).tasks[0].trashed).toBe(false)

  await page.locator(".bt-row__title", { hasText: "确认删除任务" }).click()
  await page.keyboard.press("Delete")
  await confirmDeletion(page, "移入回收站")
  await expect(page.locator(".bt-row__title", { hasText: "确认删除任务" })).toHaveCount(0)
  expect((await readArchive(page)).tasks[0].trashed).toBe(true)
})
