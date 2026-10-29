<script setup lang="ts">
import { computed, ref, watch } from "vue"

import { REPEAT_PRESETS } from "@/core/date"
import type { Priority, Task } from "@/core/types"
import { openInNote } from "@/store/host"
import { strings } from "@/store/i18n"
import {
  removeForever,
  restoreTask,
  setCategory,
  setDue,
  setNote,
  setPriority,
  setRepeat,
  setTitle,
  taskIndex,
  taskState,
  toggleDone,
  trashTask,
} from "@/store/tasks"
import { ui } from "@/store/ui"

import { useTasks } from "../useTasks"

const { categories } = useTasks()

const task = computed<Task | undefined>(() => {
  void taskState.version
  return ui.selectedId ? taskIndex().get(ui.selectedId) : undefined
})

const noteDraft = ref("")
const titleDraft = ref("")
let noteTimer: number | undefined
let titleTimer: number | undefined

watch(
  () => task.value?.id,
  (id) => {
    if (noteTimer) {
      window.clearTimeout(noteTimer)
    }
    if (titleTimer) {
      window.clearTimeout(titleTimer)
    }
    const current = id ? taskIndex().get(id) : undefined
    noteDraft.value = current?.note ?? ""
    titleDraft.value = current?.title ?? ""
  },
  { immediate: true },
)

watch(noteDraft, (value) => {
  const id = ui.selectedId
  if (!id) {
    return
  }
  if (noteTimer) {
    window.clearTimeout(noteTimer)
  }
  noteTimer = window.setTimeout(() => void setNote(id, value), 500)
})

watch(titleDraft, (value) => {
  const id = ui.selectedId
  if (!id || task.value?.title === value) {
    return
  }
  if (titleTimer) {
    window.clearTimeout(titleTimer)
  }
  titleTimer = window.setTimeout(() => void setTitle(id, value), 500)
})

const priorities: Priority[] = [0, 1, 2, 3]

function onDue(event: Event): void {
  const value = (event.target as HTMLInputElement).value
  if (ui.selectedId) {
    void setDue(ui.selectedId, value)
  }
}
</script>

<template>
  <aside v-if="task" class="bt-detail">
    <header class="bt-detail__head">
      <button class="bt-check" :class="{ 'bt-check--on': task.done }" @click="toggleDone(task.id)">
        <svg class="bt-check__icon" aria-hidden="true"><use xlink:href="#iconCheck" /></svg>
      </button>
      <input v-model="titleDraft" class="bt-detail__title" :placeholder="strings.taskTitle || 'Title'" />
      <button class="bt-icon-btn" :title="strings.closeDetail || 'Close'" @click="ui.selectedId = ''">
        <svg aria-hidden="true"><use xlink:href="#iconClose" /></svg>
      </button>
    </header>

    <dl class="bt-detail__fields">
      <div class="bt-field">
        <dt class="bt-field__label">{{ strings.priority || 'Priority' }}</dt>
        <dd class="bt-field__value">
          <button
            v-for="p in priorities"
            :key="p"
            class="bt-pri bt-pri--chip"
            :class="[`bt-pri--${p}`, { 'bt-pri--on': task.priority === p }]"
            @click="setPriority(task.id, p)"
          >
            P{{ p }}
          </button>
        </dd>
      </div>

      <div class="bt-field">
        <dt class="bt-field__label">{{ strings.dueDate || 'Due date' }}</dt>
        <dd class="bt-field__value">
          <input class="bt-input" type="date" :value="task.due" @change="onDue" />
        </dd>
      </div>

      <div class="bt-field">
        <dt class="bt-field__label">{{ strings.repeat || 'Repeat' }}</dt>
        <dd class="bt-field__value">
          <select class="bt-select" :value="task.repeat" @change="setRepeat(task.id, ($event.target as HTMLSelectElement).value)">
            <option v-for="option in REPEAT_PRESETS" :key="option.value" :value="option.value">
              {{ strings[option.key] || option.value }}
            </option>
          </select>
        </dd>
      </div>

      <div class="bt-field">
        <dt class="bt-field__label">{{ strings.category || 'Category' }}</dt>
        <dd class="bt-field__value">
          <input
            class="bt-input"
            list="bt-categories"
            :value="task.category"
            @change="setCategory(task.id, ($event.target as HTMLInputElement).value)"
          />
          <datalist id="bt-categories">
            <option v-for="name in categories" :key="name" :value="name" />
          </datalist>
        </dd>
      </div>

      <div class="bt-field bt-field--stack">
        <dt class="bt-field__label">{{ strings.note || 'Note' }}</dt>
        <dd class="bt-field__value">
          <textarea v-model="noteDraft" class="bt-textarea" rows="6" />
        </dd>
      </div>

      <div class="bt-field">
        <dt class="bt-field__label">{{ strings.groupDoc || 'Document' }}</dt>
        <dd class="bt-field__value">
          <button class="bt-btn bt-btn--link" :title="task.hpath" @click="openInNote(task.rootId, task.id)">
            {{ task.hpath || task.rootId }}
          </button>
        </dd>
      </div>
    </dl>

    <footer class="bt-detail__foot">
      <button v-if="task.trashed" class="bt-btn bt-btn--ghost" @click="restoreTask(task.id)">
        {{ strings.restoreOne || 'Restore' }}
      </button>
      <button v-if="task.trashed" class="bt-btn bt-btn--danger" @click="removeForever(task.id)">
        {{ strings.deleteForever || 'Delete forever' }}
      </button>
      <button v-else class="bt-btn bt-btn--danger" @click="trashTask(task.id)">
        {{ strings.trashOne || 'Trash' }}
      </button>
    </footer>
  </aside>
</template>
