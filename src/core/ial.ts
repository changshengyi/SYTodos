/** 解析双引号 IAL，并还原本属性值中的常见转义。 */
export function parseIAL(ial: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  const pattern = /([A-Za-z0-9_:][A-Za-z0-9_\-:.]*)\s*=\s*"((?:\\.|[^"\\])*)"/g
  let matched: RegExpExecArray | null
  while ((matched = pattern.exec(ial))) {
    attrs[matched[1]] = matched[2].replace(/\\(["\\nrt])/g, (_, escaped: string) => {
      if (escaped === "n") return "\n"
      if (escaped === "r") return "\r"
      if (escaped === "t") return "\t"
      return escaped
    })
  }
  return attrs
}

export function pickAttr(attrs: Record<string, string>, name: string): string {
  return attrs[name] ?? attrs[name.replace(/-/g, "_")] ?? ""
}
