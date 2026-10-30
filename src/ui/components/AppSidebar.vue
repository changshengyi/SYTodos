<script setup lang="ts">
import type { Scope } from "@/core/types"
import { strings } from "@/store/i18n"
import { ui } from "@/store/ui"

import { useTasks } from "../useTasks"

const { total } = useTasks()

const scopes: { id: Scope; key: string }[] = [
  { id: "all", key: "scopeAll" },
  { id: "note", key: "scopeNote" },
  { id: "space", key: "scopeSpace" },
]

function label(key: string): string {
  return strings[key] ?? key
}
</script>

<template>
  <aside class="bt-sidebar">
    <div class="bt-sidebar__head">
      <span class="bt-sidebar__title">{{ strings.pluginName || "SYTodos" }}</span>
      <span class="bt-sidebar__total">{{ (strings.totalTasks || "{n}").replace("{n}", String(total)) }}</span>
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
