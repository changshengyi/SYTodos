<script setup lang="ts">
import type { SpaceId } from "@/core/types"
import { flushAllDrafts } from "@/store/drafts"
import { strings } from "@/store/i18n"
import { resetSelection, ui } from "@/store/ui"

import { useTasks } from "../useTasks"

const { spaceCounts } = useTasks()
const spaces: { id: SpaceId; label: string; hint: string }[] = [
  { id: "siyuan", label: "spaceSiyuan", hint: "spaceSiyuanHint" },
  { id: "local", label: "spaceLocal", hint: "spaceLocalHint" },
]

async function selectSpace(id: SpaceId): Promise<void> {
  if (ui.space !== id && !(await flushAllDrafts())) return
  ui.space = id
  ui.showSettings = false
  resetSelection()
}
</script>

<template>
  <aside class="bt-sidebar">
    <div class="bt-sidebar__head">
      <span class="bt-sidebar__title">{{ strings.pluginName }}</span>
      <span class="bt-sidebar__total">{{ strings.totalTasks.replace('{n}', String(spaceCounts[ui.space])) }}</span>
    </div>
    <div class="bt-sidebar__section">{{ strings.spaceTitle }}</div>
    <nav class="bt-nav">
      <button v-for="space in spaces" :key="space.id" type="button" class="bt-nav__item bt-nav__item--space" :class="{ 'bt-nav__item--active': ui.space === space.id && !ui.showSettings }" :title="strings[space.hint]" @click="selectSpace(space.id)">
        <span class="bt-dot" :class="`bt-dot--${space.id}`" />
        <span class="bt-nav__body"><span class="bt-nav__label">{{ strings[space.label] }}</span><span class="bt-nav__hint">{{ strings[space.hint] }}</span></span>
        <span class="bt-nav__count">{{ spaceCounts[space.id] }}</span>
      </button>
    </nav>
    <div class="bt-sidebar__spacer" />
    <button type="button" class="bt-nav__item" :class="{ 'bt-nav__item--active': ui.showSettings }" @click="ui.showSettings = true">
      <svg class="bt-nav__icon" aria-hidden="true"><use xlink:href="#iconSettings" /></svg><span class="bt-nav__label">{{ strings.settings }}</span>
    </button>
  </aside>
</template>
