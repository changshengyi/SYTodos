<script setup lang="ts">
import type { DueFilter, Priority, TaskStatus } from "@/core/types"
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

const { statusCounts } = useTasks()

const dueOptions: { value: DueFilter; key: string }[] = [
  { value: "any", key: "dueAny" },
  { value: "overdue", key: "dueOverdue" },
  { value: "today", key: "dueToday" },
  { value: "week", key: "dueWeek" },
  { value: "none", key: "dueNone" },
]

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

    <div class="bt-filter__row">
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
