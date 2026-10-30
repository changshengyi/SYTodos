<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue"

import type { Priority } from "@/core/types"
import { openInNote } from "@/store/host"
import { strings } from "@/store/i18n"
import {
  createTask,
  reorderSiblings,
  setPriority,
  setTitle,
  taskIndex,
  toggleDone,
  trashTask,
} from "@/store/tasks"
import { clearChecked, toggleChecked, toggleCollapsed, ui } from "@/store/ui"

import TaskRow from "./TaskRow.vue"
import { useTasks } from "../useTasks"

const { rows, flatVisibleIds } = useTasks()

const scroller = ref<HTMLElement | null>(null)
const scrollTop = ref(0)
const viewport = ref(600)
const dragId = ref("")

const rowHeight = computed(() => ui.rowHeight)
const totalRows = computed(() => rows.value.length)
const totalHeight = computed(() => totalRows.value * rowHeight.value)
const startIndex = computed(() => Math.max(0, Math.floor(scrollTop.value / rowHeight.value) - 8))
const endIndex = computed(() =>
  Math.min(totalRows.value, Math.max(40, Math.ceil((scrollTop.value + viewport.value) / rowHeight.value) + 16)),
)
const offsetY = computed(() => startIndex.value * rowHeight.value)
const windowRows = computed(() => rows.value.slice(startIndex.value, endIndex.value))

let rafId = 0
function onScroll(): void {
  if (rafId) {
    return
  }
  rafId = requestAnimationFrame(() => {
    rafId = 0
    scrollTop.value = scroller.value?.scrollTop ?? 0
  })
}

let observer: ResizeObserver | undefined
onMounted(() => {
  if (!scroller.value) {
    return
  }
  viewport.value = scroller.value.clientHeight || 600
  observer = new ResizeObserver((entries) => {
    const height = entries[0]?.contentRect.height ?? 0
    if (height > 0) {
      viewport.value = height
    }
  })
  observer.observe(scroller.value)
})
onBeforeUnmount(() => {
  observer?.disconnect()
  if (rafId) {
    cancelAnimationFrame(rafId)
  }
})

function taskOf(id: string) {
  return taskIndex().get(id)
}

function rowTask(id: string): NonNullable<ReturnType<typeof taskOf>> {
  return taskOf(id) as NonNullable<ReturnType<typeof taskOf>>
}

function ensureVisible(id: string): void {
  const index = rows.value.findIndex((row) => row.kind === "task" && row.id === id)
  if (index < 0 || !scroller.value) {
    return
  }
  const top = index * rowHeight.value
  if (top < scrollTop.value) {
    scroller.value.scrollTop = top
  } else if (top + rowHeight.value > scrollTop.value + viewport.value) {
    scroller.value.scrollTop = top - viewport.value + rowHeight.value * 2
  }
}

watch(
  () => ui.selectedId,
  (id) => {
    if (id) {
      ensureVisible(id)
    }
  },
)

function onSelect(taskId: string, event: MouseEvent): void {
  if (event.metaKey || event.ctrlKey) {
    toggleChecked(taskId)
    return
  }
  ui.selectedId = taskId
  if (ui.editingId && ui.editingId !== taskId) {
    ui.editingId = ""
  }
}

function cyclePriority(id: string): void {
  const task = taskOf(id)
  if (!task) {
    return
  }
  void setPriority(id, ((task.priority + 3) % 4) as Priority)
}

async function addSubtask(id: string): Promise<void> {
  const parent = taskOf(id)
  await createTask({ title: "", parentId: id, scope: parent?.inSpace ? "space" : "note" })
  ui.selectedId = id
}

function onDragStart(id: string, event: DragEvent): void {
  dragId.value = id
  event.dataTransfer?.setData("text/plain", id)
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move"
  }
}

function onDragOver(_id: string, event: DragEvent): void {
  if (!dragId.value || ui.sortBy !== "manual") {
    return
  }
  event.preventDefault()
}

function onDrop(id: string): void {
  const source = dragId.value
  dragId.value = ""
  if (!source || source === id || ui.sortBy !== "manual") {
    return
  }
  const order = flatVisibleIds.value.filter((item) => item !== source)
  const at = order.indexOf(id)
  if (at < 0) {
    return
  }
  order.splice(at, 0, source)
  void reorderSiblings(order)
}
</script>

<template>
  <div class="bt-view">
    <div v-if="ui.checked.size > 0" class="bt-selbar">
      <span>{{ (strings.selectedCount || '{n} selected').replace('{n}', String(ui.checked.size)) }}</span>
      <button class="bt-btn bt-btn--ghost" @click="clearChecked()">{{ strings.closeDetail || 'Close' }}</button>
    </div>

    <p v-if="ui.showHelp" class="bt-note-hint">{{ strings.helpBody || '' }}</p>

    <div ref="scroller" class="bt-list" @scroll.passive="onScroll">
      <div v-if="rows.length === 0" class="bt-empty">
        <p class="bt-empty__title">{{ strings.noTasks || 'No tasks' }}</p>
        <p class="bt-empty__hint">{{ strings.noTasksHint || '' }}</p>
      </div>

      <div v-else class="bt-list__canvas" :style="{ height: `${totalHeight}px` }">
        <div class="bt-list__window" :style="{ transform: `translateY(${offsetY}px)` }">
          <template v-for="row in windowRows" :key="row.key">
            <div v-if="row.kind === 'group'" class="bt-group">
              <span class="bt-group__label">{{ row.label }}</span>
              <span class="bt-group__count">{{ row.count }}</span>
            </div>
            <TaskRow
              v-else-if="taskOf(row.id)"
              :task="rowTask(row.id)"
              :depth="row.depth"
              :selected="ui.selectedId === row.id"
              :editing="ui.editingId === row.id"
              :has-children="row.hasChildren"
              :collapsed="row.collapsed"
              @select="onSelect(row.id, $event)"
              @toggle="toggleDone(row.id)"
              @toggle-collapse="toggleCollapsed(row.id)"
              @start-edit="ui.editingId = row.id"
              @commit-title="(title) => { setTitle(row.id, title); ui.editingId = '' }"
              @cycle-priority="cyclePriority(row.id)"
              @open="openInNote(taskOf(row.id)?.rootId ?? '', row.id)"
              @add-subtask="addSubtask(row.id)"
              @trash="trashTask(row.id)"
              @drag-start="(id, event) => onDragStart(id, event)"
              @drag-over="(id, event) => onDragOver(id, event)"
              @drop="(id) => onDrop(id)"
            />
          </template>
        </div>
      </div>
    </div>
  </div>
</template>
