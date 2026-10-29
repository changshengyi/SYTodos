/**
 * 生成集市必需的 icon.png(160x160) 与 preview.png(1024x768)。
 *
 * 不依赖任何图像处理库：自己写 PNG 编码器（zlib + CRC32），保证离线可用。
 * 需要替换品牌图时，直接覆盖仓库根目录的 icon.png / preview.png 即可，
 * 集合规则要求：icon ≤ 64KB、preview ≤ 512KB、PNG/JPEG/WebP/AVIF、文件内容与扩展名一致。
 */
import { writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { deflateSync } from "node:zlib"

/* ------------------------- PNG 编码 ------------------------- */

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[n] = c
  }
  return table
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  }
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const body = Buffer.concat([Buffer.from(type, "ascii"), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([len, body, crc])
}

function encodePNG(width, height, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0
    Buffer.from(rgba.buffer, y * stride, stride).copy(raw, y * (stride + 1) + 1)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ])
}

/* ------------------------- 画布 ------------------------- */

class Canvas {
  constructor(width, height, background = [255, 255, 255, 255]) {
    this.width = width
    this.height = height
    this.pixels = new Uint8ClampedArray(width * height * 4)
    for (let i = 0; i < width * height; i++) {
      this.pixels[i * 4] = background[0]
      this.pixels[i * 4 + 1] = background[1]
      this.pixels[i * 4 + 2] = background[2]
      this.pixels[i * 4 + 3] = background[3]
    }
  }

  blend(x, y, color, alpha = 1) {
    if (alpha <= 0) {
      return
    }
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
      return
    }
    const i = (y * this.width + x) * 4
    const a = Math.max(0, Math.min(1, alpha))
    const dstA = this.pixels[i + 3] / 255
    const outA = a + dstA * (1 - a)
    for (let c = 0; c < 3; c++) {
      const src = color[c]
      const dst = this.pixels[i + c]
      this.pixels[i + c] = outA === 0 ? 0 : (src * a + dst * dstA * (1 - a)) / outA
    }
    this.pixels[i + 3] = outA * 255
  }

  rect(x, y, w, h, color, alpha = 1) {
    for (let yy = Math.round(y); yy < Math.round(y + h); yy++) {
      for (let xx = Math.round(x); xx < Math.round(x + w); xx++) {
        this.blend(xx, yy, color, alpha)
      }
    }
  }

  roundRect(x, y, w, h, r, color, alpha = 1) {
    for (let yy = Math.round(y); yy < Math.round(y + h); yy++) {
      for (let xx = Math.round(x); xx < Math.round(x + w); xx++) {
        const dx = Math.min(xx - x, x + w - 1 - xx)
        const dy = Math.min(yy - y, y + h - 1 - yy)
        if (dx >= r || dy >= r) {
          this.blend(xx, yy, color, alpha)
          continue
        }
        const corner = (r - dx) ** 2 + (r - dy) ** 2
        if (corner <= r * r) {
          this.blend(xx, yy, color, alpha)
        }
      }
    }
  }

  circle(cx, cy, radius, color, alpha = 1) {
    for (let yy = Math.floor(cy - radius); yy <= Math.ceil(cy + radius); yy++) {
      for (let xx = Math.floor(cx - radius); xx <= Math.ceil(cx + radius); xx++) {
        const d = Math.hypot(xx + 0.5 - cx, yy + 0.5 - cy)
        const edge = Math.min(1, Math.max(0, radius + 0.5 - d))
        this.blend(xx, yy, color, alpha * edge)
      }
    }
  }

  /** 抗锯齿线段 */
  line(x0, y0, x1, y1, thickness, color, alpha = 1) {
    const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0)) + 1
    const r = thickness / 2
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      this.circle(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r, color, alpha)
    }
  }

  toPNG() {
    return encodePNG(this.width, this.height, this.pixels)
  }
}

/* ------------------------- 图标 ------------------------- */

function makeIcon() {
  const size = 160
  const canvas = new Canvas(size, size, [0, 0, 0, 0])

  // 渐变背景 + 圆角
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = Math.min(x, size - 1 - x)
      const dy = Math.min(y, size - 1 - y)
      const edge = Math.min(dx, dy)
      if (edge < 28) {
        const d = Math.hypot(28 - Math.min(dx, 28), 28 - Math.min(dy, 28))
        if (d > 28) {
          continue
        }
      }
      const t = (x + y) / (size * 2)
      canvas.rect(x, y, 1, 1, [68 + 30 * t, 132 + 40 * t, 244 - 10 * t, 255], 1)
    }
  }

  const white = [255, 255, 255, 255]
  canvas.line(44, 82, 68, 106, 14, white, 1)
  canvas.line(68, 106, 118, 56, 14, white, 1)

  return { buffer: canvas.toPNG(), file: "icon.png" }
}

