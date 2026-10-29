<script setup lang="ts">
import { inject, ref } from "vue"

import { sql } from "@/api/kernel"
import type { GroupBy, SortBy, ViewId } from "@/core/types"
import { strings } from "@/store/i18n"
import { loadAll } from "@/store/tasks"
import type { StorageHost } from "@/store/settings"
import { queueSaveSettings, resetSettings, STORAGE_HOST, settings } from "@/store/settings"
import { ui } from "@/store/ui"

const host = inject<StorageHost>(STORAGE_HOST)

const viewOptions: { value: ViewId; key: string }[] = [
  { value: "today", key: "today" },
  { value: "week", key: "week" },
  { value: "all", key: "all" },
  { value: "done", key: "done" },
  { value: "trash", key: "trash" },
]

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

const pickerOpen = ref(false)
const docs = ref<{ id: string; hpath: string }[]>([])

function persist(): void {
  if (!host) {
    return
  }
  ui.view = settings.defaultView
  ui.groupBy = settings.defaultGroupBy
  ui.sortBy = settings.defaultSortBy
  queueSaveSettings(host)
}

function onReset(): void {
  resetSettings()
  persist()
  void loadAll()
}

async function openPicker(): Promise<void> {
  pickerOpen.value = true
  try {
    const rows = await sql<{ id: string; hpath: string }[]>(
      "SELECT id, hpath FROM blocks WHERE type = 'd' ORDER BY updated DESC LIMIT 60",
    )
    docs.value = rows ?? []
  } catch {
    docs.value = []
  }
}

function chooseDoc(id: string): void {
  settings.defaultDocId = id
  pickerOpen.value = false
  persist()
}
</script>

<template>
  <section class="bt-settings">
    <header class="bt-toolbar">
      <h2 class="bt-settings__title">{{ strings.settingTitle || 'Settings' }}</h2>
      <span class="bt-toolbar__spacer" />
      <button class="bt-btn bt-btn--ghost" @click="ui.showSettings = false">
        {{ strings.back || 'Back' }}
      </button>
    </header>

    <div class="bt-settings__body">
      <div class="bt-field bt-field--stack">
        <dt class="bt-field__label">{{ strings.settingDefaultDoc || 'Where new tasks go' }}</dt>
        <dd class="bt-field__value">
          <p class="bt-settings__hint">{{ strings.settingDefaultDocHint || '' }}</p>
          <div class="bt-row-inline">
            <input v-model="settings.defaultDocId" class="bt-input" @change="persist" />
            <button class="bt-btn bt-btn--ghost" @click="openPicker()">
              {{ strings.settingPickDoc || 'Pick' }}
            </button>
            <button class="bt-btn bt-btn--link" @click="settings.defaultDocId = ''; persist()">
              {{ strings.repeatNone || 'None' }}
            </button>
          </div>
          <ul v-if="pickerOpen" class="bt-picker">
            <li v-for="doc in docs" :key="doc.id" class="bt-picker__item" @click="chooseDoc(doc.id)">
              {{ doc.hpath || doc.id }}
            </li>
            <li v-if="docs.length === 0" class="bt-picker__item bt-picker__item--muted">
              {{ strings.noTasks || 'No tasks' }}
            </li>
          </ul>
        </dd>
      </div>

      <div class="bt-field">
        <dt class="bt-field__label">{{ strings.settingDefaultView || 'Default view' }}</dt>
        <dd class="bt-field__value">
          <select v-model="settings.defaultView" class="bt-select" @change="persist">
            <option v-for="option in viewOptions" :key="option.value" :value="option.value">
              {{ strings[option.key] || option.value }}
            </option>
          </select>
        </dd>
      </div>

      <div class="bt-field">
        <dt class="bt-field__label">{{ strings.settingDefaultGroup || 'Default grouping' }}</dt>
        <dd class="bt-field__value">
          <select v-model="settings.defaultGroupBy" class="bt-select" @change="persist">
            <option v-for="option in groupOptions" :key="option.value" :value="option.value">
              {{ strings[option.key] || option.value }}
            </option>
          </select>
        </dd>
      </div>

      <div class="bt-field">
        <dt class="bt-field__label">{{ strings.settingDefaultSort || 'Default sorting' }}</dt>
        <dd class="bt-field__value">
          <select v-model="settings.defaultSortBy" class="bt-select" @change="persist">
            <option v-for="option in sortOptions" :key="option.value" :value="option.value">
              {{ strings[option.key] || option.value }}
            </option>
          </select>
        </dd>
      </div>

      <label class="bt-toggle">
        <input v-model="settings.repeatAdvance" type="checkbox" @change="persist" />
        <span>{{ strings.settingRepeatAdvance || 'Advance repeating tasks' }}</span>
      </label>
      <p class="bt-settings__hint">{{ strings.settingRepeatAdvanceHint || '' }}</p>

      <label class="bt-toggle">
        <input v-model="settings.showDone" type="checkbox" @change="persist" />
        <span>{{ strings.settingShowDone || 'Show completed in All' }}</span>
      </label>

      <label class="bt-toggle">
        <input v-model="settings.reduceMotion" type="checkbox" @change="persist" />
        <span>{{ strings.settingReduceMotion || 'Reduce motion' }}</span>
      </label>

      <div class="bt-settings__foot">
        <button class="bt-btn bt-btn--ghost" @click="onReset()">
          {{ strings.settingReset || 'Restore defaults' }}
        </button>
      </div>

      <div class="bt-about">
        <h3>{{ strings.aboutTitle || 'About' }}</h3>
        <p>{{ strings.aboutBody || '' }}</p>
      </div>
    </div>
  </section>
</template>
