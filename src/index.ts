import { createApp } from "vue"
import { openTab, Plugin } from "siyuan"
import type { Custom } from "siyuan"

import App from "./App.vue"
import * as kernel from "./api/kernel"
import { today } from "./core/date"
import { LocalTaskRepository } from "./store/local"
import { SiyuanTaskRepository } from "./data/siyuanRepository"
import { flushAllDrafts } from "./store/drafts"
import { setHost } from "./store/host"
import { setStrings, strings } from "./store/i18n"
import {
  flushSettings,
  loadSettings,
  setSettingsNotifier,
  settings,
} from "./store/settings"
import type { StorageHost } from "./data/storage"
import { STORAGE_HOST } from "./store/settings"
import {
  cancelScheduledSync,
  configureTaskService,
  flushTasks,
  loadAll,
  scheduleSync,
} from "./store/tasks"
import { ui } from "./store/ui"
import "./styles/index.scss"

const TAB_TYPE = "sytodos_tab"
const TOP_BAR_ICON = "iconCheck"

export default class SyTodoPlugin extends Plugin {
  private roots = new Map<HTMLElement, ReturnType<typeof createApp>>()
  private dailyNote: { key: string; id: string } | undefined

  override async onload(): Promise<void> {
    setStrings(this.i18n)
    setHost({
      app: this.app,
      openDoc: (rootId, blockId) => this.openDocument(rootId, blockId),
    })
    const notify = async (message: string): Promise<void> => {
      await kernel.pushErrMsg(message)
    }
    setSettingsNotifier(notify)
    await loadSettings(this)
    Object.assign(ui, {
      space: settings.defaultSpace,
      view: settings.defaultView,
      mode: settings.defaultMode,
      groupBy: settings.defaultGroupBy,
      sortBy: settings.defaultSortBy,
    })
    configureTaskService({
      repositories: {
        siyuan: new SiyuanTaskRepository(kernel),
        local: new LocalTaskRepository(this),
      },
      resolveDefaultDoc: () => this.resolveDefaultDoc(),
      shouldAdvanceRepeat: () => settings.repeatAdvance,
      notify,
    })

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
      title: strings.pluginName || "SYTodos",
      callback: () => void this.openTodoTab(),
    })
    this.addCommand({ langKey: "openTodo", callback: () => void this.openTodoTab() })
    this.eventBus.on("ws-main", this.handleTransaction)
    document.addEventListener("visibilitychange", this.handleVisibility)
    void loadAll()
  }

  override onLayoutReady(): void {
    void loadAll()
  }

  override async onunload(): Promise<void> {
    document.removeEventListener("visibilitychange", this.handleVisibility)
    this.eventBus.off("ws-main", this.handleTransaction)
    cancelScheduledSync()
    await flushAllDrafts()
    await flushSettings()
    this.roots.forEach((app) => app.unmount())
    this.roots.clear()
    await flushTasks()
    setSettingsNotifier(undefined)
  }

  private async resolveDefaultDoc(): Promise<string> {
    if (settings.defaultDocId) {
      await kernel.docMeta(settings.defaultDocId)
      return settings.defaultDocId
    }
    const notebooks = (await kernel.listNotebooks()).filter((notebook) => !notebook.closed)
    const box = settings.defaultBox || notebooks[0]?.id || ""
    if (!box) throw new Error("没有可用的已打开笔记本")
    const key = `${box}|${today()}`
    if (this.dailyNote?.key === key) return this.dailyNote.id
    const id = await kernel.createDailyNote(box)
    this.dailyNote = { key, id }
    return id
  }

  private openTodoTab(): Promise<unknown> {
    ui.showSettings = false
    return openTab({
      app: this.app,
      custom: { id: this.name + TAB_TYPE, icon: TOP_BAR_ICON, title: this.i18n.pluginName ?? "SYTodos" },
    } as Parameters<typeof openTab>[0])
  }

  private async openDocument(rootId: string, blockId?: string): Promise<void> {
    await openTab({ app: this.app, doc: { id: rootId, zoomIn: false } } as Parameters<typeof openTab>[0])
    if (!blockId) return
    const deadline = Date.now() + 3000
    while (Date.now() < deadline) {
      const node = document.querySelector(`[data-node-id="${blockId}"]`)
      if (node) {
        node.scrollIntoView({ block: "center" })
        return
      }
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    await kernel.pushErrMsg("文档已打开，但未能定位目标任务块")
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
    this.roots.get(element)?.unmount()
    this.roots.delete(element)
  }

  private handleTransaction = (event: Event): void => {
    const detail = (event as CustomEvent).detail as { cmd?: string } | undefined
    if (detail?.cmd === "transactions") scheduleSync()
  }

  private handleVisibility = (): void => {
    if (document.hidden) {
      void flushAllDrafts()
      void flushSettings()
    } else {
      void loadAll()
    }
  }
}
