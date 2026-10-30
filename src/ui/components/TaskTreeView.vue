<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue"

import type { Priority } from "@/core/types"
import { openInNote } from "@/store/host"
import { strings } from "@/store/i18n"
import {
  createTask,
  ensureSpaceDoc,
  moveTask,
  setPriority,
  setTitle,
  taskIndex,
  toggleDone,
  trashTask,
} from "@/store/tasks"
import { toggleCollapsed, ui } from "@/store/ui"

import TaskRow from "./TaskRow.vue"
import { useTasks } from "../useTasks"

const { treeRows } = useTasks()

const rootDraft = ref("")
const rootInput = ref<HTMLInputElement | null>(null)
const busy = ref(false)

const roots = computed(() => treeRows.value.filter((row) => row.kind === "task" && row.depth === 0))

watch(
  () => ui.selectedId,
  async (id) => {
    if (!id) {
      return
    }
    await nextTick()
    document.querySelector(`.bt-view [data-id="${id}"]`)?.scrollIntoView({ block: "nearest" })
  },
)

function taskOf(id: string) {
  return taskIndex().get(id)
}

function rowTask(id: string): NonNullable<ReturnType<typeof taskOf>> {
  return taskOf(id) as NonNullable<ReturnType<typeof taskOf>>
}

async function submitRoot(): Promise<void> {
  const title = rootDraft.value.trim()
  if (!title || busy.value) {
    return
  }
  busy.value = true
  try {
    await ensureSpaceDoc()
    await createTask({ title, scope: "space" })
    rootDraft.value = ""
    await nextTick()
    rootInput.value?.focus()
  } finally {
    busy.value = false
  }
}

async function addSubtask(id: string): Promise<void> {
  const parent = taskOf(id)
  await createTask({ title: "", parentId: id, scope: parent?.inSpace ? "space" : "note" })
  ui.collapsed.delete(id)
  ui.selectedId = id
}

function cyclePriority(id: string): void {
  const task = taskOf(id)
  if (!task) {
    return
  }
  void setPriority(id, ((task.priority + 3) % 4) as Priority)
}

function onSelect(taskId: string, event: MouseEvent): void {
  if (event.metaKey || event.ctrlKey) {
    return
  }
  ui.selectedId = taskId
  if (ui.editingId && ui.editingId !== taskId) {
    ui.editingId = ""
  }
}

/** 拖到某个节点上：成为它的子节点 */
const dragId = ref("")

function onDragStart(id: string, event: DragEvent): void {
  dragId.value = id
  event.dataTransfer?.setData("text/plain", id)
}

function onDragOver(_id: string, event: DragEvent): void {
  if (dragId.value && dragId.value !== _id) {
    event.preventDefault()
  }
}

function onDrop(id: string): void {
  const source = dragId.value
  dragId.value = ""
  if (!source || source === id) {
    return
  }
  void moveTask(source, id, "")
}
</script>

<template>
  <div class="bt-view">
    <div class="bt-tree-head">
      <input
        ref="rootInput"
        v-model="rootDraft"
        class="bt-input bt-tree-head__input"
        :placeholder="strings.treeCreateRoot || 'New root task'"
        @keydown.enter.prevent="submitRoot"
      />
      <button class="bt-btn bt-btn--ghost" :disabled="busy" @click="submitRoot">
        {{ strings.addTitle || 'Add' }}
      </button>
      <span class="bt-tree-head__hint">{{ strings.boardDropHint || '' }}</span>
    </div>

    <p v-if="ui.showHelp" class="bt-note-hint">{{ strings.helpBody || '' }}</p>

    <div class="bt-list bt-list--static">
      <div v-if="roots.length === 0" class="bt-empty">
        <p class="bt-empty__title">{{ strings.treeEmpty || 'Tree is empty' }}</p>
        <p class="bt-empty__hint">{{ strings.treeEmptyHint || '' }}</p>
      </div>

      <template v-else>
        <template v-for="row in treeRows" :key="row.key">
          <TaskRow
            v-if="row.kind === 'task' && taskOf(row.id)"
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
      </template>
    </div>
  </div>
</template>
