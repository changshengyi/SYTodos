<script setup lang="ts">
import type { DueFilter, Priority, TaskStatus, ViewId } from "@/core/types"
import { PRIORITIES, STATUSES } from "@/core/types"
import { strings } from "@/store/i18n"
import {
  hasActiveFilters,
  resetFilters,
  togglePriorityFilter,
  toggleStatusFilter,
  ui,
} from "@/store/ui"

import { useTasks } from "../useTasks"

const { counts, statusCounts } = useTasks()

const timeViews: { id: ViewId; key: string }[] = [
  { id: "today", key: "today" },
  { id: "week", key: "week" },
  { id: "all", key: "all" },
  { id: "trash", key: "trash" },
]

const dueOptions: { value: DueFilter; key: string }[] = [
  { value: "any", key: "dueAny" },
  { value: "overdue", key: "dueOverdue" },
  { value: "today", key: "dueToday" },
  { value: "week", key: "dueWeek" },
  { value: "none", key: "dueNone" },
]

function timeCount(view: ViewId): number {
  switch (view) {
    case "today":
      return counts.value.today
    case "week":
      return counts.value.week
    case "trash":
      return counts.value.trash
    default:
      return counts.value.all
  }
}

function statusLabel(status: TaskStatus): string {
  switch (status) {
    case "doing":
      return strings.statusDoing || "Doing"
    case "done":
      return strings.statusDone || "Done"
    case "archived":
      return strings.statusArchived || "Archived"
    default:
      return strings.statusTodo || "To do"
  }
}

function priorityLabel(priority: Priority): string {
  return strings[`priority${priority}`] || `P${priority}`
}
</script>

<template>
  <div class="bt-filter">
    <div class="bt-filter__row">
      <span class="bt-filter__label">{{ strings.timeTitle || 'Time' }}</span>
      <div class="bt-segment">
        <button
          v-for="view in timeViews"
          :key="view.id"
          class="bt-segment__item bt-segment__item--center"
          :class="{ 'bt-segment__item--on': ui.view === view.id }"
          @click="ui.view = view.id"
        >
          {{ strings[view.key] || view.id }}
          <span v-if="timeCount(view.id)" class="bt-segment__count">{{ timeCount(view.id) }}</span>
        </button>
      </div>

      <span class="bt-filter__divider" />

      <span class="bt-filter__label">{{ strings.filterStatus || 'Status' }}</span>
      <button
        v-for="status in STATUSES"
        :key="status"
        class="bt-chip-filter"
        :class="[`bt-chip-filter--${status}`, { 'bt-chip-filter--on': ui.statuses.includes(status) }]"
        @click="toggleStatusFilter(status)"
      >
        {{ statusLabel(status) }}
        <span class="bt-chip-filter__count">{{ statusCounts[status] }}</span>
      </button>
    </div>

    <div v-if="ui.filterOpen" class="bt-filter__row">
      <span class="bt-filter__label">{{ strings.filterPriority || 'Priority' }}</span>
      <button
        v-for="priority in PRIORITIES"
        :key="priority"
        class="bt-pri bt-pri--chip"
        :class="[`bt-pri--${priority}`, { 'bt-pri--on': ui.priorities.includes(priority) }]"
        :title="priorityLabel(priority)"
        @click="togglePriorityFilter(priority)"
      >
        P{{ priority }}
      </button>

      <span class="bt-filter__label bt-filter__label--gap">{{ strings.filterDue || 'Due' }}</span>
      <select v-model="ui.dueFilter" class="bt-select">
        <option v-for="option in dueOptions" :key="option.value" :value="option.value">
          {{ strings[option.key] || option.value }}
        </option>
      </select>

      <span class="bt-filter__label bt-filter__label--gap">{{ strings.filterCategory || 'Category' }}</span>
      <input v-model="ui.category" class="bt-input bt-input--filter" placeholder="…" />

      <button v-if="hasActiveFilters()" class="bt-btn bt-btn--link" @click="resetFilters()">
        {{ strings.filterReset || 'Clear' }}
      </button>
    </div>
  </div>
</template>
