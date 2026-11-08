import { collectAncestors } from "@/core/tree"
import type { SpaceId } from "@/core/types"
import { requestConfirm } from "@/store/confirm"
import type { ConfirmRequest } from "@/store/confirm"
import { strings, t } from "@/store/i18n"
import { emptyTrash, listTasks, removeForever, taskIndex, trashTask } from "@/store/tasks"

type BeforeDelete = () => boolean | Promise<boolean>

function topLevelIds(ids: string[]): string[] {
  const index = taskIndex()
  const valid = Array.from(new Set(ids.filter((id) => index.has(id))))
  const selected = new Set(valid)
  return valid.filter((id) => !collectAncestors(id, index).some((ancestor) => selected.has(ancestor.id)))
}

function baseLabels(action: string): Pick<ConfirmRequest, "confirmLabel" | "cancelLabel" | "danger"> {
  return {
    confirmLabel: action,
    cancelLabel: strings.cancel || "取消",
    danger: true,
  }
}

function taskTitle(id: string): string {
  return taskIndex().get(id)?.title || t("taskTitle", "未命名任务")
}

function trashRequest(ids: string[]): ConfirmRequest {
  return {
    title: t("confirmTrashTitle", "确认移入回收站"),
    message:
      ids.length === 1
        ? t("confirmTrashOne", "确定把「{title}」移入回收站吗？其子任务也会一起移入，可在回收站恢复。", {
            title: taskTitle(ids[0]),
          })
        : t("confirmTrashMany", "确定把选中的 {n} 条任务移入回收站吗？它们的子任务也会一起移入，可在回收站恢复。", {
            n: ids.length,
          }),
    ...baseLabels(strings.trashOne || "移入回收站"),
  }
}

function deleteRequest(ids: string[]): ConfirmRequest {
  return {
    title: t("confirmDeleteTitle", "确认永久删除"),
    message:
      ids.length === 1
        ? t("confirmDeleteOne", "确定永久删除「{title}」及其全部子任务吗？此操作无法撤销。", {
            title: taskTitle(ids[0]),
          })
        : t("confirmDeleteMany", "确定永久删除选中的 {n} 条任务及其全部子任务吗？此操作无法撤销。", {
            n: ids.length,
          }),
    ...baseLabels(strings.deleteForever || "永久删除"),
  }
}

async function prepare(beforeDelete?: BeforeDelete): Promise<boolean> {
  return !beforeDelete || (await beforeDelete())
}

export async function trashWithConfirmation(ids: string[], beforeDelete?: BeforeDelete): Promise<boolean> {
  const roots = topLevelIds(ids)
  if (!roots.length || !(await requestConfirm(trashRequest(roots)))) return false
  if (!(await prepare(beforeDelete))) return false
  let ok = true
  for (const id of roots) ok = (await trashTask(id)) && ok
  return ok
}

export async function deleteForeverWithConfirmation(ids: string[], beforeDelete?: BeforeDelete): Promise<boolean> {
  const roots = topLevelIds(ids)
  if (!roots.length || !(await requestConfirm(deleteRequest(roots)))) return false
  if (!(await prepare(beforeDelete))) return false
  let ok = true
  for (const id of roots) ok = (await removeForever(id)) && ok
  return ok
}

export async function emptyTrashWithConfirmation(space: SpaceId): Promise<boolean> {
  const trashed = listTasks().filter((task) => task.space === space && task.trashed)
  const roots = trashed.filter((task) => !task.parentId || !taskIndex().get(task.parentId)?.trashed)
  if (!roots.length) return false
  const request: ConfirmRequest = {
    title: t("confirmEmptyTrashTitle", "确认清空回收站"),
    message: t("emptyTrashConfirm", "确定清空回收站吗？共 {n} 条待办会被永久删除。", { n: trashed.length }),
    ...baseLabels(strings.emptyTrash || "清空回收站"),
  }
  if (!(await requestConfirm(request))) return false
  return emptyTrash(space)
}
