import { reactive } from "vue"

/** 插件翻译字符串，由入口从 `plugin.i18n` 注入。 */
export const strings = reactive<Record<string, string>>({})

/** 兼容思源 i18n 的 JSONValue 类型：非字符串值统一转成字符串 */
export function setStrings(next: Record<string, unknown>): void {
  Object.keys(strings).forEach((key) => delete strings[key])
  for (const [key, value] of Object.entries(next ?? {})) {
    strings[key] = typeof value === "string" ? value : String(value ?? "")
  }
}

export function t(key: string, fallback = "", vars?: Record<string, string | number>): string {
  const template = strings[key] || fallback || key
  if (!vars) {
    return template
  }
  return template.replace(/\{(\w+)\}/g, (_full, name: string) =>
    name in vars ? String(vars[name]) : `{${name}}`,
  )
}
