<script setup lang="ts">
import { computed } from "vue"

import type { ViewMode } from "@/core/types"
import { strings } from "@/store/i18n"
import { loadAll, taskIndex, taskState } from "@/store/tasks"
import { collapseAll, expandAll, hasActiveFilters, openCreate, ui } from "@/store/ui"
import { redo, undo } from "@/store/undo"

import { useTasks } from "../useTasks"
import { emptyTrashWithConfirmation } from "../useDeleteActions"

const { counts } = useTasks()
const modes: { id: ViewMode; key: string }[] = [
  { id: "list", key: "modeList" },
  { id: "tree", key: "modeTree" },
  { id: "board", key: "modeBoard" },
]
const filtered = computed(() => hasActiveFilters())

async function onEmptyTrash(): Promise<void> {
  await emptyTrashWithConfirmation(ui.space)
}

function collapse(): void {
  const trashed = ui.view === "trash"
  const parentIds = new Set<string>()
  for (const task of taskIndex().values()) {
    if (task.parentId && task.space === ui.space && task.trashed === trashed) parentIds.add(task.parentId)
  }
  collapseAll(Array.from(parentIds))
}
</script>

<template>
  <header class="bt-toolbar">
    <div class="bt-toolbar__search">
      <svg class="bt-toolbar__icon" aria-hidden="true"><use xlink:href="#iconSearch" /></svg>
      <input v-model="ui.query" class="bt-toolbar__input" :placeholder="strings.search" />
    </div>
    <button type="button" class="bt-icon-btn" :class="{ 'bt-icon-btn--on': ui.filterOpen || filtered }" :title="strings.filter" :aria-label="strings.filter" @click="ui.filterOpen = !ui.filterOpen">
      <svg class="bt-toolbar__icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 5h18l-7 8v6l-4 2v-8L3 5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>
    <button type="button" class="bt-icon-btn" :title="strings.createTitle" :disabled="ui.view === 'trash'" @click="openCreate()"><span class="bt-glyph">+</span></button>
    <template v-if="ui.mode === 'tree'">
      <button type="button" class="bt-btn bt-btn--ghost" @click="expandAll">{{ strings.treeExpandAll }}</button>
      <button type="button" class="bt-btn bt-btn--ghost" @click="collapse">{{ strings.treeCollapseAll }}</button>
    </template>
    <span class="bt-toolbar__spacer" />
    <button v-if="ui.view === 'trash'" type="button" class="bt-btn bt-btn--danger" :disabled="!counts.trash" @click="onEmptyTrash">{{ strings.emptyTrash }}</button>
    <div class="bt-segment bt-toolbar__modes">
      <button v-for="mode in modes" :key="mode.id" type="button" class="bt-segment__item bt-segment__item--center" :class="{ 'bt-segment__item--on': ui.mode === mode.id }" @click="ui.mode = mode.id">
        {{ strings[mode.key] }}
      </button>
    </div>
    <button type="button" class="bt-icon-btn" :title="strings.help" @click="ui.showHelp = !ui.showHelp"><span class="bt-glyph">?</span></button>
    <button type="button" class="bt-icon-btn" :title="strings.undo" :disabled="!taskState.undoDepth" @click="undo"><span class="bt-glyph">↶</span></button>
    <button type="button" class="bt-icon-btn" :title="strings.redo" :disabled="!taskState.redoDepth" @click="redo"><span class="bt-glyph">↷</span></button>
    <button type="button" class="bt-icon-btn" :title="strings.refresh" :disabled="taskState.loading" @click="loadAll"><svg aria-hidden="true"><use xlink:href="#iconRefresh" /></svg></button>
  </header>
</template>
