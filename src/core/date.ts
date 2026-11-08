export const MS_DAY = 24 * 60 * 60 * 1000

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/

function pad(value: number): string {
  return String(value).padStart(2, "0")
}

export function toDateString(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function toDateTimeString(date: Date): string {
  return `${toDateString(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

export function today(now = new Date()): string {
  return toDateString(now)
}

export function nowDateTime(now = new Date()): string {
  return toDateTimeString(now)
}

export function nowStamp(now = new Date()): string {
  return nowDateTime(now).replace(/[-: ]/g, "")
}

export function todayStart(): string {
  return `${today()} 00:00:00`
}

export function todayEnd(): string {
  return `${today()} 23:59:59`
}

export function hasTime(value: string): boolean {
  return /[ T]\d{2}:\d{2}/.test(value)
}

export function parseDate(value: string): Date | undefined {
  const matched = DATE_RE.exec(value.trim())
  if (!matched) {
    return undefined
  }
  const parts = matched.slice(1).map((part) => Number(part ?? 0))
  const [year, month, day, hour, minute, second] = parts
  const date = new Date(year, month - 1, day, hour, minute, second)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute ||
    date.getSeconds() !== second
  ) {
    return undefined
  }
  return date
}

export function datePart(value: string): string {
  const date = parseDate(value)
  return date ? toDateString(date) : ""
}

export function toInputValue(value: string): string {
  const date = parseDate(value)
  return date ? `${toDateString(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` : ""
}

export function fromInputValue(value: string): string {
  if (!value) {
    return ""
  }
  const date = parseDate(value)
  return date ? toDateTimeString(date) : ""
}

function compose(date: Date, source: string): string {
  return hasTime(source) ? toDateTimeString(date) : toDateString(date)
}

export function addDays(value: string, amount: number): string {
  const source = parseDate(value) ?? new Date()
  const date = new Date(source)
  date.setDate(date.getDate() + amount)
  return compose(date, value)
}

export function addMonths(value: string, amount: number): string {
  const source = parseDate(value) ?? new Date()
  const date = new Date(source)
  const day = date.getDate()
  date.setDate(1)
  date.setMonth(date.getMonth() + amount)
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  date.setDate(Math.min(day, lastDay))
  return compose(date, value)
}

export function addYears(value: string, amount: number): string {
  const source = parseDate(value) ?? new Date()
  const date = new Date(source)
  const month = date.getMonth()
  const day = date.getDate()
  date.setDate(1)
  date.setFullYear(date.getFullYear() + amount)
  const lastDay = new Date(date.getFullYear(), month + 1, 0).getDate()
  date.setMonth(month)
  date.setDate(Math.min(day, lastDay))
  return compose(date, value)
}

function utcDay(value: string): number | undefined {
  const date = parseDate(value)
  return date ? Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) : undefined
}

/** 返回 b - a 的日历天数，不受夏令时影响。 */
export function diffDays(a: string, b: string): number {
  const dayA = utcDay(a)
  const dayB = utcDay(b)
  return dayA === undefined || dayB === undefined ? 0 : Math.round((dayB - dayA) / MS_DAY)
}

export function isOverdue(due: string, finished: boolean, now = new Date()): boolean {
  if (!due || finished) {
    return false
  }
  const target = parseDate(due)
  if (!target) {
    return false
  }
  return hasTime(due) ? target.getTime() < now.getTime() : diffDays(due, today(now)) > 0
}

export interface Repeat {
  step: number
  unit: "d" | "w" | "m" | "y"
}

export function parseRepeat(rule: string): Repeat | undefined {
  const matched = /^(\d+)([dwmy])$/.exec(rule.trim())
  if (!matched) {
    return undefined
  }
  const step = Number(matched[1])
  if (!Number.isSafeInteger(step) || step <= 0) {
    return undefined
  }
  return { step, unit: matched[2] as Repeat["unit"] }
}

function advance(value: string, step: number, unit: Repeat["unit"]): string {
  switch (unit) {
    case "d":
      return addDays(value, step)
    case "w":
      return addDays(value, step * 7)
    case "m":
      return addMonths(value, step)
    case "y":
      return addYears(value, step)
  }
}

/** 返回严格晚于锚点、且不早于参考日的第一个重复日期。 */
export function nextOccurrence(anchor: string, rule: string, reference = today()): string {
  const parsed = parseRepeat(rule)
  if (!parsed) {
    return anchor
  }
  const base = parseDate(anchor) ? anchor : reference
  let periods = 1
  let next = advance(base, parsed.step * periods, parsed.unit)
  if (diffDays(next, reference) <= 0) {
    return next
  }

  if (parsed.unit === "d" || parsed.unit === "w") {
    const interval = parsed.step * (parsed.unit === "w" ? 7 : 1)
    const overdueDays = diffDays(next, reference)
    const jumps = Math.floor(overdueDays / interval)
    if (jumps > 0) {
      periods += jumps
      next = advance(base, parsed.step * periods, parsed.unit)
    }
  }
  while (diffDays(next, reference) > 0) {
    periods++
    next = advance(base, parsed.step * periods, parsed.unit)
  }
  return next
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
  return found ? (i18n[found.key] ?? rule) : rule
}

export function relativeDueLabel(due: string, i18n: Record<string, string>, now = new Date()): string {
  if (!parseDate(due)) {
    return ""
  }
  const delta = diffDays(today(now), due)
  const date = parseDate(due) as Date
  const suffix = hasTime(due) ? ` ${pad(date.getHours())}:${pad(date.getMinutes())}` : ""
  if (delta === 0) return (i18n.today ?? "今天") + suffix
  if (delta === 1) return (i18n.tomorrow ?? "明天") + suffix
  if (delta === -1) return (i18n.yesterday ?? "昨天") + suffix
  if (delta < 0) return (i18n.overdueDays ?? "逾期 {n} 天").replace("{n}", String(-delta))
  if (delta <= 7) return (i18n.inDays ?? "{n} 天后").replace("{n}", String(delta))
  return toDateString(date).slice(5) + suffix
}
