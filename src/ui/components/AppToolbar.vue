<script setup lang="ts">
import { computed } from "vue"

import type { GroupBy, SortBy, ViewMode } from "@/core/types"
import { strings } from "@/store/i18n"
import { emptyTrash, loadAll, taskState } from "@/store/tasks"
import { expandAll, hasActiveFilters, ui } from "@/store/ui"
import { redo, undo } from "@/store/undo"

import { useTasks } from "../useTasks"

const { counts } = useTasks()

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

const modes: { id: ViewMode; key: string }[] = [
  { id: "list", key: "modeList" },
  { id: "tree", key: "modeTree" },
  { id: "board", key: "modeBoard" },
]

const filtered = computed(() => hasActiveFilters())

async function onEmptyTrash(): Promise<void> {
  const message = (strings.emptyTrashConfirm || "Empty trash?").replace("{n}", String(counts.value.trash))
  if (window.confirm(message)) {
    await emptyTrash()
  }
}
</script>

<template>
  <header class="bt-toolbar">
    <div class="bt-toolbar__search">
      <svg class="bt-toolbar__icon" aria-hidden="true"><use xlink:href="#iconSearch" /></svg>
      <input v-model="ui.query" class="bt-toolbar__input" :placeholder="strings.search || 'Search'" />
      <button
        class="bt-icon-btn bt-icon-btn--inline"
        :class="{ 'bt-icon-btn--on': ui.filterOpen || filtered }"
        :title="strings.filter || 'Advanced search'"
        @click="ui.filterOpen = !ui.filterOpen"
      >
        <span class="bt-glyph">≡</span>
      </button>
    </div>

    <template v-if="ui.mode !== 'board'">
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
      <button v-if="ui.mode === 'tree'" class="bt-btn bt-btn--ghost" @click="expandAll()">
        {{ strings.treeExpandAll || 'Expand all' }}
      </button>
    </template>

    <span class="bt-toolbar__spacer" />

    <button
      v-if="ui.view === 'trash'"
      class="bt-btn bt-btn--danger"
      @click="onEmptyTrash"
    >
      {{ strings.emptyTrash || 'Empty trash' }}
    </button>

    <!-- 视图切换固定在内容区右上角 -->
    <div class="bt-segment bt-toolbar__modes" :title="strings.modeTitle || 'View'">
      <button
        v-for="mode in modes"
        :key="mode.id"
        class="bt-segment__item bt-segment__item--center"
        :class="{ 'bt-segment__item--on': ui.mode === mode.id }"
        @click="ui.mode = mode.id"
      >
        {{ strings[mode.key] || mode.id }}
      </button>
    </div>

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
</template>
