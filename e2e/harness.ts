import { createApp } from "vue"

import App from "../src/App.vue"
import type { TaskRepository } from "../src/data/repository"
import type { StorageHost } from "../src/data/storage"
import zh from "../src/i18n/zh-CN.json"
import { flushAllDrafts } from "../src/store/drafts"
import { setHost } from "../src/store/host"
import { setStrings } from "../src/store/i18n"
import { LocalTaskRepository } from "../src/store/local"
import { settings, settingsState } from "../src/store/settings"
import { configureTaskService, flushTasks, loadAll } from "../src/store/tasks"
import { ui } from "../src/store/ui"
import "../src/styles/index.scss"

class BrowserStorage implements StorageHost {
  async loadData(key: string): Promise<unknown> {
    const value = localStorage.getItem(`sytodos-e2e:${key}`)
    return value === null ? null : JSON.parse(value)
  }

  async saveData(key: string, value: unknown): Promise<{ code: number; msg: string }> {
    localStorage.setItem(`sytodos-e2e:${key}`, JSON.stringify(value))
    return { code: 0, msg: "" }
  }
}

const emptyRemote: TaskRepository = {
  space: "siyuan",
  load: async () => [],
  create: async () => { throw new Error("E2E 仅使用独立空间") },
  update: async () => { throw new Error("E2E 仅使用独立空间") },
  move: async () => { throw new Error("E2E 仅使用独立空间") },
  delete: async () => { throw new Error("E2E 仅使用独立空间") },
}

setStrings(zh)
setHost({ app: undefined, openDoc: async () => undefined })
Object.assign(settings, { defaultSpace: "local", defaultView: "all", defaultMode: "list" })
settingsState.loaded = true
Object.assign(ui, { space: "local", view: "all", mode: "list" })
configureTaskService({
  repositories: { siyuan: emptyRemote, local: new LocalTaskRepository(new BrowserStorage()) },
  resolveDefaultDoc: async () => "e2e-doc",
  shouldAdvanceRepeat: () => settings.repeatAdvance,
  notify: (message) => console.error(message),
})
await loadAll()
createApp(App).mount("#app")

declare global {
  interface Window {
    __sytodos: { flush(): Promise<void>; reload(): Promise<boolean> }
  }
}
window.__sytodos = {
  flush: async () => {
    await flushAllDrafts()
    await flushTasks()
  },
  reload: loadAll,
}
