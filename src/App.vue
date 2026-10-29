<script setup lang="ts">
import { settings } from "@/store/settings"
import { taskState } from "@/store/tasks"
import { ui } from "@/store/ui"

import AppSidebar from "@/ui/components/AppSidebar.vue"
import SettingsPanel from "@/ui/components/SettingsPanel.vue"
import TaskDetail from "@/ui/components/TaskDetail.vue"
import TaskListView from "@/ui/components/TaskListView.vue"
</script>

<template>
  <div class="bt-app" :class="{ 'bt-app--reduced': settings.reduceMotion }">
    <AppSidebar />
    <SettingsPanel v-if="ui.showSettings" />
    <TaskListView v-else />
    <TaskDetail v-if="!ui.showSettings && ui.selectedId && taskState.loaded" />
  </div>
</template>
