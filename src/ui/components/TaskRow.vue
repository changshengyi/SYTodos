<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue"

import { isOverdue, relativeDueLabel } from "@/core/date"
import type { Task } from "@/core/types"
import { childStatsMap } from "@/store/childStats"
import { strings } from "@/store/i18n"
import type { DropZone } from "@/ui/useTaskDrag"

const props = withDefaults(
  defineProps<{
    task: Task
    depth: number
    selected: boolean
    checked?: boolean
    editing: boolean
    hasChildren: boolean
    collapsed: boolean
    muted?: boolean
    dropZone?: DropZone
    draggable?: boolean
    flat?: boolean
  }>(),
  { checked: false, muted: false, dropZone: "", draggable: false, flat: false },
)

const emit = defineEmits<{
  (e: "select", event: MouseEvent): void
  (e: "toggle"): void
  (e: "toggleCollapse"): void
  (e: "startEdit"): void
  (e: "openDetail"): void
  (e: "commitTitle", title: string): void
  (e: "cyclePriority"): void
  (e: "open"): void
  (e: "addSubtask"): void
  (e: "trash"): void
  (e: "dragStart", id: string, event: DragEvent): void
  (e: "dragOver", id: string, event: DragEvent): void
  (e: "drop", id: string, event: DragEvent): void
  (e: "dragEnd"): void
}>()

const draft = ref("")
const inputEl = ref<HTMLInputElement | null>(null)
watch(
  () => props.editing,
  async (editing) => {
    if (!editing) return
    draft.value = props.task.title
    await nextTick()
    inputEl.value?.focus()
    inputEl.value?.select()
  },
  { immediate: true },
)

const done = computed(() => props.task.status === "done")
const overdue = computed(() => isOverdue(props.task.due, !["todo", "doing"].includes(props.task.status)))
const dueLabel = computed(() => relativeDueLabel(props.task.due, strings))
const children = computed(() => childStatsMap.value.get(props.task.id))
const shortPath = computed(() => {
  const parts = props.task.hpath.split("/").filter(Boolean)
  return parts.length > 2 ? `…/${parts.slice(-2).join("/")}` : props.task.hpath
})
const rowStyle = computed(() => ({ "--bt-depth": String(props.flat ? 0 : Math.max(0, props.depth)) }))

function commit(): void {
  if (props.editing) emit("commitTitle", draft.value)
}
</script>

<template>
  <div
    class="bt-row"
    :class="{
      'bt-row--flat': flat,
      'bt-row--selected': selected,
      'bt-row--checked': checked,
      'bt-row--done': done,
      'bt-row--archived': task.status === 'archived',
      'bt-row--overdue': overdue,
      'bt-row--muted': muted,
      'bt-row--drop-before': dropZone === 'before',
      'bt-row--drop-after': dropZone === 'after',
      'bt-row--drop-inside': dropZone === 'inside',
    }"
    :data-id="task.id"
    :style="rowStyle"
    :draggable="draggable"
    @click="emit('select', $event)"
    @dblclick.stop="emit('openDetail')"
    @dragstart.stop="emit('dragStart', task.id, $event)"
    @dragover="emit('dragOver', task.id, $event)"
    @drop.stop.prevent="emit('drop', task.id, $event)"
    @dragend="emit('dragEnd')"
  >
    <template v-if="!flat">
      <button v-if="hasChildren" type="button" class="bt-caret" :class="{ 'bt-caret--collapsed': collapsed }" @click.stop="emit('toggleCollapse')">
        <span class="bt-glyph">▾</span>
      </button>
      <span v-else class="bt-caret bt-caret--placeholder" />
    </template>
    <button type="button" class="bt-check" :class="{ 'bt-check--on': done }" :aria-label="done ? 'reopen' : 'complete'" @click.stop="emit('toggle')">
      <svg class="bt-check__icon" aria-hidden="true"><use xlink:href="#iconCheck" /></svg>
    </button>
    <div class="bt-row__body">
      <div class="bt-row__line">
        <button type="button" class="bt-pri bt-pri--chip" :class="`bt-pri--${task.priority}`" @click.stop="emit('cyclePriority')">P{{ task.priority }}</button>
        <input
          v-if="editing"
          ref="inputEl"
          v-model="draft"
          class="bt-row__input"
          @click.stop
          @keydown.enter.prevent="commit"
          @keydown.esc.prevent="emit('commitTitle', task.title)"
          @blur="commit"
        />
        <span v-else class="bt-row__title" :title="task.title" @dblclick.stop="emit('startEdit')">{{ task.title || "—" }}</span>
      </div>
      <div class="bt-row__meta">
        <span v-if="task.status === 'doing' || task.status === 'archived'" class="bt-chip bt-chip--status" :class="`bt-chip--${task.status}`">
          {{ task.status === 'doing' ? (strings.statusDoing || '执行中') : (strings.statusArchived || '已归档') }}
        </span>
        <span v-if="task.due" class="bt-chip" :class="{ 'bt-chip--danger': overdue }">{{ dueLabel }}</span>
        <span v-if="task.repeat" class="bt-chip bt-chip--ghost">↻</span>
        <span v-if="children" class="bt-chip bt-chip--ghost">{{ children.done }}/{{ children.total }}</span>
        <span v-if="task.note" class="bt-chip bt-chip--ghost">≡</span>
        <span v-if="task.category" class="bt-chip bt-chip--cat">{{ task.category }}</span>
        <span v-if="task.space === 'siyuan' && shortPath" class="bt-row__path" :title="task.hpath">{{ shortPath }}</span>
      </div>
    </div>
    <div class="bt-row__ops">
      <button v-if="task.space === 'siyuan' && task.rootId" type="button" class="bt-icon-btn" :title="strings.openInNote" @click.stop="emit('open')">
        <svg aria-hidden="true"><use xlink:href="#iconRef" /></svg>
      </button>
      <button v-if="!task.trashed" type="button" class="bt-icon-btn" :title="strings.addSubtask" @click.stop="emit('addSubtask')">
        <svg aria-hidden="true"><use xlink:href="#iconAdd" /></svg>
      </button>
      <button type="button" class="bt-icon-btn" :title="task.trashed ? strings.restoreOne : strings.trashOne" @click.stop="emit('trash')">
        <span v-if="task.trashed" class="bt-glyph">↶</span>
        <svg v-else aria-hidden="true"><use xlink:href="#iconTrashcan" /></svg>
      </button>
    </div>
  </div>
</template>