/* ------------------------- 预览图 ------------------------- */

function makePreview() {
  const W = 1024
  const H = 768
  const canvas = new Canvas(W, H, [246, 247, 249, 255])

  const primary = [66, 133, 244, 255]
  const border = [225, 226, 230, 255]
  const surface = [255, 255, 255, 255]
  const text = [92, 97, 107, 255]

  // 侧边栏
  canvas.rect(0, 0, 200, H, surface)
  canvas.rect(199, 0, 1, H, border)
  canvas.rect(24, 32, 96, 12, primary, 0.85)

  const navLabels = [148, 172, 196, 220, 244]
  const navWidths = [72, 96, 60, 84, 66]
  navLabels.forEach((y, index) => {
    const alpha = index === 0 ? 1 : 0.5
    canvas.roundRect(20, y, navWidths[index], 12, 6, index === 0 ? primary : text, alpha)
  })

  // 顶栏
  canvas.rect(200, 0, W - 200, 68, surface)
  canvas.rect(200, 67, W - 200, 1, border)
  canvas.roundRect(228, 26, 300, 20, 10, [240, 241, 244, 255], 1)
  canvas.roundRect(660, 22, 84, 24, 6, border, 1)
  canvas.roundRect(756, 22, 84, 24, 6, border, 1)

  // 快速添加
  canvas.roundRect(228, 92, W - 268, 34, 8, surface, 1)
  canvas.roundRect(228, 92, W - 268, 34, 8, border, 0.9)
  canvas.rect(248, 105, 140, 8, text, 0.35)

  // 分组标题
  let y = 148
  const groups = [
    { label: primary, rows: 3 },
    { label: primary, rows: 2 },
    { label: primary, rows: 4 },
  ]
  const priorities = [
    [234, 67, 53, 255],
    [240, 147, 43, 255],
    [66, 133, 244, 255],
    [154, 160, 175, 255],
  ]

  for (const group of groups) {
    canvas.rect(220, y, 220, 10, group.label, 0.75)
    y += 26
    for (let r = 0; r < group.rows; r++) {
      const indent = r === group.rows - 1 && group.rows > 2 ? 24 : 0
      // 勾选圆点
      canvas.circle(240 + indent, y + 12, 9, surface, 1)
      canvas.circle(240 + indent, y + 12, 9, border, 1)
      // 优先级色条
      const color = priorities[(r + group.rows) % priorities.length]
      canvas.roundRect(264 + indent, y + 5, 26, 14, 4, color, 0.9)
      // 标题
      canvas.roundRect(300 + indent, y + 8, 240 - indent - (r % 2) * 40, 10, 5, text, 0.55)
      // 截止芯片
      canvas.roundRect(560, y + 5, 54, 14, 4, [235, 238, 244, 255], 1)
      canvas.rect(568, y + 10, 38, 5, text, 0.4)
      // 分类芯片
      canvas.roundRect(626, y + 5, 44, 14, 4, surface, 1)
      canvas.roundRect(626, y + 5, 44, 14, 4, border, 1)
      // 行分隔
      canvas.rect(220, y + 31, W - 260, 1, border, 0.6)
      y += 32
    }
    y += 8
  }

  // 右侧详情面板
  canvas.rect(W - 300, 68, 300, H - 68, surface)
  canvas.rect(W - 301, 68, 1, H - 68, border)
  canvas.roundRect(W - 272, 96, 200, 12, 6, text, 0.4)
  for (let i = 0; i < 4; i++) {
    const rowY = 150 + i * 56
    canvas.rect(W - 272, rowY, 48, 8, text, 0.3)
    canvas.roundRect(W - 272, rowY + 20, 180, 24, 6, [243, 244, 247, 255], 1)
    canvas.roundRect(W - 272, rowY + 20, 180, 24, 6, border, 0.8)
  }
  canvas.roundRect(W - 272, 380, 120, 96, 8, [243, 244, 247, 255], 1)
  canvas.roundRect(W - 272, 380, 120, 96, 8, border, 0.8)

  return { buffer: canvas.toPNG(), file: "preview.png" }
}

/* ------------------------- 输出 ------------------------- */

const root = resolve(process.cwd())
for (const asset of [makeIcon(), makePreview()]) {
  const target = resolve(root, asset.file)
  writeFileSync(target, asset.buffer)
  console.log(`${asset.file} -> ${(asset.buffer.length / 1024).toFixed(1)}KB`)
}
