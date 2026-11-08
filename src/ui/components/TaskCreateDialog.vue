<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue"

import { buildTreeRows } from "@/core/filter"
import { createEmptyForm, isFormValid } from "@/core/form"
import type { TaskForm } from "@/core/form"
import { activeConfirm } from "@/store/confirm"
import { strings } from "@/store/i18n"
import { createTask, taskIndex, taskState } from "@/store/tasks"
import { ui } from "@/store/ui"

import TaskFormFields from "./TaskFormFields.vue"
import { useTasks } from "../useTasks"

const { categories } = useTasks()
const form = ref<TaskForm>({ ...createEmptyForm(), parentId: ui.createParentId })
const busy = ref(false)
const fields = ref<InstanceType<typeof TaskFormFields> | null>(null)
const valid = computed(() => isFormValid(form.value))
const noCollapse = new Set<string>()
const parentOptions = computed(() => {
  void taskState.version
  const matched = new Set(
    Array.from(taskIndex().values())
      .filter((task) => task.space === ui.space && !task.trashed)
      .map((task) => task.id),
  )
  return buildTreeRows(taskIndex(), matched, "manual", noCollapse).flatMap((row) => {
    if (row.kind !== "task") return []
    const task = taskIndex().get(row.id)
    return task ? [{ id: task.id, depth: row.depth, title: task.title }] : []
  })
})

function close(): void {
  if (!busy.value) ui.showCreate = false
}

async function submit(): Promise<void> {
  if (!valid.value || busy.value) return
  busy.value = true
  try {
    const task = await createTask({
      ...form.value,
      title: form.value.title,
      category: form.value.category.trim(),
      space: ui.space,
      parentId: form.value.parentId || undefined,
    })
    if (!task) return
    let parentId = task.parentId
    while (parentId) {
      ui.collapsed.delete(parentId)
      parentId = taskIndex().get(parentId)?.parentId ?? ""
    }
    ui.selectedId = task.id
    ui.showCreate = false
  } finally {
    busy.value = false
  }
}

function onKeydown(event: KeyboardEvent): void {
  if (activeConfirm.value) return
  if (event.key === "Escape") {
    event.preventDefault()
    close()
  } else if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    event.preventDefault()
    void submit()
  }
}

onMounted(() => {
  window.addEventListener("keydown", onKeydown)
  void nextTick(() => fields.value?.focusTitle())
})
onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKeydown)
  ui.createParentId = ""
})
</script>

<template>
  <div class="bt-modal" @click.self="close">
    <section class="bt-modal__panel" role="dialog" aria-modal="true" aria-labelledby="bt-create-title">
      <header class="bt-modal__head">
        <span id="bt-create-title" class="bt-modal__title">{{ strings.createTitle }}</span>
        <span class="bt-modal__space">{{ ui.space === 'local' ? strings.spaceLocal : strings.spaceSiyuan }}</span>
        <button type="button" class="bt-icon-btn" :disabled="busy" @click="close"><svg aria-hidden="true"><use xlink:href="#iconClose" /></svg></button>
      </header>
      <div class="bt-modal__body">
        <TaskFormFields ref="fields" v-model="form" :parent-options="parentOptions" :categories="categories" />
        <p v-if="taskState.error" class="bt-form-error" role="alert">{{ taskState.error }}</p>
      </div>
      <footer class="bt-modal__foot">
        <span class="bt-modal__hint">{{ strings.createHint }}</span>
        <button type="button" class="bt-btn" :disabled="busy" @click="close">{{ strings.cancel }}</button>
        <button type="button" class="bt-btn bt-btn--primary" :disabled="!valid || busy" @click="submit">
          {{ busy ? (strings.saving || '保存中…') : strings.createConfirm }}
        </button>
      </footer>
    </section>
  </div>
</template>
