<script setup lang="ts">
import { computed } from "vue"

import type { Scope, ViewId, ViewMode } from "@/core/types"
import { strings } from "@/store/i18n"
import { ui } from "@/store/ui"

import { useTasks } from "../useTasks"

const { counts } = useTasks()

const views: { id: ViewId; key: string; icon: string }[] = [
  { id: "today", key: "today", icon: "iconCalendar" },
  { id: "week", key: "week", icon: "iconList" },
  { id: "all", key: "all", icon: "iconCheck" },
  { id: "trash", key: "trash", icon: "iconTrashcan" },
]

const scopes: { id: Scope; key: string }[] = [
  { id: "all", key: "scopeAll" },
  { id: "note", key: "scopeNote" },
  { id: "space", key: "scopeSpace" },
]

const modes: { id: ViewMode; key: string }[] = [
  { id: "list", key: "modeList" },
  { id: "tree", key: "modeTree" },
  { id: "board", key: "modeBoard" },
]

const counters = computed<Record<ViewId, number>>(() => ({
  today: counts.value.today,
  week: counts.value.week,
  all: counts.value.all,
  trash: counts.value.trash,
}))

function label(key: string): string {
  return strings[key] ?? key
}
</script>

<template>
  <aside class="bt-sidebar">
    <div class="bt-sidebar__head">
      <span class="bt-sidebar__title">{{ strings.pluginName || "BlockTodo" }}</span>
    </div>

    <div class="bt-sidebar__section">{{ strings.scopeTitle || "Scope" }}</div>
    <nav class="bt-nav">
      <button
        v-for="scope in scopes"
        :key="scope.id"
        class="bt-nav__item bt-nav__item--compact"
        :class="{ 'bt-nav__item--active': ui.scope === scope.id && !ui.showSettings }"
        @click="ui.scope = scope.id; ui.showSettings = false"
      >
        <span class="bt-dot" :class="`bt-dot--${scope.id}`" />
        <span class="bt-nav__label">{{ label(scope.key) }}</span>
      </button>
    </nav>

    <div class="bt-sidebar__section">{{ strings.modeTitle || "View" }}</div>
    <div class="bt-segment bt-segment--vertical">
      <button
        v-for="mode in modes"
        :key="mode.id"
        class="bt-segment__item"
        :class="{ 'bt-segment__item--on': ui.mode === mode.id }"
        @click="ui.mode = mode.id; ui.showSettings = false"
      >
        {{ label(mode.key) }}
      </button>
    </div>

    <div class="bt-sidebar__section">{{ strings.today || "Today" }}</div>
    <nav class="bt-nav">
      <button
        v-for="view in views"
        :key="view.id"
        class="bt-nav__item"
        :class="{ 'bt-nav__item--active': ui.view === view.id && !ui.showSettings }"
        @click="ui.view = view.id; ui.showSettings = false"
      >
        <svg class="bt-nav__icon" aria-hidden="true"><use :xlink:href="`#${view.icon}`" /></svg>
        <span class="bt-nav__label">{{ label(view.key) }}</span>
        <span v-if="counters[view.id]" class="bt-nav__count">{{ counters[view.id] }}</span>
      </button>
    </nav>

    <div class="bt-sidebar__spacer" />

    <button
      class="bt-nav__item"
      :class="{ 'bt-nav__item--active': ui.showSettings }"
      @click="ui.showSettings = true"
    >
      <svg class="bt-nav__icon" aria-hidden="true"><use xlink:href="#iconSettings" /></svg>
      <span class="bt-nav__label">{{ strings.settings || "Settings" }}</span>
    </button>
  </aside>
</template>
