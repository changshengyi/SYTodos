<script setup lang="ts">
import { computed, onMounted, ref } from "vue"

import { listDocuments, listNotebooks } from "@/api/kernel"
import type { GroupBy, SortBy, ViewId, ViewMode } from "@/core/types"
import { strings } from "@/store/i18n"
import { persistSettings, resetSettings, settings, settingsState } from "@/store/settings"
import { ui } from "@/store/ui"

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
const notebooks = ref<{ id: string; name: string; closed: boolean }[]>([])
const docs = ref<{ id: string; hpath: string; box: string }[]>([])
const pickerOpen = ref(false)
const docQuery = ref("")
const loadError = ref("")
const filteredDocs = computed(() => {
  const needle = docQuery.value.trim().toLocaleLowerCase()
  return docs.value.filter((doc) => !needle || doc.hpath.toLocaleLowerCase().includes(needle)).slice(0, 80)
})
const currentDoc = computed(() => docs.value.find((doc) => doc.id === settings.defaultDocId))

onMounted(async () => {
  try {
    ;[notebooks.value, docs.value] = await Promise.all([listNotebooks(), listDocuments()])
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : String(error)
  }
})

function applyDefaults(): void {
  ui.space = settings.defaultSpace
  ui.view = settings.defaultView
  ui.mode = settings.defaultMode
  ui.groupBy = settings.defaultGroupBy
  ui.sortBy = settings.defaultSortBy
}

async function reset(): Promise<void> {
  if (await resetSettings()) applyDefaults()
}

function chooseDoc(id: string): void {
  settings.defaultDocId = id
  pickerOpen.value = false
  void persistSettings()
}
</script>

<template>
  <section class="bt-settings">
    <header class="bt-toolbar">
      <h2 class="bt-settings__title">{{ strings.settingTitle }}</h2>
      <span v-if="settingsState.saving" class="bt-modal__hint">{{ strings.saving || '保存中…' }}</span>
      <span class="bt-toolbar__spacer" />
      <button type="button" class="bt-btn bt-btn--ghost" @click="ui.showSettings = false">{{ strings.back }}</button>
    </header>
    <div class="bt-settings__body">
      <p v-if="loadError" class="bt-form-error">{{ loadError }}</p>
      <section class="bt-settings__group">
        <h3 class="bt-settings__group-title">{{ strings.settingSpace }}</h3>
        <p class="bt-settings__hint">{{ strings.settingSpaceHint }}</p>
        <label class="bt-field"><span class="bt-field__label">{{ strings.settingDefaultSpace }}</span>
          <select v-model="settings.defaultSpace" class="bt-select" @change="persistSettings"><option value="siyuan">{{ strings.spaceSiyuan }}</option><option value="local">{{ strings.spaceLocal }}</option></select>
        </label>
      </section>
      <section class="bt-settings__group">
        <h3 class="bt-settings__group-title">{{ strings.settingDefaultDoc }}</h3>
        <p class="bt-settings__hint">{{ strings.settingDefaultDocHint }}</p>
        <label class="bt-field"><span class="bt-field__label">{{ strings.settingNotebook }}</span>
          <select v-model="settings.defaultBox" class="bt-select" @change="persistSettings">
            <option value="">{{ strings.settingNotebookAuto }}</option>
            <option v-for="notebook in notebooks.filter((item) => !item.closed)" :key="notebook.id" :value="notebook.id">{{ notebook.name }}</option>
          </select>
        </label>
        <div class="bt-field"><span class="bt-field__label">{{ strings.settingDefaultDocPath }}</span>
          <div class="bt-field__value">
            <input v-model="settings.defaultDocId" class="bt-input" :placeholder="currentDoc?.hpath || ''" @change="persistSettings" />
            <button type="button" class="bt-btn bt-btn--ghost" @click="pickerOpen = !pickerOpen">{{ strings.settingPickDoc }}</button>
            <button type="button" class="bt-btn bt-btn--link" @click="settings.defaultDocId = ''; persistSettings()">{{ strings.settingClear }}</button>
          </div>
        </div>
        <p v-if="currentDoc" class="bt-settings__hint">{{ currentDoc.hpath }}</p>
        <div v-if="pickerOpen" class="bt-picker">
          <input v-model="docQuery" class="bt-input bt-input--block" :placeholder="strings.search" />
          <button v-for="doc in filteredDocs" :key="doc.id" type="button" class="bt-picker__item" @click="chooseDoc(doc.id)">{{ doc.hpath || doc.id }}</button>
          <p v-if="!filteredDocs.length" class="bt-picker__item bt-picker__item--muted">{{ strings.noTasks }}</p>
        </div>
      </section>
      <section class="bt-settings__group">
        <h3 class="bt-settings__group-title">{{ strings.settingDefaultView }}</h3>
        <label class="bt-field"><span class="bt-field__label">{{ strings.timeTitle }}</span><select v-model="settings.defaultView" class="bt-select" @change="persistSettings"><option v-for="option in viewOptions" :key="option.value" :value="option.value">{{ strings[option.key] }}</option></select></label>
        <label class="bt-field"><span class="bt-field__label">{{ strings.settingDefaultMode }}</span><select v-model="settings.defaultMode" class="bt-select" @change="persistSettings"><option v-for="option in modeOptions" :key="option.value" :value="option.value">{{ strings[option.key] }}</option></select></label>
        <label class="bt-field"><span class="bt-field__label">{{ strings.settingDefaultGroup }}</span><select v-model="settings.defaultGroupBy" class="bt-select" @change="persistSettings"><option v-for="option in groupOptions" :key="option.value" :value="option.value">{{ strings[option.key] }}</option></select></label>
        <label class="bt-field"><span class="bt-field__label">{{ strings.settingDefaultSort }}</span><select v-model="settings.defaultSortBy" class="bt-select" @change="persistSettings"><option v-for="option in sortOptions" :key="option.value" :value="option.value">{{ strings[option.key] }}</option></select></label>
      </section>
      <label class="bt-toggle"><input v-model="settings.repeatAdvance" type="checkbox" @change="persistSettings" /><span>{{ strings.settingRepeatAdvance }}</span></label>
      <p class="bt-settings__hint">{{ strings.settingRepeatAdvanceHint }}</p>
      <label class="bt-toggle"><input v-model="settings.showDone" type="checkbox" @change="persistSettings" /><span>{{ strings.settingShowDone }}</span></label>
      <label class="bt-toggle"><input v-model="settings.reduceMotion" type="checkbox" @change="persistSettings" /><span>{{ strings.settingReduceMotion }}</span></label>
      <div class="bt-settings__foot"><button type="button" class="bt-btn bt-btn--ghost" @click="reset">{{ strings.settingReset }}</button></div>
      <div class="bt-about"><h3>{{ strings.aboutTitle }}</h3><p>{{ strings.aboutBody }}</p></div>
    </div>
  </section>
</template>
