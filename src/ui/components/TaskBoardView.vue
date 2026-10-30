<script setup lang="ts">
import { computed, ref } from "vue"

import { isOverdue, relativeDueLabel } from "@/core/date"
import type { TaskStatus } from "@/core/types"
import { childStatsMap } from "@/store/childStats"
import { strings } from "@/store/i18n"
import { setStatus } from "@/store/tasks"
import { ui } from "@/store/ui"

import { useTasks } from "../useTasks"

const { columns } = useTasks()

const dragId = ref("")
const hoverColumn = ref<TaskStatus | "">("")

const childStats = computed(() => childStatsMap.value)

function statusLabel(status: TaskStatus): string {
  switch (status) {
    case "doing":
      return strings.statusDoing || "Doing"
    case "done":
      return strings.statusDone || "Done"
    case "archived":
      return strings.statusArchived || "Archived"
    default:
      return strings.statusTodo || "To do"
  }
}

function onDragStart(event: DragEvent, id: string): void {
  dragId.value = id
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move"
    event.dataTransfer.setData("text/plain", id)
  }
}

function onDrop(status: TaskStatus): void {
  const id = dragId.value
  dragId.value = ""
  hoverColumn.value = ""
  if (id) {
    void setStatus(id, status)
  }
}
</script>

<template>
  <div class="bt-view">
    <p class="bt-note-hint">{{ strings.boardDropHint || '' }}</p>
    <p v-if="ui.showHelp" class="bt-note-hint">{{ strings.helpBody || '' }}</p>

    <div class="bt-board">
      <section
        v-for="column in columns"
        :key="column.status"
        class="bt-col"
        :class="[`bt-col--${column.status}`, { 'bt-col--hover': hoverColumn === column.status }]"
        @dragover.prevent="hoverColumn = column.status"
        @dragleave="hoverColumn = ''"
        @drop.prevent="onDrop(column.status)"
      >
        <header class="bt-col__head">
          <span class="bt-col__dot" :class="`bt-col__dot--${column.status}`" />
          <span class="bt-col__title">{{ statusLabel(column.status) }}</span>
          <span class="bt-col__count">{{ column.tasks.length }}</span>
        </header>

        <div class="bt-col__body">
          <article
            v-for="task in column.tasks"
            :key="task.id"
            class="bt-card"
            :class="{ 'bt-card--selected': ui.selectedId === task.id }"
            draggable="true"
            @dragstart="onDragStart($event, task.id)"
            @click="ui.selectedId = task.id"
          >
            <div class="bt-card__top">
              <span class="bt-pri bt-pri--chip" :class="`bt-pri--${task.priority}`">P{{ task.priority }}</span>
              <span class="bt-card__title">{{ task.title || "—" }}</span>
            </div>
            <div class="bt-card__meta">
              <span
                v-if="task.due"
                class="bt-chip"
                :class="{ 'bt-chip--danger': isOverdue(task.due, task.status !== 'todo' && task.status !== 'doing') }"
              >
                {{ relativeDueLabel(task.due, strings) }}
              </span>
              <span v-if="task.repeat" class="bt-chip bt-chip--ghost">↻</span>
              <span v-if="childStats.get(task.id)" class="bt-chip bt-chip--ghost">
                {{ childStats.get(task.id)?.done }}/{{ childStats.get(task.id)?.total }}
              </span>
              <span v-if="task.note" class="bt-chip bt-chip--ghost">≡</span>
              <span v-if="task.category" class="bt-chip bt-chip--cat">{{ task.category }}</span>
              <span v-if="task.inSpace" class="bt-chip bt-chip--ghost">{{ strings.spaceTitle }}</span>
            </div>
          </article>

          <p v-if="column.tasks.length === 0" class="bt-col__empty">{{ strings.boardEmpty || 'Drop here' }}</p>
        </div>
      </section>
    </div>
  </div>
</template>
