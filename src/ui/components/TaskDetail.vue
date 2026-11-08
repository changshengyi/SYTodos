<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue"

import { buildTreeRows } from "@/core/filter"
import { createEmptyForm, diffForm, formFromTask } from "@/core/form"
import type { TaskForm, TaskFormField } from "@/core/form"
import { collectDescendants } from "@/core/tree"
import type { Task, TaskPatch } from "@/core/types"
import { activeConfirm } from "@/store/confirm"
import { discardDraft, draftState, draftValues, flushAllDrafts, flushDraft, hasDraft, stageDraft } from "@/store/drafts"
import { openInNote } from "@/store/host"
import { strings } from "@/store/i18n"
import { moveTask, postponeOneDay, restoreTask, taskIndex, taskState, toggleDone, updateTask } from "@/store/tasks"
import { ui } from "@/store/ui"

import TaskFormFields from "./TaskFormFields.vue"
import { useTasks } from "../useTasks"
import { deleteForeverWithConfirmation, trashWithConfirmation } from "../useDeleteActions"

const { categories } = useTasks()
const task = computed(() => {
  void taskState.version
  return ui.detailId ? taskIndex().get(ui.detailId) : undefined
})
const form = ref<TaskForm>(createEmptyForm())
const busy = ref(false)
const draftSaving = computed(() => {
  void draftState.version
  return !!task.value && hasDraft(task.value.id)
})
const noCollapse = new Set<string>()
const textFields: TaskFormField[] = ["title", "category", "note"]
const parentOptions = computed(() => {
  void taskState.version
  const current = task.value
  if (!current) return []
  const blocked = new Set([current.id, ...collectDescendants(current.id, taskIndex()).map((item) => item.id)])
  const matched = new Set(
    Array.from(taskIndex().values())
      .filter((item) => item.space === current.space && item.trashed === current.trashed && !blocked.has(item.id))
      .map((item) => item.id),
  )
  return buildTreeRows(taskIndex(), matched, "manual", noCollapse).flatMap((row) => {
    if (row.kind !== "task") return []
    const item = taskIndex().get(row.id)
    return item ? [{ id: item.id, depth: row.depth, title: item.title }] : []
  })
})

function editableForm(source: Task): TaskForm {
  return { ...formFromTask(source), ...draftValues(source.id) }
}

watch(
  () => ui.detailId,
  (id, previousId) => {
    if (previousId && previousId !== id) void flushDraft(previousId)
    if (id && task.value) form.value = editableForm(task.value)
  },
  { immediate: true },
)
watch(task, (next) => {
  if (next && !hasDraft(next.id) && !busy.value) form.value = formFromTask(next)
})
watch(draftSaving, (saving) => {
  if (!saving && task.value && !busy.value) form.value = editableForm(task.value)
})

async function onUpdate(next: TaskForm): Promise<void> {
  const previous = form.value
  const patch = diffForm(previous, next)
  form.value = next
  const current = task.value
  if (!current) return
  const id = current.id
  if (patch.parentId !== undefined) {
    busy.value = true
    const parent = patch.parentId ? taskIndex().get(patch.parentId) : undefined
    const ok = await moveTask(id, {
      parentId: patch.parentId,
      docId: parent?.rootId || current.rootId,
      position: "last",
    })
    busy.value = false
    if (!ok) {
      form.value = editableForm(taskIndex().get(id) ?? current)
      return
    }
  }
  const immediate: TaskPatch = {}
  for (const key of ["priority", "status", "start", "due", "repeat"] as const) {
    if (patch[key] !== undefined) Object.assign(immediate, { [key]: patch[key] })
  }
  if (Object.keys(immediate).length) {
    busy.value = true
    const ok = await updateTask(id, immediate)
    busy.value = false
    if (!ok) {
      form.value = editableForm(taskIndex().get(id) ?? current)
      return
    }
  }
  const text: TaskPatch = {}
  for (const key of textFields) {
    if (patch[key] !== undefined) Object.assign(text, { [key]: patch[key] })
  }
  if (Object.keys(text).length) stageDraft(id, text)
}

async function close(): Promise<void> {
  const id = ui.detailId
  if (id && !(await flushDraft(id))) return
  if (ui.detailId === id) ui.detailId = ""
}

async function remove(): Promise<void> {
  const current = task.value
  if (!current) return
  const id = current.id
  const ok = await deleteForeverWithConfirmation([id], () => {
    discardDraft(id)
    return true
  })
  if (ok) ui.detailId = ""
}

async function setTrash(trashed: boolean): Promise<void> {
  const id = task.value?.id
  if (!id) return
  if (trashed) {
    const ok = await trashWithConfirmation([id], () => flushDraft(id))
    if (ok) ui.detailId = ""
    return
  }
  if (!(await flushDraft(id))) return
  if (await restoreTask(id)) ui.detailId = ""
}

function onKeydown(event: KeyboardEvent): void {
  if (activeConfirm.value) return
  if (event.key === "Escape") {
    event.preventDefault()
    void close()
  }
}
onMounted(() => window.addEventListener("keydown", onKeydown))
onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeydown)
  void flushAllDrafts()
})
</script>

<template>
  <div v-if="task" class="bt-modal" @click.self="close">
    <section class="bt-modal__panel bt-modal__panel--detail" role="dialog" aria-modal="true">
      <header class="bt-modal__head">
        <button type="button" class="bt-check" :class="{ 'bt-check--on': task.status === 'done' }" @click="toggleDone(task.id)">
          <svg class="bt-check__icon" aria-hidden="true"><use xlink:href="#iconCheck" /></svg>
        </button>
        <span class="bt-modal__title">{{ form.title || strings.taskTitle }}</span>
        <span v-if="draftSaving || busy" class="bt-modal__space">{{ strings.saving || '保存中…' }}</span>
        <button type="button" class="bt-icon-btn" @click="close"><svg aria-hidden="true"><use xlink:href="#iconClose" /></svg></button>
      </header>
      <div class="bt-modal__body">
        <TaskFormFields :model-value="form" :parent-options="parentOptions" :categories="categories" @update:model-value="onUpdate" />
        <p v-if="taskState.error" class="bt-form-error" role="alert">{{ taskState.error }}</p>
        <div class="bt-detail__meta">
          <template v-if="task.space === 'siyuan'">
            <span class="bt-detail__meta-label">{{ strings.groupDoc }}</span>
            <button type="button" class="bt-btn bt-btn--link" @click="openInNote(task.rootId, task.id)">{{ task.hpath || task.rootId }}</button>
          </template>
          <template v-else>
            <span class="bt-detail__meta-label">{{ strings.spaceTitle }}</span>
            <span class="bt-detail__meta-value">{{ strings.spaceLocal }}</span>
          </template>
        </div>
      </div>
      <footer class="bt-modal__foot">
        <button type="button" class="bt-btn bt-btn--ghost" @click="postponeOneDay(task.id)">{{ strings.postpone || '顺延一天' }}</button>
        <button v-if="task.trashed" type="button" class="bt-btn bt-btn--ghost" @click="setTrash(false)">{{ strings.restoreOne }}</button>
        <button v-if="task.trashed" type="button" class="bt-btn bt-btn--danger" @click="remove">{{ strings.deleteForever }}</button>
        <button v-else type="button" class="bt-btn bt-btn--danger" @click="setTrash(true)">{{ strings.trashOne }}</button>
        <span class="bt-modal__hint" />
        <button type="button" class="bt-btn" @click="close">{{ strings.closeDetail }}</button>
      </footer>
    </section>
  </div>
</template>
