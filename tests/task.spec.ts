import { describe, expect, it } from "vitest"

import { parseIAL } from "@/core/ial"
import {
  ATTR,
  buildTaskMarkdown,
  diffTaskAttrs,
  rewriteTaskKramdown,
  rowToTask,
  taskToAttrs,
} from "@/core/task"

import { makeTask } from "./helpers"

describe("思源任务映射", () => {
  it("仅从真实父块类型推导父任务和列表容器", () => {
    const task = rowToTask(
      {
        id: "20260101000000-child01",
        parent_id: "20260101000000-list001",
        root_id: "20260101000000-doc0001",
        parent_type: "l",
        container_parent_id: "20260101000000-parent1",
        container_parent_type: "i",
        container_parent_subtype: "t",
        markdown: "* [ ] 子任务",
      },
      {},
    )
    expect(task.parentId).toBe("20260101000000-parent1")
    expect(task.containerId).toBe("20260101000000-list001")
    expect(task.rootId).toBe("20260101000000-doc0001")
  })

  it("完整属性包含默认优先级、排序、日期、分类和多行备注", () => {
    const task = makeTask({
      space: "siyuan",
      priority: 3,
      start: "2026-01-01 08:00:00",
      due: "2026-01-02 09:00:00",
      category: "工作",
      note: "第一行\n第二行",
      repeat: "1w",
    })
    const attrs = taskToAttrs(task)
    expect(attrs[ATTR.priority]).toBe("P3")
    expect(attrs[ATTR.start]).toBe(task.start)
    expect(attrs[ATTR.due]).toBe(task.due)
    expect(attrs[ATTR.note]).toBe("第一行\n第二行")
    expect(diffTaskAttrs({ ...task, priority: 2 }, task)[ATTR.priority]).toBe("P3")
  })

  it("新建完成任务直接生成正确勾选标记", () => {
    expect(buildTaskMarkdown("完成项", true)).toBe("* [X] 完成项")
    expect(buildTaskMarkdown("待办项", false)).toBe("* [ ] 待办项")
  })

  it("更新标题和勾选保留子树、附加段落与块 ID", () => {
    const source = `* [ ] 旧标题\n  附加段落\n  {: id="20260101000000-para001"}\n  * [ ] 子任务\n    {: id="20260101000000-child01"}\n{: id="20260101000000-parent1"}`
    const next = rewriteTaskKramdown(source, "新标题", true, true)
    expect(next).toContain("* [X] 新标题")
    expect(next).toContain("附加段落")
    expect(next).toContain('{: id="20260101000000-para001"}')
    expect(next).toContain("* [ ] 子任务")
    expect(next).toContain('{: id="20260101000000-child01"}')
    expect(next.endsWith('{: id="20260101000000-parent1"}')).toBe(true)
  })

  it("IAL 转义可以往返多行文本", () => {
    expect(parseIAL('{: custom-bt-note="line1\\nline2\\\"quoted\\\""}')).toEqual({
      "custom-bt-note": 'line1\nline2"quoted"',
    })
  })
})
