<script setup lang="ts">
import type { DueFilter, GroupBy, Priority, SortBy, TaskStatus, ViewId } from "@/core/types"
import { PRIORITIES, STATUSES } from "@/core/types"
import { strings } from "@/store/i18n"
import { hasActiveFilters, resetFilters, togglePriorityFilter, toggleStatusFilter, ui } from "@/store/ui"

import { useTasks } from "../useTasks"

const { statusCounts, counts } = useTasks()

const viewOptions: { value: ViewId; key: string; fallback: string }[] = [
  { value: "today", key: "today", fallback: "今天" },
  { value: "week", key: "week", fallback: "近七天" },
  { value: "all", key: "all", fallback: "全部" },
  { value: "trash", key: "trash", fallback: "回收站" },
]

function viewCount(view: ViewId): number {
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

const dueOptions: { value: DueFilter; key: string; fallback: string }[] = [
  { value: "any", key: "dueAny", fallback: "不限" },
  { value: "overdue", key: "dueOverdue", fallback: "已逾期" },
  { value: "today", key: "dueToday", fallback: "今天到期" },
  { value: "week", key: "dueWeek", fallback: "本周内" },
  { value: "none", key: "dueNone", fallback: "无日期" },
]

const groupOptions: { value: GroupBy; key: string; fallback: string }[] = [
  { value: "none", key: "groupNone", fallback: "不分组" },
  { value: "due", key: "groupDue", fallback: "按日期" },
  { value: "priority", key: "groupPriority", fallback: "按优先级" },
  { value: "category", key: "groupCategory", fallback: "按分类" },
  { value: "doc", key: "groupDoc", fallback: "按文档" },
]

const sortOptions: { value: SortBy; key: string; fallback: string }[] = [
  { value: "manual", key: "sortManual", fallback: "手动" },
  { value: "due", key: "sortDue", fallback: "截止日期" },
  { value: "priority", key: "sortPriority", fallback: "优先级" },
  { value: "created", key: "sortCreated", fallback: "创建时间" },
  { value: "title", key: "sortTitle", fallback: "标题" },
]

function statusLabel(status: TaskStatus): string {
  switch (status) {
    case "doing":
      return strings.statusDoing || "执行中"
    case "done":
      return strings.statusDone || "已完成"
    case "archived":
      return strings.statusArchived || "已归档"
    default:
      return strings.statusTodo || "待办"
  }
}

function priorityLabel(priority: Priority): string {
  return strings[`priority${priority}`] || `P${priority}`
}

/** 状态未做筛选即代表「全部」，此时四项都显示为选中 */
function isStatusOn(status: TaskStatus): boolean {
  return ui.statuses.length === 0 || ui.statuses.includes(status)
}
</script>

<template>
  <div v-if="ui.filterOpen" class="bt-filter">
    <div class="bt-filter__row">
      <span class="bt-filter__label">{{ strings.timeTitle || '时间' }}</span>
      <div class="bt-filter__chips">
        <button
          v-for="view in viewOptions"
          :key="view.value"
          class="bt-chip-filter"
          :class="{ 'bt-chip-filter--on': ui.view === view.value }"
          @click="ui.view = view.value"
        >
          {{ strings[view.key] || view.fallback }}
          <span class="bt-chip-filter__count">{{ viewCount(view.value) }}</span>
        </button>
      </div>
    </div>

    <div class="bt-filter__row">
      <span class="bt-filter__label">{{ strings.statusTitle || '状态' }}</span>
      <div class="bt-filter__chips">
        <button
          v-for="status in STATUSES"
          :key="status"
          class="bt-chip-filter"
          :class="[`bt-chip-filter--${status}`, { 'bt-chip-filter--on': isStatusOn(status) }]"
          @click="toggleStatusFilter(status)"
        >
          {{ statusLabel(status) }}
          <span class="bt-chip-filter__count">{{ statusCounts[status] }}</span>
        </button>
      </div>
    </div>

    <div class="bt-filter__row">
      <span class="bt-filter__label">{{ strings.priority || '优先级' }}</span>
      <div class="bt-filter__chips">
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
      </div>
    </div>

    <div class="bt-filter__row">
      <span class="bt-filter__label">{{ strings.filterDue || '截止' }}</span>
      <select v-model="ui.dueFilter" class="bt-select bt-filter__control">
        <option v-for="option in dueOptions" :key="option.value" :value="option.value">
          {{ strings[option.key] || option.fallback }}
        </option>
      </select>
    </div>

    <div class="bt-filter__row">
      <span class="bt-filter__label">{{ strings.filterCategory || '分类' }}</span>
      <input v-model="ui.category" class="bt-input bt-filter__control" placeholder="…" />
    </div>

    <div v-if="ui.mode !== 'board'" class="bt-filter__row">
      <span class="bt-filter__label">{{ strings.groupByLabel || '分组' }}</span>
      <select v-model="ui.groupBy" class="bt-select bt-filter__control">
        <option v-for="option in groupOptions" :key="option.value" :value="option.value">
          {{ strings[option.key] || option.fallback }}
        </option>
      </select>
    </div>

    <div v-if="ui.mode !== 'board'" class="bt-filter__row">
      <span class="bt-filter__label">{{ strings.sortByLabel || '排序' }}</span>
      <select v-model="ui.sortBy" class="bt-select bt-filter__control">
        <option v-for="option in sortOptions" :key="option.value" :value="option.value">
          {{ strings[option.key] || option.fallback }}
        </option>
      </select>
    </div>

    <div v-if="hasActiveFilters()" class="bt-filter__row">
      <span class="bt-filter__label" />
      <button class="bt-btn bt-btn--link" @click="resetFilters()">
        {{ strings.filterReset || '清空筛选' }}
      </button>
    </div>
  </div>
</template>
