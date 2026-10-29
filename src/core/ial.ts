/**
 * 解析思源块的 IAL（行内属性列表），形如：
 *   `{: id="20240101120000-abcde" custom-bt-p="P1" updated="20240101120000"}`
 *
 * 直接在 SQL 结果里带上 `ial`，可以一次请求拿到「块 + 全部属性」，避免
 * 对每一条任务调用 `/api/attr/getBlockAttrs` 造成 N+1 请求。
 */
export function parseIAL(ial: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  if (!ial) {
    return attrs
  }
  const re = /([A-Za-z0-9_:][A-Za-z0-9_\-:.]*)\s*=\s*"([^"]*)"/g
  let match: RegExpExecArray | null
  while ((match = re.exec(ial))) {
    attrs[match[1]] = match[2]
  }
  return attrs
}

/** 读取带命名空间的自定义属性（IAL 的 key 里会把 `-` 之外的中划线保留原样） */
export function pickAttr(attrs: Record<string, string>, name: string): string {
  return attrs[name] ?? attrs[name.replace(/-/g, "_")] ?? ""
}
