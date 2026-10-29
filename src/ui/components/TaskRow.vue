<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue"

import { isOverdue, relativeDueLabel } from "@/core/date"
import type { Task } from "@/core/types"
import { strings } from "@/store/i18n"
import { taskIndex, taskState } from "@/store/tasks"

const props = defineProps<{
  task: Task
  depth: number
  selected: boolean
  editing: boolean
}>()

const emit = defineEmits<{
  (e: "select", event: MouseEvent): void
  (e: "toggle"): void
  (e: "startEdit"): void
  (e: "commitTitle", title: string): void
  (e: "cyclePriority"): void
  (e: "open"): void
  (e: "addSubtask"): void
  (e: "trash"): void
  (e: "dragStart", id: string, event: DragEvent): void
  (e: "dragOver", id: string, event: DragEvent): void
  (e: "drop", id: string, event: DragEvent): void
}>()

const draft = ref("")
const inputEl = ref<HTMLInputElement | null>(null)

watch(
  () => props.editing,
  async (editing) => {
    if (editing) {
      draft.value = props.task.title
      await nextTick()
      inputEl.value?.focus()
      inputEl.value?.select()
    }
  },
  { immediate: true },
)

const overdue = computed(() => isOverdue(props.task.due, props.task.done))
const dueLabel = computed(() => relativeDueLabel(props.task.due, strings))

const subtasks = computed(() => {
  void taskState.version
  return Array.from(taskIndex().values()).filter((item) => item.parentId === props.task.id)
})
const doneCount = computed(() => subtasks.value.filter((item) => item.done).length)

const shortPath = computed(() => {
  const path = props.task.hpath || ""
  const parts = path.split("/").filter(Boolean)
  return parts.length > 2 ? `…/${parts.slice(-2).join("/")}` : path
})

function commit(): void {
  if (props.editing) {
    emit("commitTitle", draft.value)
  }
}

function cancel(): void {
  if (props.editing) {
    emit("commitTitle", props.task.title)
  }
}
</script>

<template>
  <div
    class="bt-row"
    :class="[
      `bt-row--depth${Math.min(depth, 3)}`,
      {
        'bt-row--selected': selected,
        'bt-row--done': task.done,
        'bt-row--overdue': overdue,
      },
    ]"
    :data-id="task.id"
    draggable="true"
    @click="emit('select', $event)"
    @dblclick.stop="emit('startEdit')"
    @dragstart.stop="emit('dragStart', task.id, $event)"
    @dragover.prevent="emit('dragOver', task.id, $event)"
    @drop.prevent="emit('drop', task.id, $event)"
  >
    <button
      class="bt-check"
      :class="{ 'bt-check--on': task.done }"
      :aria-label="task.done ? 'reopen' : 'complete'"
      @click.stop="emit('toggle')"
    >
      <svg class="bt-check__icon" aria-hidden="true"><use xlink:href="#iconCheck" /></svg>
    </button>

    <div class="bt-row__body">
      <div class="bt-row__line">
        <button
          class="bt-pri bt-pri--chip"
          :class="`bt-pri--${task.priority}`"
          :title="strings.priority || 'Priority'"
          @click.stop="emit('cyclePriority')"
        >
          P{{ task.priority }}
        </button>

        <input
          v-if="editing"
          ref="inputEl"
          v-model="draft"
          class="bt-row__input"
          @click.stop
          @keydown.enter.prevent="commit"
          @keydown.esc.prevent="cancel"
          @blur="commit"
        />
        <span v-else class="bt-row__title" :title="task.title">{{ task.title || "—" }}</span>
      </div>

      <div class="bt-row__meta">
        <span v-if="task.due" class="bt-chip" :class="{ 'bt-chip--danger': overdue }">{{ dueLabel }}</span>
        <span v-if="task.repeat" class="bt-chip bt-chip--ghost" :title="strings.repeat || 'Repeat'">↻</span>
        <span v-if="subtasks.length" class="bt-chip bt-chip--ghost">{{ doneCount }}/{{ subtasks.length }}</span>
        <span v-if="task.note" class="bt-chip bt-chip--ghost" :title="strings.note || 'Note'">≡</span>
        <span v-if="task.category" class="bt-chip bt-chip--cat">{{ task.category }}</span>
        <span class="bt-row__path" :title="task.hpath">{{ shortPath }}</span>
      </div>
    </div>

    <div class="bt-row__ops">
      <button class="bt-icon-btn" :title="strings.openInNote || 'Open in note'" @click.stop="emit('open')">
        <svg aria-hidden="true"><use xlink:href="#iconRef" /></svg>
      </button>
      <button class="bt-icon-btn" :title="strings.addSubtask || 'Add subtask'" @click.stop="emit('addSubtask')">
        <svg aria-hidden="true"><use xlink:href="#iconAdd" /></svg>
      </button>
      <button class="bt-icon-btn" :title="strings.trashOne || 'Trash'" @click.stop="emit('trash')">
        <svg aria-hidden="true"><use xlink:href="#iconTrashcan" /></svg>
      </button>
    </div>
  </div>
</template>
