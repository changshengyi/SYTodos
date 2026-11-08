import { describe, expect, it } from "vitest"

import { addMonths, addYears, diffDays, nextOccurrence, parseDate, parseRepeat } from "@/core/date"

describe("日期与重复规则", () => {
  it("拒绝不存在的日历日期和越界时间", () => {
    expect(parseDate("2024-02-29")).toBeDefined()
    expect(parseDate("2024-02-31")).toBeUndefined()
    expect(parseDate("2026-13-01")).toBeUndefined()
    expect(parseDate("2026-01-01 25:00:00")).toBeUndefined()
  })

  it("月底与闰年按目标月最后一天收敛", () => {
    expect(addMonths("2024-01-31", 1)).toBe("2024-02-29")
    expect(addMonths("2025-01-31", 1)).toBe("2025-02-28")
    expect(addYears("2024-02-29", 1)).toBe("2025-02-28")
  })

  it("长期每日重复不会被四百次上限卡在过去", () => {
    const next = nextOccurrence("2020-01-01", "1d", "2026-11-08")
    expect(diffDays(next, "2026-11-08")).toBeLessThanOrEqual(0)
    expect(diffDays(next, "2026-11-08")).toBeGreaterThanOrEqual(-1)
    expect(diffDays("2020-01-01", next)).toBeGreaterThan(2000)
  })

  it("周、月重复保持锚点语义并拒绝零步长", () => {
    expect(nextOccurrence("2026-10-01", "1w", "2026-11-08")).toBe("2026-11-12")
    expect(nextOccurrence("2026-01-31", "1m", "2026-11-08")).toBe("2026-11-30")
    expect(parseRepeat("0d")).toBeUndefined()
    expect(parseRepeat("1x")).toBeUndefined()
  })
})
