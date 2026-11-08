<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue"

import type { Priority } from "@/core/types"
import { openInNote } from "@/store/host"
import { strings } from "@/store/i18n"
import { restoreTask, setPriority, setTitle, taskIndex, taskState, toggleDone } from "@/store/tasks"
import { clearChecked, openCreate, toggleChecked, toggleCollapsed, ui } from "@/store/ui"
import { useTaskDrag } from "@/ui/useTaskDrag"

import TaskRow from "./TaskRow.vue"
import { useTasks } from "../useTasks"
import { trashWithConfirmation } from "../useDeleteActions"

const { rows, treeRows, summary, navigableIds } = useTasks()
const drag = useTaskDrag()
const sourceRows = computed(() => (ui.mode === "tree" ? treeRows.value : rows.value))
const scroller = ref<HTMLElement | null>(null)
const scrollTop = ref(0)
const viewport = ref(600)
const rowHeight = computed(() => ui.rowHeight)
const totalHeight = computed(() => sourceRows.value.length * rowHeight.value)
const startIndex = computed(() => Math.max(0, Math.floor(scrollTop.value / rowHeight.value) - 8))
const endIndex = computed(() => Math.min(sourceRows.value.length, Math.ceil((scrollTop.value + viewport.value) / rowHeight.value) + 16))
const offsetY = computed(() => startIndex.value * rowHeight.value)
const windowRows = computed(() => sourceRows.value.slice(startIndex.value, endIndex.value))
const visibleIds = computed(() => new Set(navigableIds.value))
let rafId = 0
let observer: ResizeObserver | undefined

function onScroll(): void {
  if (rafId) return
  rafId = requestAnimationFrame(() => {
    rafId = 0
    scrollTop.value = scroller.value?.scrollTop ?? 0
  })
}

onMounted(() => {
  if (!scroller.value) return
  viewport.value = scroller.value.clientHeight || 600
  observer = new ResizeObserver((entries) => {
    viewport.value = entries[0]?.contentRect.height || 600
  })
  observer.observe(scroller.value)
})

onBeforeUnmount(() => {
  observer?.disconnect()
  if (rafId) cancelAnimationFrame(rafId)
})

watch(
  () => sourceRows.value.length,
  (count) => {
    if (!scroller.value) return
    const maxTop = Math.max(0, count * rowHeight.value - viewport.value)
    if (scrollTop.value > maxTop) {
      scroller.value.scrollTop = maxTop
      scrollTop.value = maxTop
    }
  },
)

watch(
  () => ui.selectedId,
  (id) => {
    const index = sourceRows.value.findIndex((row) => row.kind === "task" && row.id === id)
    if (index < 0 || !scroller.value) return
    const top = index * rowHeight.value
    if (top < scrollTop.value) scroller.value.scrollTop = top
    else if (top + rowHeight.value > scrollTop.value + viewport.value) {
      scroller.value.scrollTop = top - viewport.value + rowHeight.value * 2
    }
  },
)

function taskOf(id: string) {
  return taskIndex().get(id)
}

function rowTask(id: string) {
  return taskOf(id)!
}

function onSelect(id: string, event: MouseEvent): void {
  if (event.ctrlKey || event.metaKey) toggleChecked(id)
  else if (!event.shiftKey) ui.checked.clear()
  ui.selectedId = id
  if (ui.editingId !== id) ui.editingId = ""
}

async function commitTitle(id: string, title: string): Promise<void> {
  if (await setTitle(id, title)) ui.editingId = ""
}

async function cyclePriority(id: string): Promise<void> {
  const task = taskOf(id)
  if (task) await setPriority(id, ((task.priority + 3) % 4) as Priority)
}

async function trashOrRestore(id: string): Promise<void> {
  const task = taskOf(id)
  if (!task) return
  if (task.trashed) await restoreTask(id)
  else await trashWithConfirmation([id])
}

function selectedVisible(): string[] {
  const ids = ui.checked.size ? Array.from(ui.checked) : ui.selectedId ? [ui.selectedId] : []
  return ids.filter((id) => visibleIds.value.has(id))
}

async function batchComplete(): Promise<void> {
  for (const id of selectedVisible()) await toggleDone(id)
  clearChecked()
}

