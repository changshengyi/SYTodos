<script setup lang="ts">
import { computed, ref } from "vue"

import { REPEAT_PRESETS, fromInputValue, toInputValue } from "@/core/date"
import type { TaskForm } from "@/core/form"
import type { Priority, TaskStatus } from "@/core/types"
import { PRIORITIES, STATUSES } from "@/core/types"
import { strings } from "@/store/i18n"

/**
 * 任务表单的唯一实现。
 * 新建弹窗与详情弹窗都渲染这个组件，字段集合与顺序只有一处定义。
 */
const props = withDefaults(
  defineProps<{
    modelValue: TaskForm
    parentOptions: { id: string; depth: number; title: string }[]
    categories?: string[]
  }>(),
  { categories: () => [] },
)

const emit = defineEmits<{
  (e: "update:modelValue", value: TaskForm): void
}>()

const form = computed(() => props.modelValue)
const titleEl = ref<HTMLInputElement | null>(null)

function set<K extends keyof TaskForm>(key: K, value: TaskForm[K]): void {
  if (form.value[key] === value) {
    return
  }
  emit("update:modelValue", { ...form.value, [key]: value })
}

function onText(key: "title" | "category" | "note", event: Event): void {
  set(key, (event.target as HTMLInputElement | HTMLTextAreaElement).value)
}

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

function priorityLabel(priority: Priority): string {
  return strings[`priority${priority}`] || `P${priority}`
}

const parentIndent = (depth: number): string => "　".repeat(depth)

defineExpose({
  focusTitle: () => titleEl.value?.focus(),
})
</script>

<template>
  <div class="bt-form-stack">
    <div class="bt-form-row">
      <span class="bt-form-row__label">{{ strings.taskTitle || "标题" }}</span>
      <div class="bt-form-row__control">
        <input
          ref="titleEl"
          class="bt-input bt-input--block"
          :value="form.title"
          :placeholder="strings.taskTitle || 'Title'"
          @input="onText('title', $event)"
        />
      </div>
    </div>

    <div class="bt-form-row">
      <span class="bt-form-row__label">{{ strings.parentTask || "父任务" }}</span>
      <div class="bt-form-row__control">
        <select
          class="bt-select bt-input--block"
          :value="form.parentId"
          @change="set('parentId', ($event.target as HTMLSelectElement).value)"
        >
          <option value="">{{ strings.parentNone || "（作为根任务）" }}</option>
          <option v-for="item in parentOptions" :key="item.id" :value="item.id">
            {{ parentIndent(item.depth) + item.title }}
          </option>
        </select>
      </div>
    </div>

    <div class="bt-form-row">
      <span class="bt-form-row__label">{{ strings.priority || "优先级" }}</span>
      <div class="bt-form-row__control">
        <button
          v-for="p in PRIORITIES"
          :key="p"
          class="bt-pri bt-pri--chip"
          :class="[`bt-pri--${p}`, { 'bt-pri--on': form.priority === p }]"
          :title="priorityLabel(p)"
          @click="set('priority', p)"
        >
          P{{ p }}
        </button>
      </div>
    </div>

    <div class="bt-form-row">
      <span class="bt-form-row__label">{{ strings.statusTitle || "状态" }}</span>
      <div class="bt-form-row__control">
        <button
          v-for="item in STATUSES"
          :key="item"
          class="bt-status-chip"
          :class="[`bt-status-chip--${item}`, { 'bt-status-chip--on': form.status === item }]"
          @click="set('status', item)"
        >
          {{ statusLabel(item) }}
        </button>
      </div>
    </div>

    <div class="bt-form-row">
      <span class="bt-form-row__label">{{ strings.startTime || "起始时间" }}</span>
      <div class="bt-form-row__control">
        <input
          class="bt-input bt-input--block"
          type="datetime-local"
          step="1"
          :value="toInputValue(form.start)"
          @change="set('start', fromInputValue(($event.target as HTMLInputElement).value))"
        />
      </div>
    </div>

    <div class="bt-form-row">
      <span class="bt-form-row__label">{{ strings.endTime || "截止时间" }}</span>
      <div class="bt-form-row__control">
        <input
          class="bt-input bt-input--block"
          type="datetime-local"
          step="1"
          :value="toInputValue(form.due)"
          @change="set('due', fromInputValue(($event.target as HTMLInputElement).value))"
        />
      </div>
    </div>

    <div class="bt-form-row">
      <span class="bt-form-row__label">{{ strings.repeat || "重复" }}</span>
      <div class="bt-form-row__control">
        <select
          class="bt-select bt-input--block"
          :value="form.repeat"
          @change="set('repeat', ($event.target as HTMLSelectElement).value)"
        >
          <option v-for="option in REPEAT_PRESETS" :key="option.value" :value="option.value">
            {{ strings[option.key] || option.value }}
          </option>
        </select>
      </div>
    </div>

    <div class="bt-form-row">
      <span class="bt-form-row__label">{{ strings.category || "分类" }}</span>
      <div class="bt-form-row__control">
        <input
          class="bt-input bt-input--block"
          list="bt-form-categories"
          :value="form.category"
          @input="onText('category', $event)"
        />
        <datalist id="bt-form-categories">
          <option v-for="name in categories" :key="name" :value="name" />
        </datalist>
      </div>
    </div>

    <div class="bt-form-row bt-form-row--stack">
      <span class="bt-form-row__label">{{ strings.note || "备注" }}</span>
      <div class="bt-form-row__control">
        <textarea class="bt-textarea" rows="4" :value="form.note" @input="onText('note', $event)" />
      </div>
    </div>
  </div>
</template>
