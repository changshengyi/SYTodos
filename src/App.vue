<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue"

import { settings } from "@/store/settings"
import {
  indentTask,
  loadAll,
  outdentTask,
  taskState,
  toggleDone,
  trashTask,
} from "@/store/tasks"
import { clearChecked, ui } from "@/store/ui"
import { redo, undo } from "@/store/undo"

import AppSidebar from "@/ui/components/AppSidebar.vue"
import AppToolbar from "@/ui/components/AppToolbar.vue"
import FilterBar from "@/ui/components/FilterBar.vue"
import QuickAdd from "@/ui/components/QuickAdd.vue"
import SettingsPanel from "@/ui/components/SettingsPanel.vue"
import TaskBoardView from "@/ui/components/TaskBoardView.vue"
import TaskDetail from "@/ui/components/TaskDetail.vue"
import TaskListView from "@/ui/components/TaskListView.vue"
import TaskTreeView from "@/ui/components/TaskTreeView.vue"
import { useTasks } from "@/ui/useTasks"

const { flatVisibleIds } = useTasks()

const rootEl = ref<HTMLElement | null>(null)
const quickAdd = ref<{ focus: () => void } | null>(null)

const viewComponent = computed(() => {
  if (ui.mode === "board") {
    return TaskBoardView
  }
  if (ui.mode === "tree") {
    return TaskTreeView
  }
  return TaskListView
})

onMounted(() => {
  rootEl.value?.focus()
})

watch(
  () => [ui.mode, ui.scope, ui.showSettings],
  () => {
    rootEl.value?.focus()
  },
)

function ensureVisible(id: string): void {
  const node = rootEl.value?.querySelector(`[data-id="${id}"]`)
  node?.scrollIntoView({ block: "nearest" })
}

function moveSelection(delta: number): void {
  const ids = flatVisibleIds.value
  if (ids.length === 0) {
    return
  }
  const current = ids.indexOf(ui.selectedId)
  const next = current < 0 ? 0 : Math.min(ids.length - 1, Math.max(0, current + delta))
  ui.selectedId = ids[next]
  ui.editingId = ""
  ensureVisible(ui.selectedId)
}

function currentlySelected(): string[] {
  if (ui.checked.size > 0) {
    return Array.from(ui.checked)
  }
  return ui.selectedId ? [ui.selectedId] : []
}

async function onKeydown(event: KeyboardEvent): Promise<void> {
  const target = event.target as HTMLElement | null
  if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) {
    return
  }
  // 空格在按钮上会同时触发原生点击，交给按钮自己处理
  if (target?.tagName === "BUTTON" && event.key === " ") {
    return
  }

  const mod = event.metaKey || event.ctrlKey
  if (mod && event.key.toLowerCase() === "z") {
    event.preventDefault()
    await (event.shiftKey ? redo() : undo())
    return
  }
  if (mod) {
    return
  }

  switch (event.key) {
    case "ArrowDown":
      event.preventDefault()
      moveSelection(1)
      break
    case "ArrowUp":
      event.preventDefault()
      moveSelection(-1)
      break
    case "Enter":
      if (ui.selectedId) {
        event.preventDefault()
        ui.editingId = ui.selectedId
      }
      break
    case " ":
      event.preventDefault()
      for (const id of currentlySelected()) {
        await toggleDone(id)
      }
      break
    case "Delete":
    case "Backspace":
      event.preventDefault()
      for (const id of currentlySelected()) {
        await trashTask(id)
      }
      clearChecked()
      break
    case "Tab":
      if (ui.selectedId) {
        event.preventDefault()
        await (event.shiftKey ? outdentTask(ui.selectedId) : indentTask(ui.selectedId))
      }
      break
    case "n":
    case "N":
      event.preventDefault()
      quickAdd.value?.focus()
      break
    case "r":
    case "R":
      event.preventDefault()
      await loadAll()
      break
    case "Escape":
      ui.editingId = ""
      clearChecked()
      break
    default:
      break
  }
}

</script>

<template>
  <div
    ref="rootEl"
    class="bt-app"
    :class="{ 'bt-app--reduced': settings.reduceMotion }"
    tabindex="-1"
    @keydown="onKeydown"
  >
    <AppSidebar />

    <div class="bt-content">
      <SettingsPanel v-if="ui.showSettings" />

      <template v-else>
        <AppToolbar />
        <QuickAdd ref="quickAdd" />
        <FilterBar v-if="ui.filterOpen" />
        <component :is="viewComponent" />
      </template>
    </div>

    <TaskDetail v-if="!ui.showSettings && ui.selectedId && taskState.loaded" />
  </div>
</template>
