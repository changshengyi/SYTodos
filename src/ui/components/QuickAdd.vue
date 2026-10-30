<script setup lang="ts">
import { computed, nextTick, ref } from "vue"

import { today } from "@/core/date"
import type { Priority } from "@/core/types"
import { PRIORITIES } from "@/core/types"
import { strings } from "@/store/i18n"
import { createTask } from "@/store/tasks"
import { ui } from "@/store/ui"

const draft = ref("")
const inputEl = ref<HTMLInputElement | null>(null)
const busy = ref(false)
const expanded = ref(false)
const withToday = ref(false)
const priority = ref<Priority>(3)

/** 独立空间模式下，新任务创建为空间根节点 */
const inSpace = computed(() => ui.scope === "space")

async function submit(): Promise<void> {
  const title = draft.value.trim()
  if (!title || busy.value) {
    return
  }
  busy.value = true
  try {
    await createTask({
      title,
      priority: priority.value,
      due: withToday.value ? today() : "",
      scope: inSpace.value ? "space" : "note",
    })
    draft.value = ""
    withToday.value = false
    priority.value = 3
    await nextTick()
    inputEl.value?.focus()
  } finally {
    busy.value = false
  }
}

function focus(): void {
  inputEl.value?.focus()
}

defineExpose({ focus })
</script>

<template>
  <div class="bt-quick">
    <div class="bt-quick__row">
      <svg class="bt-quick__icon" aria-hidden="true"><use xlink:href="#iconAdd" /></svg>
      <input
        ref="inputEl"
        v-model="draft"
        class="bt-quick__input"
        :placeholder="strings.addPlaceholder || 'Add a task'"
        @keydown.enter.prevent="submit"
        @focus="expanded = true"
      />
      <span v-if="inSpace" class="bt-quick__scope">{{ strings.spaceTitle || 'Workspace' }}</span>
      <button class="bt-btn bt-btn--ghost" :disabled="busy" @click="submit">
        {{ strings.addTitle || "Add" }}
      </button>
    </div>

    <div v-if="expanded" class="bt-quick__opts">
      <button
        v-for="p in PRIORITIES"
        :key="p"
        class="bt-pri bt-pri--chip"
        :class="[`bt-pri--${p}`, { 'bt-pri--on': priority === p }]"
        :title="strings[`priority${p}`]"
        @click="priority = p"
      >
        P{{ p }}
      </button>
      <label class="bt-quick__check">
        <input v-model="withToday" type="checkbox" />
        <span>{{ strings.today || "Today" }}</span>
      </label>
    </div>
  </div>
</template>
