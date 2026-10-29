<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue"

import type { GroupBy, Priority, SortBy } from "@/core/types"
import { openInNote } from "@/store/host"
import { strings } from "@/store/i18n"
import {
  createTask,
  indentTask,
  loadAll,
  outdentTask,
  reorderSiblings,
  setPriority,
  setTitle,
  taskIndex,
  taskState,
  toggleDone,
  trashTask,
} from "@/store/tasks"
import { clearChecked, toggleChecked, ui } from "@/store/ui"
import { redo, undo } from "@/store/undo"

import TaskRow from "./TaskRow.vue"
import QuickAdd from "./QuickAdd.vue"
import { useTasks } from "../useTasks"

const { rows, flatVisibleIds } = useTasks()

const scroller = ref<HTMLElement | null>(null)
const quickAdd = ref<{ focus: () => void } | null>(null)
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

const groupOptions: { value: GroupBy; key: string }[] = [
  { value: "none", key: "groupNone" },
  { value: "due", key: "groupDue" },
  { value: "priority", key: "groupPriority" },
  { value: "category", key: "groupCategory" },
  { value: "doc", key: "groupDoc" },
]

const sortOptions: { value: SortBy; key: string }[] = [
  { value: "manual", key: "sortManual" },
  { value: "due", key: "sortDue" },
  { value: "priority", key: "sortPriority" },
  { value: "created", key: "sortCreated" },
  { value: "title", key: "sortTitle" },
]

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

/** 模板里使用的非空取值：调用前已用 `v-else-if` 确认存在 */
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
  const next = ((task.priority + 3) % 4) as Priority
  void setPriority(id, next)
}

async function addSubtask(id: string): Promise<void> {
  await createTask({ title: "", parentId: id })
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
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = "move"
  }
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

function currentlySelected(): string[] {
  if (ui.checked.size > 0) {
    return Array.from(ui.checked)
  }
  return ui.selectedId ? [ui.selectedId] : []
}

async function onKeydown(event: KeyboardEvent): Promise<void> {
  const target = event.target as HTMLElement | null
  if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
    return
  }

  const mod = event.metaKey || event.ctrlKey
  if (mod && event.key.toLowerCase() === "z") {
    event.preventDefault()
    await (event.shiftKey ? redo() : undo())
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
  <section class="bt-main" tabindex="0" @keydown="onKeydown">
    <header class="bt-toolbar">
      <div class="bt-toolbar__search">
        <svg class="bt-toolbar__icon" aria-hidden="true"><use xlink:href="#iconSearch" /></svg>
        <input v-model="ui.query" class="bt-toolbar__input" :placeholder="strings.search || 'Search'" />
      </div>

      <select v-model="ui.groupBy" class="bt-select" :title="strings.groupByLabel || 'Group'">
        <option v-for="option in groupOptions" :key="option.value" :value="option.value">
          {{ strings[option.key] || option.value }}
        </option>
      </select>

      <select v-model="ui.sortBy" class="bt-select" :title="strings.sortByLabel || 'Sort'">
        <option v-for="option in sortOptions" :key="option.value" :value="option.value">
          {{ strings[option.key] || option.value }}
        </option>
      </select>

      <span class="bt-toolbar__spacer" />

      <button class="bt-icon-btn" :title="strings.help || 'Shortcuts'" @click="ui.showHelp = !ui.showHelp">
        <span class="bt-glyph">?</span>
      </button>
      <button class="bt-icon-btn" :title="strings.undo || 'Undo'" @click="undo()">
        <span class="bt-glyph">↶</span>
      </button>
      <button class="bt-icon-btn" :title="strings.redo || 'Redo'" @click="redo()">
        <span class="bt-glyph">↷</span>
      </button>
      <button
        class="bt-icon-btn"
        :title="strings.refresh || 'Refresh'"
        :disabled="taskState.loading"
        @click="loadAll()"
      >
        <svg aria-hidden="true"><use xlink:href="#iconRefresh" /></svg>
      </button>
    </header>

    <QuickAdd ref="quickAdd" />

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
              @select="onSelect(row.id, $event)"
              @toggle="toggleDone(row.id)"
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
  </section>
</template>
