<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue"

import { activeConfirm, cancelAllConfirms } from "@/store/confirm"
import { settings } from "@/store/settings"
import { settingsState } from "@/store/settings"
import { indentTask, loadAll, outdentTask, taskState, toggleDone } from "@/store/tasks"
import { clearChecked, openCreate, ui } from "@/store/ui"
import { redo, undo } from "@/store/undo"

import AppSidebar from "@/ui/components/AppSidebar.vue"
import AppToolbar from "@/ui/components/AppToolbar.vue"
import ConfirmDialog from "@/ui/components/ConfirmDialog.vue"
import FilterBar from "@/ui/components/FilterBar.vue"
import SettingsPanel from "@/ui/components/SettingsPanel.vue"
import TaskBoardView from "@/ui/components/TaskBoardView.vue"
import TaskCreateDialog from "@/ui/components/TaskCreateDialog.vue"
import TaskDetail from "@/ui/components/TaskDetail.vue"
import TaskListView from "@/ui/components/TaskListView.vue"
import TaskTreeView from "@/ui/components/TaskTreeView.vue"
import { useTasks } from "@/ui/useTasks"
import { deleteForeverWithConfirmation, trashWithConfirmation } from "@/ui/useDeleteActions"

const { navigableIds } = useTasks()
const rootEl = ref<HTMLElement | null>(null)
const viewComponent = computed(() => (ui.mode === "board" ? TaskBoardView : ui.mode === "tree" ? TaskTreeView : TaskListView))

onMounted(() => rootEl.value?.focus())
onBeforeUnmount(cancelAllConfirms)
watch(() => [ui.mode, ui.view, ui.showSettings], () => {
  clearChecked()
  ui.editingId = ""
  rootEl.value?.focus()
})
watch(
  () => taskState.version,
  () => {
    if (ui.selectedId && !taskState.tasks.has(ui.selectedId)) ui.selectedId = ""
    if (ui.editingId && !taskState.tasks.has(ui.editingId)) ui.editingId = ""
    if (ui.detailId && !taskState.tasks.has(ui.detailId)) ui.detailId = ""
    for (const id of ui.checked) {
      const task = taskState.tasks.get(id)
      if (!task || task.space !== ui.space) ui.checked.delete(id)
    }
  },
)

function ensureVisible(id: string): void {
  rootEl.value?.querySelector(`[data-id="${id}"]`)?.scrollIntoView({ block: "nearest" })
}

function moveSelection(delta: number): void {
  const ids = navigableIds.value
  if (!ids.length) return
  const current = ids.indexOf(ui.selectedId)
  const next = current < 0 ? 0 : Math.min(ids.length - 1, Math.max(0, current + delta))
  ui.selectedId = ids[next]
  ui.editingId = ""
  ensureVisible(ui.selectedId)
}

function selectedVisible(): string[] {
  const visible = new Set(navigableIds.value)
  const ids = ui.checked.size ? Array.from(ui.checked) : ui.selectedId ? [ui.selectedId] : []
  return ids.filter((id) => visible.has(id))
}

async function onKeydown(event: KeyboardEvent): Promise<void> {
  if (activeConfirm.value || ui.showCreate || ui.detailId || ui.showSettings) return
  const target = event.target as HTMLElement | null
  if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return
  if (target?.tagName === "BUTTON" && event.key === " ") return
  const mod = event.ctrlKey || event.metaKey
  if (mod && event.key.toLowerCase() === "z") {
    event.preventDefault()
    await (event.shiftKey ? redo() : undo())
    return
  }
  if (mod) return
  switch (event.key) {
    case "ArrowDown": event.preventDefault(); moveSelection(1); break
    case "ArrowUp": event.preventDefault(); moveSelection(-1); break
    case "ArrowRight":
      if (ui.selectedId && ui.mode === "tree") { event.preventDefault(); ui.collapsed.delete(ui.selectedId) }
      break
    case "ArrowLeft":
      if (ui.selectedId && ui.mode === "tree") { event.preventDefault(); ui.collapsed.add(ui.selectedId) }
      break
    case "Enter":
      if (ui.selectedId && ui.mode !== "board") { event.preventDefault(); ui.editingId = ui.selectedId }
      break
    case " ":
      event.preventDefault()
      for (const id of selectedVisible()) await toggleDone(id)
      clearChecked()
      break
    case "Delete":
    case "Backspace": {
      event.preventDefault()
      const ids = selectedVisible()
      const ok = ui.view === "trash"
        ? await deleteForeverWithConfirmation(ids)
        : await trashWithConfirmation(ids)
      if (ok) clearChecked()
      break
    }
    case "Tab":
      if (ui.selectedId && ui.mode === "tree" && ui.view !== "trash") {
        event.preventDefault()
        await (event.shiftKey ? outdentTask(ui.selectedId) : indentTask(ui.selectedId))
      }
      break
    case "n": case "N":
      if (ui.view !== "trash") { event.preventDefault(); openCreate() }
      break
    case "r": case "R": event.preventDefault(); await loadAll(); break
    case "Escape": ui.editingId = ""; clearChecked(); break
  }
}
</script>

<template>
  <div ref="rootEl" class="bt-app" :class="{ 'bt-app--reduced': settings.reduceMotion }" tabindex="-1" @keydown="onKeydown">
    <AppSidebar />
    <div class="bt-content">
      <div v-if="taskState.error || settingsState.error" class="bt-error" role="alert">
        <span>{{ taskState.error || settingsState.error }}</span>
        <button type="button" class="bt-icon-btn" @click="taskState.error = ''; settingsState.error = ''">×</button>
      </div>
      <SettingsPanel v-if="ui.showSettings" />
      <template v-else>
        <AppToolbar />
        <FilterBar />
        <component :is="viewComponent" />
      </template>
    </div>
    <TaskDetail v-if="!ui.showSettings && ui.detailId && taskState.loaded" />
    <TaskCreateDialog v-if="ui.showCreate" />
    <ConfirmDialog />
  </div>
</template>
