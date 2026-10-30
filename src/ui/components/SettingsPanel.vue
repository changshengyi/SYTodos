<script setup lang="ts">
import { inject, ref } from "vue"

import { sql } from "@/api/kernel"
import type { GroupBy, SortBy, ViewId, ViewMode } from "@/core/types"
import { openInNote } from "@/store/host"
import { strings } from "@/store/i18n"
import { ensureSpaceDoc, loadAll, redecorateAll } from "@/store/tasks"
import type { StorageHost } from "@/store/settings"
import { queueSaveSettings, resetSettings, STORAGE_HOST, settings } from "@/store/settings"
import { ui } from "@/store/ui"

const host = inject<StorageHost>(STORAGE_HOST)

const viewOptions: { value: ViewId; key: string }[] = [
  { value: "today", key: "today" },
  { value: "week", key: "week" },
  { value: "all", key: "all" },
  { value: "trash", key: "trash" },
]

const modeOptions: { value: ViewMode; key: string }[] = [
  { value: "list", key: "modeList" },
  { value: "tree", key: "modeTree" },
  { value: "board", key: "modeBoard" },
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
const pickerTarget = ref<"note" | "space">("note")
const docs = ref<{ id: string; hpath: string }[]>([])
const spaceBusy = ref(false)

function persist(): void {
  if (!host) {
    return
  }
  ui.view = settings.defaultView
  ui.mode = settings.defaultMode
  ui.groupBy = settings.defaultGroupBy
  ui.sortBy = settings.defaultSortBy
  queueSaveSettings(host)
}

function onReset(): void {
  resetSettings()
  persist()
  void loadAll()
}

async function openPicker(target: "note" | "space"): Promise<void> {
  pickerTarget.value = target
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
  if (pickerTarget.value === "note") {
    settings.defaultDocId = id
  } else {
    settings.spaceDocId = id
    redecorateAll()
  }
  pickerOpen.value = false
  persist()
}

async function initSpace(): Promise<void> {
  spaceBusy.value = true
  try {
    await ensureSpaceDoc()
    persist()
    await loadAll()
    ui.scope = "space"
    ui.mode = "tree"
    ui.showSettings = false
  } finally {
    spaceBusy.value = false
  }
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
      <section class="bt-settings__group">
        <h3 class="bt-settings__group-title">{{ strings.spaceTitle || 'Workspace tree' }}</h3>
        <p class="bt-settings__hint">{{ strings.spaceHint || '' }}</p>
        <div class="bt-field">
          <dt class="bt-field__label">{{ strings.spaceDoc || 'Tree document' }}</dt>
          <dd class="bt-field__value">
            <input v-model="settings.spaceDocId" class="bt-input" @change="persist(); redecorateAll()" />
            <button class="bt-btn bt-btn--ghost" @click="openPicker('space')">
              {{ strings.settingPickDoc || 'Pick' }}
            </button>
            <button
              v-if="settings.spaceDocId"
              class="bt-btn bt-btn--link"
              @click="openInNote(settings.spaceDocId)"
            >
              {{ strings.spaceOpenDoc || 'Open' }}
            </button>
          </dd>
        </div>
        <p class="bt-settings__hint">{{ strings.spaceDocHint || '' }}</p>
        <button class="bt-btn bt-btn--ghost" :disabled="spaceBusy" @click="initSpace()">
          {{ settings.spaceDocId ? (strings.spaceRegenerate || 'Recreate') : (strings.spaceCreate || 'Initialize') }}
        </button>
      </section>

      <section class="bt-settings__group">
        <h3 class="bt-settings__group-title">{{ strings.settingDefaultDoc || 'Where note tasks go' }}</h3>
        <div class="bt-field">
          <dt class="bt-field__label">{{ strings.settingDefaultDoc || 'Document' }}</dt>
          <dd class="bt-field__value">
            <input v-model="settings.defaultDocId" class="bt-input" @change="persist" />
            <button class="bt-btn bt-btn--ghost" @click="openPicker('note')">
              {{ strings.settingPickDoc || 'Pick' }}
            </button>
            <button class="bt-btn bt-btn--link" @click="settings.defaultDocId = ''; persist()">
              {{ strings.repeatNone || 'None' }}
            </button>
          </dd>
        </div>
        <p class="bt-settings__hint">{{ strings.settingDefaultDocHint || '' }}</p>
      </section>

      <ul v-if="pickerOpen" class="bt-picker">
        <li v-for="doc in docs" :key="doc.id" class="bt-picker__item" @click="chooseDoc(doc.id)">
          {{ doc.hpath || doc.id }}
        </li>
        <li v-if="docs.length === 0" class="bt-picker__item bt-picker__item--muted">
          {{ strings.noTasks || 'No tasks' }}
        </li>
      </ul>

      <section class="bt-settings__group">
        <h3 class="bt-settings__group-title">{{ strings.settingDefaultView || 'Defaults' }}</h3>
        <div class="bt-field">
          <dt class="bt-field__label">{{ strings.settingDefaultView || 'View' }}</dt>
          <dd class="bt-field__value">
            <select v-model="settings.defaultView" class="bt-select" @change="persist">
              <option v-for="option in viewOptions" :key="option.value" :value="option.value">
                {{ strings[option.key] || option.value }}
              </option>
            </select>
          </dd>
        </div>
        <div class="bt-field">
          <dt class="bt-field__label">{{ strings.settingDefaultMode || 'Mode' }}</dt>
          <dd class="bt-field__value">
            <select v-model="settings.defaultMode" class="bt-select" @change="persist">
              <option v-for="option in modeOptions" :key="option.value" :value="option.value">
                {{ strings[option.key] || option.value }}
              </option>
            </select>
          </dd>
        </div>
        <div class="bt-field">
          <dt class="bt-field__label">{{ strings.settingDefaultGroup || 'Group' }}</dt>
          <dd class="bt-field__value">
            <select v-model="settings.defaultGroupBy" class="bt-select" @change="persist">
              <option v-for="option in groupOptions" :key="option.value" :value="option.value">
                {{ strings[option.key] || option.value }}
              </option>
            </select>
          </dd>
        </div>
        <div class="bt-field">
          <dt class="bt-field__label">{{ strings.settingDefaultSort || 'Sort' }}</dt>
          <dd class="bt-field__value">
            <select v-model="settings.defaultSortBy" class="bt-select" @change="persist">
              <option v-for="option in sortOptions" :key="option.value" :value="option.value">
                {{ strings[option.key] || option.value }}
              </option>
            </select>
          </dd>
        </div>
      </section>

      <label class="bt-toggle">
        <input v-model="settings.repeatAdvance" type="checkbox" @change="persist" />
        <span>{{ strings.settingRepeatAdvance || 'Advance repeating tasks' }}</span>
      </label>
      <p class="bt-settings__hint">{{ strings.settingRepeatAdvanceHint || '' }}</p>

      <label class="bt-toggle">
        <input v-model="settings.showDone" type="checkbox" @change="persist" />
        <span>{{ strings.settingShowDone || 'Include done in All' }}</span>
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
