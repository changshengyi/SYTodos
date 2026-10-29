<script setup lang="ts">
import { computed } from "vue"

import type { ViewId } from "@/core/types"
import { strings } from "@/store/i18n"
import { ui } from "@/store/ui"

import { useTasks } from "../useTasks"

const { counts, total } = useTasks()

const views: { id: ViewId; key: string; icon: string }[] = [
  { id: "today", key: "today", icon: "iconCalendar" },
  { id: "week", key: "week", icon: "iconList" },
  { id: "all", key: "all", icon: "iconCheck" },
  { id: "done", key: "done", icon: "iconEdit" },
  { id: "trash", key: "trash", icon: "iconTrashcan" },
]

const counters = computed<Record<ViewId, number>>(() => ({
  today: counts.value.today,
  week: counts.value.week,
  all: counts.value.all,
  done: counts.value.done,
  trash: counts.value.trash,
}))

function labelOf(key: string): string {
  return strings[key] ?? key
}
</script>

<template>
  <aside class="bt-sidebar">
    <div class="bt-sidebar__head">
      <span class="bt-sidebar__title">{{ strings.pluginName || "BlockTodo" }}</span>
      <span class="bt-sidebar__total">{{ strings.totalTasks?.replace("{n}", String(total)) ?? total }}</span>
    </div>

    <nav class="bt-nav">
      <button
        v-for="view in views"
        :key="view.id"
        class="bt-nav__item"
        :class="{ 'bt-nav__item--active': ui.view === view.id && !ui.showSettings }"
        @click="ui.view = view.id; ui.showSettings = false"
      >
        <svg class="bt-nav__icon" aria-hidden="true"><use :xlink:href="`#${view.icon}`" /></svg>
        <span class="bt-nav__label">{{ labelOf(view.key) }}</span>
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
