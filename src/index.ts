import { createApp } from "vue"
import { openTab, Plugin } from "siyuan"
import type { Custom } from "siyuan"

import App from "./App.vue"
import { loadAll, scheduleSync, syncIds, taskState } from "./store/tasks"
import type { StorageHost } from "./store/settings"
import { loadSettings, queueSaveSettings, settings, STORAGE_HOST } from "./store/settings"
import { setStrings, strings } from "./store/i18n"
import { setHost } from "./store/host"
import { ui } from "./store/ui"
import "./styles/index.scss"

const TAB_TYPE = "blocktodo_tab"
const TOP_BAR_ICON = "iconCheck"

interface Operation {
  id?: string
  action?: string
}

/** 从 ws-main 的 transactions 里提取受影响的块 ID */
function collectIds(data: unknown): string[] {
  const ids = new Set<string>()
  const visit = (node: unknown) => {
    if (!node || typeof node !== "object") {
      return
    }
    if (Array.isArray(node)) {
      node.forEach(visit)
      return
    }
    const record = node as Record<string, unknown>
    if (typeof record.id === "string" && /^\d{14}-[a-z0-9]{7}$/.test(record.id)) {
      ids.add(record.id)
    }
    if (record.doOperations) {
      visit(record.doOperations)
    }
    if (record.undoOperations) {
      visit(record.undoOperations)
    }
  }
  visit((data as { doOperations?: Operation[] }[]) ?? [])
  return Array.from(ids)
}

export default class SyTodoPlugin extends Plugin {
  private roots = new Map<HTMLElement, ReturnType<typeof createApp>>()

  override async onload(): Promise<void> {
    setStrings(this.i18n)
    setHost({
      app: this.app,
      openDoc: async (rootId, blockId) => {
        await openTab({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          app: this.app as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          doc: { id: rootId, zoomIn: false } as any,
        })
        if (blockId) {
          window.setTimeout(() => {
            const node = document.querySelector(`[data-node-id="${blockId}"]`)
            node?.scrollIntoView({ block: "center" })
          }, 800)
        }
      },
    })

    await loadSettings(this)
    ui.view = settings.defaultView
    ui.mode = settings.defaultMode
    ui.groupBy = settings.defaultGroupBy
    ui.sortBy = settings.defaultSortBy
    queueSaveSettings(this)

    const plugin = this
    this.addTab({
      type: TAB_TYPE,
      init(this: Custom) {
        plugin.mountView(this.element as HTMLElement)
      },
      destroy(this: Custom) {
        plugin.unmountView(this.element as HTMLElement)
      },
    })

    this.addTopBar({
      icon: TOP_BAR_ICON,
      title: strings.pluginName || "SY Todo",
      callback: () => {
        void this.openTodoTab()
      },
    })

    this.addCommand({
      langKey: "openTodo",
      callback: () => {
        void this.openTodoTab()
      },
    })

    this.eventBus.on("ws-main", this.handleTransaction)
    document.addEventListener("visibilitychange", this.handleVisibility)

    // 首次渲染时后台静默加载，避免阻塞插件挂载
    await loadAll()
  }

  override onLayoutReady(): void {
    // 布局就绪后再确认一次数据，避免加载到旧快照
    if (taskState.loaded) {
      scheduleSync(Array.from(taskState.tasks.keys()).slice(0, 200))
    }
  }

  override onunload(): void {
    document.removeEventListener("visibilitychange", this.handleVisibility)
    this.eventBus.off("ws-main", this.handleTransaction)
    this.roots.forEach((app) => app.unmount())
    this.roots.clear()
  }

  private openTodoTab(): Promise<unknown> {
    ui.showSettings = false
    return openTab({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      app: this.app as any,
      custom: {
        id: this.name + TAB_TYPE,
        icon: TOP_BAR_ICON,
        title: this.i18n.pluginName ?? "SY Todo",
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
  }

  private mountView(element: HTMLElement): void {
    this.unmountView(element)
    element.classList.add("bt-host", "fn__flex-column")
    const app = createApp(App)
    app.provide(STORAGE_HOST, this as unknown as StorageHost)
    app.mount(element)
    this.roots.set(element, app)
  }

  private unmountView(element: HTMLElement): void {
    const app = this.roots.get(element)
    if (app) {
      app.unmount()
      this.roots.delete(element)
    }
  }

  /**
   * 只在真正发生变更时做增量同步。
   * 相比「定时器 + 全量快照比对」，这里既不轮询也不重复反序列化全量数据。
   */
  private handleTransaction = (event: Event): void => {
    const detail = (event as CustomEvent).detail as { cmd?: string; data?: unknown } | undefined
    if (!detail || detail.cmd !== "transactions") {
      return
    }
    const ids = collectIds(detail.data)
    if (ids.length === 0) {
      return
    }
    if (ids.length > 300) {
      void loadAll()
      return
    }
    void syncIds(ids)
  }

  private handleVisibility = (): void => {
    if (document.hidden || taskState.tasks.size === 0) {
      return
    }
    // 回到前台时做一次轻量核对
    void syncIds(Array.from(taskState.tasks.keys()).slice(0, 200))
  }
}
