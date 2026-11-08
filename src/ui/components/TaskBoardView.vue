<script setup lang="ts">
import { ref } from "vue"

import { isOverdue, relativeDueLabel } from "@/core/date"
import type { TaskStatus } from "@/core/types"
import { childStatsMap } from "@/store/childStats"
import { strings } from "@/store/i18n"
import { setStatus, toggleDone } from "@/store/tasks"
import { ui } from "@/store/ui"

import { useTasks } from "../useTasks"

const { columns } = useTasks()
const dragId = ref("")
const dragStatus = ref<TaskStatus | "">("")
const hoverColumn = ref<TaskStatus | "">("")

function statusLabel(status: TaskStatus): string {
  const keys: Record<TaskStatus, string> = {
    todo: "statusTodo",
    doing: "statusDoing",
    done: "statusDone",
    archived: "statusArchived",
  }
  return strings[keys[status]] || status
}

function start(event: DragEvent, id: string, status: TaskStatus): void {
  dragId.value = id
  dragStatus.value = status
  event.dataTransfer?.setData("text/plain", id)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = "move"
}

function reset(): void {
  dragId.value = ""
  dragStatus.value = ""
  hoverColumn.value = ""
}

async function drop(status: TaskStatus): Promise<void> {
  const id = dragId.value
  const unchanged = dragStatus.value === status
  reset()
  if (id && !unchanged) await setStatus(id, status)
}
</script>

<template>
  <div class="bt-view">
    <p class="bt-note-hint">{{ ui.showHelp ? strings.helpBody : strings.boardDropHint }}</p>
    <div class="bt-board">
      <section
        v-for="column in columns"
        :key="column.status"
        class="bt-col"
        :class="[`bt-col--${column.status}`, { 'bt-col--hover': hoverColumn === column.status }]"
        @dragover.prevent="hoverColumn = column.status"
        @dragleave="hoverColumn = ''"
        @drop.prevent="drop(column.status)"
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
            :data-id="task.id"
            draggable="true"
            @dragstart="start($event, task.id, column.status)"
            @dragend="reset"
            @click="ui.selectedId = task.id"
            @dblclick="ui.detailId = task.id"
          >
            <div class="bt-card__top">
              <button type="button" class="bt-check" :class="{ 'bt-check--on': task.status === 'done' }" @click.stop="toggleDone(task.id)">
                <svg class="bt-check__icon" aria-hidden="true"><use xlink:href="#iconCheck" /></svg>
              </button>
              <span class="bt-pri bt-pri--chip" :class="`bt-pri--${task.priority}`">P{{ task.priority }}</span>
              <span class="bt-card__title">{{ task.title }}</span>
            </div>
            <div class="bt-card__meta">
              <span v-if="task.due" class="bt-chip" :class="{ 'bt-chip--danger': isOverdue(task.due, !['todo', 'doing'].includes(task.status)) }">
                {{ relativeDueLabel(task.due, strings) }}
              </span>
              <span v-if="task.repeat" class="bt-chip bt-chip--ghost">↻</span>
              <span v-if="childStatsMap.get(task.id)" class="bt-chip bt-chip--ghost">
                {{ childStatsMap.get(task.id)?.done }}/{{ childStatsMap.get(task.id)?.total }}
              </span>
              <span v-if="task.note" class="bt-chip bt-chip--ghost">≡</span>
              <span v-if="task.category" class="bt-chip bt-chip--cat">{{ task.category }}</span>
            </div>
          </article>
          <p v-if="!column.tasks.length" class="bt-col__empty">{{ strings.boardEmpty }}</p>
        </div>
      </section>
    </div>
  </div>
</template>