async function batchTrash(): Promise<void> {
  if (await trashWithConfirmation(selectedVisible())) clearChecked()
}

const emptyTitle = computed(() => {
  if (summary.value.total) return strings.noTasks || "这里没有待办"
  return summary.value.space === "local" ? strings.emptyLocalTitle : strings.emptySiyuanTitle
})
const emptyHint = computed(() => {
  if (summary.value.total) return strings.emptyFiltered
  return summary.value.space === "local" ? strings.emptyLocalHint : strings.emptySiyuanHint
})
</script>

<template>
  <div class="bt-view">
    <div v-if="ui.checked.size" class="bt-selbar">
      <span>{{ (strings.selectedCount || '已选 {n} 条').replace('{n}', String(ui.checked.size)) }}</span>
      <button v-if="ui.view !== 'trash'" type="button" class="bt-btn bt-btn--ghost" @click="batchComplete">{{ strings.statusDone }}</button>
      <button v-if="ui.view !== 'trash'" type="button" class="bt-btn bt-btn--danger" @click="batchTrash">{{ strings.trashOne }}</button>
      <button type="button" class="bt-btn bt-btn--ghost" @click="clearChecked">{{ strings.cancel }}</button>
    </div>
    <p v-if="ui.showHelp" class="bt-note-hint">{{ strings.helpBody }}</p>
    <p v-else-if="ui.mode === 'list'" class="bt-note-hint">{{ strings.listHint || '列表视图平铺所有任务，不显示父子缩进或折叠。' }}</p>
    <p v-else-if="ui.mode === 'tree' && !drag.enabled.value" class="bt-note-hint">{{ strings.manualSortHint }}</p>
    <p v-else-if="ui.mode === 'tree'" class="bt-note-hint">{{ strings.treeHint }}</p>

    <div ref="scroller" class="bt-list" @scroll.passive="onScroll">
      <div v-if="taskState.loading && !taskState.loaded" class="bt-empty">{{ strings.loading || '正在读取…' }}</div>
      <div v-else-if="!sourceRows.length" class="bt-empty">
        <p class="bt-empty__title">{{ emptyTitle }}</p>
        <p class="bt-empty__hint">{{ emptyHint }}</p>
        <p class="bt-empty__diag">
          {{ (strings.emptyStats || '{space} · 共 {total} 条 · 回收站 {trash} 条')
            .replace('{space}', summary.space === 'local' ? strings.spaceLocal : strings.spaceSiyuan)
            .replace('{total}', String(summary.total))
            .replace('{trash}', String(summary.trashed)) }}
        </p>
      </div>
      <div v-else class="bt-list__canvas" :style="{ height: `${totalHeight}px` }">
        <div class="bt-list__window" :style="{ transform: `translateY(${offsetY}px)` }">
          <template v-for="row in windowRows" :key="row.key">
            <div v-if="row.kind === 'group'" class="bt-group">
              <span class="bt-group__label">{{ row.label }}</span><span class="bt-group__count">{{ row.count }}</span>
            </div>
            <TaskRow
              v-else-if="taskOf(row.id)"
              :task="rowTask(row.id)"
              :depth="row.depth"
              :selected="ui.selectedId === row.id"
              :checked="ui.checked.has(row.id)"
              :editing="ui.editingId === row.id"
              :has-children="row.hasChildren"
              :collapsed="row.collapsed"
              :muted="row.muted"
              :flat="ui.mode === 'list'"
              :drop-zone="drag.zoneFor(row.id)"
              :draggable="drag.enabled.value && !row.muted"
              @select="onSelect(row.id, $event)"
              @toggle="toggleDone(row.id)"
              @toggle-collapse="toggleCollapsed(row.id)"
              @start-edit="ui.editingId = row.id"
              @open-detail="ui.selectedId = row.id; ui.detailId = row.id"
              @commit-title="(title) => commitTitle(row.id, title)"
              @cycle-priority="cyclePriority(row.id)"
              @open="openInNote(rowTask(row.id).rootId, row.id)"
              @add-subtask="openCreate(row.id)"
              @trash="trashOrRestore(row.id)"
              @drag-start="drag.start"
              @drag-over="drag.over"
              @drop="drag.drop"
              @drag-end="drag.reset"
            />
          </template>
        </div>
      </div>
    </div>
  </div>
</template>
