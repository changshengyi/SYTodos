/**
 * 日期工具。全部以 `YYYY-MM-DD` 字符串作为唯一格式，避免时区问题。
 */

export const MS_DAY = 24 * 60 * 60 * 1000

/** 把 Date 转成 `YYYY-MM-DD`（本地时区） */
export function toDateString(d: Date): string {
  const y = d.getFullYear()
  const m = `${d.getMonth() + 1}`.padStart(2, "0")
  const day = `${d.getDate()}`.padStart(2, "0")
  return `${y}-${m}-${day}`
}

export function today(): string {
  return toDateString(new Date())
}

export function parseDate(s: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return undefined
  }
  const [y, m, d] = s.split("-").map(Number)
  const date = new Date(y, m - 1, d)
  return Number.isNaN(date.getTime()) ? undefined : date
}

/** `YYYY-MM-DD` 加上 n 天 */
export function addDays(s: string, n: number): string {
  const date = parseDate(s) ?? new Date()
  date.setDate(date.getDate() + n)
  return toDateString(date)
}

export function addMonths(s: string, n: number): string {
  const date = parseDate(s) ?? new Date()
  const day = date.getDate()
  date.setDate(1)
  date.setMonth(date.getMonth() + n)
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  date.setDate(Math.min(day, lastDay))
  return toDateString(date)
}

export function addYears(s: string, n: number): string {
  const date = parseDate(s) ?? new Date()
  date.setFullYear(date.getFullYear() + n)
  return toDateString(date)
}

/** 相差整天数：b - a */
export function diffDays(a: string, b: string): number {
  const da = parseDate(a)
  const db = parseDate(b)
  if (!da || !db) {
    return 0
  }
  return Math.round((db.getTime() - da.getTime()) / MS_DAY)
}

/** 是否逾期（有日期、未完成、早于今天） */
export function isOverdue(due: string, done: boolean): boolean {
  if (!due || done) {
    return false
  }
  return diffDays(due, today()) > 0
}

/** 重复规则：`${step}${unit}`，unit ∈ d|w|m|y */
export interface Repeat {
  step: number
  unit: "d" | "w" | "m" | "y"
}

export function parseRepeat(rule: string): Repeat | undefined {
  const m = /^(\d+)([dwmy])$/.exec(rule.trim())
  if (!m) {
    return undefined
  }
  return { step: Number(m[1]), unit: m[2] as Repeat["unit"] }
}

/** 按重复规则基于 anchor 推进到下一次（返回 >= 今天的第一个日期） */
export function nextOccurrence(anchor: string, rule: string): string {
  const parsed = parseRepeat(rule)
  if (!parsed) {
    return anchor
  }
  const base = anchor || today()
  const todayStr = today()
  let next = base
  let guard = 0
  // 先跳一步，再持续推进到不早于今天
  next = advance(next, parsed.step, parsed.unit)
  while (diffDays(next, todayStr) > 0 && guard < 400) {
    next = advance(next, parsed.step, parsed.unit)
    guard++
  }
  return next
}

function advance(s: string, step: number, unit: Repeat["unit"]): string {
  switch (unit) {
    case "d":
      return addDays(s, step)
    case "w":
      return addDays(s, step * 7)
    case "m":
      return addMonths(s, step)
    case "y":
      return addYears(s, step)
  }
}

export const REPEAT_PRESETS: { value: string; key: string }[] = [
  { value: "", key: "repeatNone" },
  { value: "1d", key: "repeatDaily" },
  { value: "1w", key: "repeatWeekly" },
  { value: "2w", key: "repeatBiweekly" },
  { value: "1m", key: "repeatMonthly" },
  { value: "3m", key: "repeatQuarterly" },
  { value: "1y", key: "repeatYearly" },
]

export function repeatLabel(rule: string, i18n: Record<string, string>): string {
  const found = REPEAT_PRESETS.find((item) => item.value === rule)
  if (found) {
    return i18n[found.key] ?? rule
  }
  const parsed = parseRepeat(rule)
  if (!parsed) {
    return rule
  }
  return `${parsed.step}${parsed.unit}`
}

/** 人类可读的相对日期描述 */
export function relativeDueLabel(due: string, i18n: Record<string, string>): string {
  if (!due) {
    return ""
  }
  const delta = diffDays(today(), due)
  if (delta === 0) {
    return i18n.today ?? "今天"
  }
  if (delta === 1) {
    return i18n.tomorrow ?? "明天"
  }
  if (delta === -1) {
    return i18n.yesterday ?? "昨天"
  }
  if (delta < 0) {
    return (i18n.overdueDays ?? "逾期 {n} 天").replace("{n}", `${-delta}`)
  }
  if (delta <= 7) {
    return (i18n.inDays ?? "{n} 天后").replace("{n}", `${delta}`)
  }
  return due.slice(5)
}
