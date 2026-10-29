/** 宿主（思源）能力的注入点，供界面层调用而不反向依赖插件入口类 */
export interface Host {
  app: unknown
  openDoc: (rootId: string, blockId?: string) => Promise<void>
}

let host: Host | undefined

export function setHost(next: Host): void {
  host = next
}

export function getHost(): Host | undefined {
  return host
}

export async function openInNote(rootId: string, blockId?: string): Promise<void> {
  await host?.openDoc(rootId, blockId)
}
