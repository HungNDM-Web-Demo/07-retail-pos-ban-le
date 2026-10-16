// Sinh ảnh "kiểu bao bì" cho hàng hóa trong src/mock/seed/demo-data.json
// vào public/seed/products/{image}.webp (tên file lấy từ `products[].image`).
// Mỗi kiểu bao bì là một minh họa SVG hình học trung tính: thân trắng/xám nhạt, điểm nhấn xám,
// nền TRONG SUỐT, không chữ, không nhãn hiệu, đổ bóng nhẹ. FE tô nền ô ảnh bằng `products[].color`
// nên cùng một ảnh dùng được cho nhiều hàng hóa. Rau, trái cây, thịt, trứng, bánh mì vẽ màu tự nhiên.
// Kích thước 256×256, WebP có kênh alpha ≤ 15 KB.
// Xác định: không ngẫu nhiên tự do (bộ sinh số có hạt giống theo tên kiểu), chạy lại cho cùng byte.
// Không ghi gì vào file JSON. Khung lấy từ scripts/generate-menu-images.mjs của dự án 04-fnb-menu-qr.
//
// Chạy:      pnpm seed:images
// Tùy chọn:  --only <chuỗi>       chỉ vẽ kiểu có tên chứa chuỗi
//            --preview <thư mục>  xuất thêm PNG để xem nhanh
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import sharp from 'sharp'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DATA_FILE = join(ROOT, 'src', 'mock', 'seed', 'demo-data.json')
const OUT_DIR = join(ROOT, 'public', 'seed', 'products')
const S = 256
const MAX_BYTES = 15 * 1000

const args = process.argv.slice(2)
const argVal = (name) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}
const ONLY = argVal('--only')
const PREVIEW = argVal('--preview')

// ============================================================ Tiện ích
const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
const r2 = (n) => Math.round(n * 100) / 100
function attrs(o) {
  let out = ''
  for (const [k, v] of Object.entries(o)) {
    if (v === undefined || v === null || v === false) continue
    out += ` ${k}="${typeof v === 'number' ? r2(v) : esc(v)}"`
  }
  return out
}
const el = (tag, o = {}, body = '') =>
  body ? `<${tag}${attrs(o)}>${body}</${tag}>` : `<${tag}${attrs(o)}/>`
const rect = (x, y, w, h, o = {}) => el('rect', { x, y, width: w, height: h, ...o })
const circle = (cx, cy, r, o = {}) => el('circle', { cx, cy, r, ...o })
const ellipse = (cx, cy, rx, ry, o = {}) => el('ellipse', { cx, cy, rx, ry, ...o })
const path = (d, o = {}) => el('path', { d, ...o })
const g = (o, body) => el('g', o, body)
const line = (x1, y1, x2, y2, o = {}) => el('line', { x1, y1, x2, y2, ...o })
const range = (n) => Array.from({ length: n }, (_, i) => i)
const DEG = Math.PI / 180
const stroke = (color, width, extra = {}) => ({
  fill: 'none',
  stroke: color,
  'stroke-width': width,
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
  ...extra,
})

const hexToRgb = (h) => [0, 2, 4].map((i) => parseInt(h.replace('#', '').slice(i, i + 2), 16))
const rgbToHex = (c) =>
  '#' +
  c
    .map((v) =>
      Math.max(0, Math.min(255, Math.round(v)))
        .toString(16)
        .padStart(2, '0')
    )
    .join('')
    .toUpperCase()
const mix = (a, b, t) => {
  const A = hexToRgb(a)
  const B = hexToRgb(b)
  return rgbToHex(A.map((v, i) => v + (B[i] - v) * t))
}
const tint = (c, t) => mix(c, '#FFFFFF', t)
const shade = (c, t) => mix(c, '#000000', t)

function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function hashStr(s) {
  let h = 2166136261
  for (const ch of s) h = Math.imul(h ^ ch.codePointAt(0), 16777619)
  return h >>> 0
}

// ============================================================ Bảng màu trung tính và nét vẽ
const N = {
  w: '#FFFFFF',
  50: '#F8FAFC',
  100: '#F1F5F9',
  200: '#E2E8F0',
  300: '#CBD5E1',
  400: '#94A3B8',
  500: '#64748B',
  600: '#475569',
  700: '#334155',
  800: '#1E293B',
}
// Viền mảnh màu xám đậm để hình nổi trên nền sáng lẫn nền đậm
const ink = (fill, extra = {}) => ({
  fill,
  stroke: N[800],
  'stroke-opacity': 0.34,
  'stroke-width': 2,
  'stroke-linejoin': 'round',
  ...extra,
})
const shine = (x, y, w, h, op = 0.6) =>
  rect(x, y, w, h, { rx: Math.min(w, h) / 2, fill: N.w, 'fill-opacity': op })

// ============================================================ Định nghĩa dùng chung trong một ảnh
let defs = []
let uid = 0
const newId = (p) => `${p}${++uid}`
function linGrad(stops, dir = 'h') {
  const id = newId('lg')
  const [x2, y2] = dir === 'v' ? [0, 1] : [1, 0]
  defs.push(
    el(
      'linearGradient',
      { id, x1: 0, y1: 0, x2, y2 },
      stops.map(([o, c]) => el('stop', { offset: o, 'stop-color': c })).join('')
    )
  )
  return `url(#${id})`
}
// Mặt trụ: mép trái hơi tối, dải sáng gần trái, phải tối dần
const cylG = (c, k = 0.16) =>
  linGrad([
    [0, shade(c, k * 0.5)],
    [0.16, tint(c, 0.5)],
    [0.42, c],
    [0.82, shade(c, k * 0.75)],
    [1, shade(c, k)],
  ])
const vG = (top, bottom) =>
  linGrad(
    [
      [0, top],
      [1, bottom],
    ],
    'v'
  )
function clipOf(inner) {
  const id = newId('cp')
  defs.push(el('clipPath', { id }, inner))
  return `url(#${id})`
}
function blurFilter(std) {
  const id = newId('bl')
  defs.push(
    el(
      'filter',
      { id, x: '-50%', y: '-50%', width: '200%', height: '200%' },
      el('feGaussianBlur', { stdDeviation: std })
    )
  )
  return `url(#${id})`
}
// Bóng đổ nhẹ cho cả vật thể (dịch xuống, nhòe)
function dropShadow() {
  const id = newId('ds')
  defs.push(
    el(
      'filter',
      { id, x: '-20%', y: '-20%', width: '140%', height: '150%' },
      el('feGaussianBlur', { in: 'SourceAlpha', stdDeviation: 3 }) +
        el('feOffset', { dy: 3, result: 'b' }) +
        el('feFlood', { 'flood-color': '#0F172A', 'flood-opacity': 0.26 }) +
        el('feComposite', { in2: 'b', operator: 'in' }) +
        el('feMerge', {}, el('feMergeNode') + el('feMergeNode', { in: 'SourceGraphic' }))
    )
  )
  return `url(#${id})`
}
// Bóng tiếp đất dưới đáy vật thể
const ground = (cx, cy, rx, ry = 7, op = 0.34) =>
  ellipse(cx, cy, rx, ry, { fill: '#0F172A', 'fill-opacity': op, filter: blurFilter(4) })

// ============================================================ Chi tiết dùng lại
// Gờ dọc trên nắp vặn
const ribsV = (x, y, w, h, step = 4, color = N[800], op = 0.28) =>
  range(Math.floor(w / step) - 1)
    .map((i) =>
      line(
        x + step * (i + 1),
        y + 2,
        x + step * (i + 1),
        y + h - 2,
        stroke(color, 1.4, { 'stroke-opacity': op })
      )
    )
    .join('')
// Gờ ngang (mép hàn bao bì)
const ribsH = (x, y, w, h, step = 4, color = N[800], op = 0.2) =>
  range(Math.floor(h / step) - 1)
    .map((i) =>
      line(
        x + 2,
        y + step * (i + 1),
        x + w - 2,
        y + step * (i + 1),
        stroke(color, 1.2, { 'stroke-opacity': op })
      )
    )
    .join('')
// Dải mép hàn ngang có răng cưa ở cạnh ngoài (top = true: răng ở trên)
function sealH(x, y, w, h, top) {
  const n = Math.round(w / 8)
  const step = w / n
  let d = top ? `M${x} ${y + h}` : `M${x} ${y}`
  if (top) {
    d += `L${x} ${y + 3}`
    for (let i = 0; i < n; i++)
      d += `L${r2(x + step * (i + 0.5))} ${y}L${r2(x + step * (i + 1))} ${y + 3}`
    d += `L${x + w} ${y + h}Z`
  } else {
    d += `L${x} ${y + h - 3}`
    for (let i = 0; i < n; i++)
      d += `L${r2(x + step * (i + 0.5))} ${y + h}L${r2(x + step * (i + 1))} ${y + h - 3}`
    d += `L${x + w} ${y}Z`
  }
  return path(d, ink(vG(N[100], N[200]))) + ribsH(x, y + 1, w, h - 2, 4)
}
// Dải mép hàn dọc có răng cưa (left = true: răng bên trái)
function sealV(x, y, w, h, left) {
  const n = Math.round(h / 8)
  const step = h / n
  let d
  if (left) {
    d = `M${x + w} ${y}L${x + 3} ${y}`
    for (let i = 0; i < n; i++)
      d += `L${x} ${r2(y + step * (i + 0.5))}L${x + 3} ${r2(y + step * (i + 1))}`
    d += `L${x + w} ${y + h}Z`
  } else {
    d = `M${x} ${y}L${x + w - 3} ${y}`
    for (let i = 0; i < n; i++)
      d += `L${x + w} ${r2(y + step * (i + 0.5))}L${x + w - 3} ${r2(y + step * (i + 1))}`
    d += `L${x} ${y + h}Z`
  }
  return path(d, ink(N[100])) + ribsV(x, y, w, h, 4, N[800], 0.2)
}
// Ly/hộp hình nón cụt (miệng rộng, đáy hẹp), đáy cong theo phối cảnh
const cupPath = (cx, top, h, wt, wb) =>
  `M${cx - wt / 2} ${top}L${cx + wt / 2} ${top}L${cx + wb / 2} ${top + h}A${wb / 2} ${r2(wb * 0.12)} 0 0 1 ${cx - wb / 2} ${top + h}Z`
// Lá rau (gốc ở 0,0, mọc lên trên)
const leafPath = (len, w) =>
  `M0 0C${-w} ${-len * 0.22} ${-w * 1.05} ${-len * 0.72} 0 ${-len}C${w * 1.05} ${-len * 0.72} ${w} ${-len * 0.22} 0 0Z`

// ============================================================ 28 kiểu bao bì
// Mỗi hàm trả về [bóng tiếp đất, vật thể]. Tọa độ trong khung 256×256, đáy vật thể quanh y = 222.
const SHAPES = {
  // Lon nước ngọt/bia: trụ cao, cổ thắt, nắp có khoen
  lon() {
    const body = 'M88 46L82 62L82 206L90 218Q128 226 166 218L174 206L174 62L168 46Z'
    let o = path(body, ink(cylG('#C9D1D9', 0.22)))
    o += rect(82, 98, 92, 80, { fill: cylG(N.w, 0.12) })
    o += rect(82, 168, 92, 7, { fill: cylG(N[400]) })
    o += rect(82, 98, 92, 4, { fill: cylG(N[300]) })
    o += path('M82 62Q128 70 174 62', stroke(N[500], 1.5, { 'stroke-opacity': 0.6 }))
    o += path('M82 206Q128 214 174 206', stroke(N[500], 1.5, { 'stroke-opacity': 0.6 }))
    o += ellipse(128, 46, 40, 8, ink(vG(N[100], N[300])))
    o += ellipse(128, 47, 33, 5.6, { fill: N[300] })
    o += rect(117, 40.5, 24, 9, { rx: 4.5, fill: N[400], stroke: N[500], 'stroke-width': 1 })
    o += ellipse(123, 45, 3, 2, { fill: N[200] })
    o += circle(133.5, 45, 1.8, { fill: N[600] })
    o += shine(92, 66, 7, 136, 0.55)
    return [ground(128, 222, 50), o]
  },

  // Lon sữa bột: trụ lớn, nắp nhựa vòm, đai kim loại ở đáy
  'lon-sua-bot'() {
    let o = path('M66 80L66 208A62 11 0 0 0 190 208L190 80Z', ink(cylG('#F3F5F8', 0.14)))
    o += path('M66 196L66 208A62 11 0 0 0 190 208L190 196A62 11 0 0 1 66 196Z', {
      fill: cylG('#C3CCD5', 0.22),
    })
    o += path('M66 132Q128 112 190 132L190 158Q128 138 66 158Z', { fill: cylG(N[200], 0.1) })
    o += path('M66 164Q128 144 190 164L190 170Q128 150 66 170Z', { fill: cylG(N[400], 0.1) })
    o += path(
      'M60 84L60 62Q60 46 128 44Q196 46 196 62L196 84A68 11 0 0 1 60 84Z',
      ink(cylG('#E6EBF0', 0.16))
    )
    o += path('M60 74A68 11 0 0 0 196 74', stroke(N[400], 1.6, { 'stroke-opacity': 0.7 }))
    o += ellipse(128, 53, 50, 5.5, { fill: N.w, 'fill-opacity': 0.75 })
    o += shine(76, 92, 8, 100, 0.55)
    return [ground(128, 222, 70), o]
  },

  // Hộp thiếc dẹt (cá hộp, bánh quy hộp thiếc): trụ thấp, khoen kéo trên nắp
  'hop-thiec'() {
    let o = path('M52 108L52 194A76 20 0 0 0 204 194L204 108Z', ink(cylG('#C9D1D9', 0.22)))
    o += path('M52 124A76 20 0 0 0 204 124L204 178A76 20 0 0 1 52 178Z', { fill: cylG(N.w, 0.1) })
    o += path('M52 124A76 20 0 0 0 204 124', stroke(N[500], 1.6, { 'stroke-opacity': 0.55 }))
    o += path('M52 178A76 20 0 0 0 204 178', stroke(N[500], 1.6, { 'stroke-opacity': 0.55 }))
    o += path('M52 150A76 20 0 0 0 204 150', stroke(N[300], 5, { 'stroke-opacity': 0.8 }))
    o += ellipse(128, 108, 76, 20, ink(vG(N[200], '#B8C2CD')))
    o += ellipse(128, 108, 67, 16, { fill: '#D5DCE3', stroke: N[400], 'stroke-width': 1.2 })
    o += ellipse(128, 107, 52, 11.5, stroke(N[400], 1.4, { 'stroke-opacity': 0.6 }))
    o += path('M124 108L132 108L134 116L122 116Z', { fill: N[400] })
    o += ellipse(128, 119, 15, 5.5, stroke(N[500], 3.2))
    o += circle(128, 107, 3, { fill: N[500] })
    o += shine(60, 116, 6, 72, 0.55)
    return [ground(128, 214, 82, 8), o]
  },

  // Hộp giấy cứng (bánh, trà, khăn giấy): hộp chữ nhật nhìn chéo, có nắp và ô kính
  'hop-banh'() {
    let o = path('M40 98L80 72L216 72L176 98Z', ink(vG(N[100], N[200])))
    o += path('M176 98L216 72L216 182L176 208Z', ink(vG('#D5DCE4', '#C1CAD4')))
    o += rect(40, 98, 136, 110, ink(vG(N.w, '#EEF2F6')))
    o += rect(41, 99, 134, 20, { fill: N[200] })
    o += path('M177 99L215 74L215 93L177 118Z', { fill: '#BEC8D2' })
    o += line(40, 119, 176, 119, stroke(N[500], 1.4, { 'stroke-opacity': 0.5 }))
    o += line(176, 119, 216, 93, stroke(N[500], 1.4, { 'stroke-opacity': 0.5 }))
    o += rect(56, 134, 104, 58, { rx: 10, fill: '#E3E8EE', stroke: N[400], 'stroke-width': 1.5 })
    for (const x of [80, 108, 136]) {
      o += circle(x, 163, 13, { fill: N[300], stroke: N[400], 'stroke-width': 1.2 })
      o += circle(x, 163, 8, stroke(N[400], 1.2, { 'stroke-opacity': 0.7 }))
    }
    o += rect(60, 138, 30, 6, { rx: 3, fill: N.w, 'fill-opacity': 0.8 })
    return [ground(130, 214, 98), o]
  },

  // Hộp giấy đựng sữa/nước ép: hộp đứng cao có ống hút
  'hop-giay'() {
    let o = path('M146 62L146 38L160 18', stroke(N[400], 7))
    o += path('M146 62L146 38L160 18', stroke(N.w, 2, { 'stroke-opacity': 0.8 }))
    o += path('M82 72L110 56L178 56L150 72Z', ink(vG(N[100], N[200])))
    o += path('M150 72L178 56L178 200L150 216Z', ink(vG('#D5DCE4', '#C1CAD4')))
    o += rect(82, 72, 68, 144, ink(vG(N.w, '#EEF2F6')))
    o += path('M96 64L164 64', stroke(N[400], 1.6))
    o += ellipse(146, 63, 4.5, 2.4, { fill: N[600] })
    o += path('M83 168Q116 150 149 164L149 215L83 215Z', { fill: N[200] })
    o += path('M151 163Q164 150 177 155L177 200L151 215Z', { fill: '#B4BFCA' })
    o += path('M83 168Q116 150 149 164', stroke(N[400], 2))
    o += circle(116, 118, 18, { fill: N[100], stroke: N[300], 'stroke-width': 2 })
    o += shine(88, 80, 6, 76, 0.7)
    return [ground(130, 218, 58), o]
  },

  // Hộp sữa chua: hai hũ nhỏ nắp nhôm
  'hop-sua-chua'() {
    const cup = (cx, top, h, wt, wb) => {
      const d = cupPath(cx, top, h, wt, wb)
      let c = path(d, ink(cylG(N.w, 0.14)))
      c += g(
        { 'clip-path': clipOf(path(d)) },
        rect(cx - wt, top + h * 0.42, wt * 2, h * 0.3, { fill: cylG(N[200], 0.12) }) +
          rect(cx - wt, top + h * 0.72, wt * 2, 4, { fill: N[400] })
      )
      c += ellipse(cx, top, wt / 2 + 3, wt * 0.15, ink(vG('#EEF2F6', '#B9C3CE')))
      c += ellipse(cx - wt * 0.08, top - wt * 0.03, wt * 0.3, wt * 0.06, {
        fill: N.w,
        'fill-opacity': 0.8,
      })
      c += path(
        `M${cx - wt / 2 - 2} ${top + 2}l-12 4q-4 2 -1 5l12 2Z`,
        ink(vG(N[200], N[400]), { 'stroke-width': 1.4 })
      )
      c += shine(cx - wt / 2 + 9, top + 10, 5, h * 0.7, 0.55)
      return c
    }
    const o = cup(158, 96, 78, 74, 56) + cup(106, 118, 88, 86, 64)
    return [ground(132, 214, 86), o]
  },

  // Ly mì: ly giấy lớn, nắp giấy bóc dở
  'ly-mi'() {
    const d = cupPath(128, 68, 140, 140, 100)
    let o = path(d, ink(cylG(N.w, 0.14)))
    o += g(
      { 'clip-path': clipOf(path(d)) },
      path('M40 124Q128 150 216 124L216 168Q128 194 40 168Z', { fill: cylG(N[200], 0.12) }) +
        path('M40 170Q128 196 216 170L216 178Q128 204 40 178Z', { fill: N[400] })
    )
    o += ellipse(128, 68, 73, 17, ink(cylG(N[100], 0.12)))
    o += ellipse(128, 68, 66, 13.5, { fill: '#E9EDF2' })
    o += path('M70 78Q58 52 80 34L106 52Q92 62 96 82Q82 84 70 78Z', ink(vG(N.w, N[200])))
    o += path('M80 34L106 52', stroke(N[400], 1.4))
    o += shine(72, 98, 7, 92, 0.6)
    return [ground(128, 214, 62), o]
  },

  // Chai nhựa PET: nắp vặn, eo nắm, nhãn quấn
  'chai-nhua'() {
    const body =
      'M114 62L142 62C142 80 166 86 166 104L166 148Q161 159 166 170L166 210Q166 222 154 222L102 222Q90 222 90 210L90 170Q95 159 90 148L90 104C90 86 114 80 114 62Z'
    let o = rect(114, 48, 28, 16, ink(cylG('#DCE5EC', 0.1)))
    o += path(body, ink(cylG('#DCE5EC', 0.14)))
    o += rect(90, 114, 76, 40, { fill: cylG(N.w, 0.1) })
    o += rect(90, 146, 76, 6, { fill: cylG(N[400], 0.12) })
    o += path('M92 184Q128 190 164 184', stroke(N[400], 1.6, { 'stroke-opacity': 0.7 }))
    o += path('M92 198Q128 204 164 198', stroke(N[400], 1.6, { 'stroke-opacity': 0.7 }))
    o += path(
      'M104 222Q110 214 116 222M122 222Q128 214 134 222M140 222Q146 214 152 222',
      stroke(N[400], 1.4, { 'stroke-opacity': 0.6 })
    )
    o += rect(106, 43, 44, 6, ink(cylG(N[300]), { rx: 3 }))
    o += rect(112, 20, 32, 24, ink(cylG(N[500], 0.25), { rx: 4 }))
    o += ribsV(112, 20, 32, 24, 4, N[800], 0.35)
    o += shine(98, 92, 6, 112, 0.65)
    return [ground(128, 224, 44), o]
  },

  // Chai thủy tinh cổ dài (bia, nước mắm, mật ong): nắp khoằm, nhãn trắng
  'chai-thuy-tinh'() {
    const body =
      'M117 30L139 30L139 40Q141 44 140 48L141 96C142 118 160 124 160 146L160 214Q160 224 150 224L106 224Q96 224 96 214L96 146C96 124 114 118 115 96L116 48Q115 44 117 40Z'
    let o = path(body, ink(cylG('#7D8C9B', 0.3), { 'fill-opacity': 0.95 }))
    o += rect(116, 66, 24, 22, { fill: cylG(N.w, 0.12) })
    o += rect(96, 150, 64, 50, { fill: cylG(N.w, 0.12) })
    o += rect(96, 186, 64, 5, { fill: N[400] })
    o += ellipse(128, 168, 16, 9, stroke(N[400], 2))
    o += path(
      'M114 16L142 16L142 26L139 31L135 27L131 31L127 27L123 31L119 27L115 31L114 26Z',
      ink(cylG(N[400], 0.2))
    )
    o += shine(121, 34, 4, 30, 0.6)
    o += shine(102, 128, 6, 18, 0.5)
    o += shine(102, 204, 6, 14, 0.5)
    return [ground(128, 226, 38), o]
  },

  // Chai gia vị bóp: thân trắng, nắp nhọn
  'chai-gia-vi'() {
    const body =
      'M108 66L148 66C150 84 176 92 176 114L176 206Q176 222 160 222L96 222Q80 222 80 206L80 114C80 92 106 84 108 66Z'
    let o = path(body, ink(cylG(N[50], 0.14)))
    o += rect(80, 124, 96, 66, { fill: cylG(N[200], 0.12) })
    o += rect(80, 178, 96, 6, { fill: N[400] })
    o += circle(128, 150, 15, { fill: N[100], stroke: N[300], 'stroke-width': 2 })
    o += rect(106, 46, 44, 22, ink(cylG(N[500], 0.25), { rx: 5 }))
    o += ribsV(106, 46, 44, 22, 4, N[800], 0.3)
    o += path('M123 16L133 16L142 47L114 47Z', ink(cylG(N[500], 0.25)))
    o += shine(88, 102, 7, 96, 0.65)
    return [ground(128, 224, 52), o]
  },

  // Chai dầu gội/sữa tắm có vòi nhấn
  'chai-dau-goi'() {
    const body =
      'M100 92L156 92Q186 96 188 124L188 200Q188 222 166 222L90 222Q68 222 68 200L68 124Q70 96 100 92Z'
    let o = rect(123, 52, 10, 26, ink(cylG(N[300])))
    o += path(body, ink(cylG(N[50], 0.14)))
    o += rect(84, 126, 88, 66, {
      rx: 16,
      fill: cylG(N[200], 0.1),
      stroke: N[300],
      'stroke-width': 1.5,
    })
    o += path('M96 150Q128 140 160 150', stroke(N[400], 3))
    o += path('M104 166Q128 158 152 166', stroke(N[300], 3))
    o += rect(106, 74, 44, 20, ink(cylG(N[500], 0.25), { rx: 4 }))
    o += ribsV(106, 74, 44, 20, 4, N[800], 0.3)
    o += path(
      'M108 40Q108 34 114 34L150 34Q156 34 156 40L156 44L180 46Q186 47 186 52L186 56L156 56L156 58Q156 62 150 62L114 62Q108 62 108 56Z',
      ink(cylG(N[500], 0.25))
    )
    o += rect(112, 38, 36, 4, { rx: 2, fill: N.w, 'fill-opacity': 0.35 })
    o += shine(76, 112, 8, 88, 0.65)
    return [ground(128, 224, 64), o]
  },

  // Chai tẩy rửa/nước giặt có quai cầm và nắp đong lớn
  'chai-tay-rua'() {
    const body =
      'M66 98Q66 80 84 78L118 78Q124 66 140 66L176 66Q196 66 196 88L196 204Q196 222 178 222L84 222Q66 222 66 204Z' +
      'M150 84L176 84Q180 84 180 88L180 112Q180 116 176 116L150 116Q146 116 146 112L146 88Q146 84 150 84Z'
    let o = rect(80, 60, 34, 20, ink(cylG(N[200])))
    o += path(body, ink(cylG('#F4F6F9', 0.16), { 'fill-rule': 'evenodd' }))
    o += path(
      'M146 116Q150 126 166 124Q180 124 182 116',
      stroke(N[400], 1.4, { 'stroke-opacity': 0.6 })
    )
    o += rect(80, 134, 100, 70, {
      rx: 12,
      fill: cylG(N[200], 0.1),
      stroke: N[300],
      'stroke-width': 1.5,
    })
    o += circle(106, 160, 9, { fill: N.w, stroke: N[400], 'stroke-width': 1.5 })
    o += circle(124, 176, 6, { fill: N.w, stroke: N[400], 'stroke-width': 1.5 })
    o += path('M140 160L166 160M140 172L160 172', stroke(N[400], 3))
    o += rect(74, 28, 46, 36, ink(cylG(N[500], 0.25), { rx: 5 }))
    o += ribsV(74, 28, 46, 36, 4, N[800], 0.3)
    o += rect(74, 28, 46, 6, { rx: 3, fill: N.w, 'fill-opacity': 0.25 })
    o += shine(74, 100, 7, 96, 0.65)
    return [ground(130, 224, 70), o]
  },

  // Can dầu ăn: can rộng, quai trên đỉnh, thấy mức dầu qua thân nhựa trong
  'can-dau'() {
    const outer =
      'M46 94Q46 78 62 78L98 78L104 62Q106 54 116 54L194 54Q210 54 210 70L210 206Q210 222 194 222L62 222Q46 222 46 206Z'
    const hole =
      'M126 70L190 70Q194 70 194 74L194 88Q194 92 190 92L126 92Q122 92 122 88L122 74Q122 70 126 70Z'
    let o = rect(60, 62, 30, 18, ink(cylG(N[200])))
    o += path(outer + hole, ink(cylG('#EEF1F4', 0.14), { 'fill-rule': 'evenodd' }))
    o += g(
      { 'clip-path': clipOf(path(outer)) },
      rect(40, 118, 180, 110, { fill: vG('#E9E1CB', '#D6C9A8'), 'fill-opacity': 0.8 }) +
        path('M46 118L210 118', stroke('#C9B98F', 2))
    )
    o += rect(68, 140, 120, 60, { rx: 10, fill: N.w, stroke: N[300], 'stroke-width': 1.5 })
    o += path('M84 162L150 162M84 176L134 176', stroke(N[300], 4))
    o += circle(166, 170, 11, { fill: N[100], stroke: N[400], 'stroke-width': 1.5 })
    o += rect(54, 38, 42, 26, ink(cylG(N[500], 0.25), { rx: 5 }))
    o += ribsV(54, 38, 42, 26, 4, N[800], 0.3)
    o += shine(54, 100, 7, 96, 0.65)
    return [ground(128, 224, 86), o]
  },

  // Tuýp kem: đứng trên nắp, đuôi ép dẹt
  tuyp() {
    let t = path('M-86 -34L60 -24Q72 -22 76 -14L76 14Q72 22 60 24L-86 34Z', ink(vG(N[300], N.w)))
    t += path('M-30 -30L4 -28L4 28L-30 30Z', { fill: N[200] })
    t += path('M10 -27L18 -26L18 26L10 27Z', { fill: N[400] })
    t += rect(-104, -36, 20, 72, ink(vG(N[200], N[100]), { rx: 2 }))
    t += ribsH(-104, -36, 20, 72, 4, N[800], 0.25)
    t += path('M76 -15L88 -11L88 11L76 15Z', ink(N[300]))
    t += rect(88, -19, 30, 38, ink(vG(N[400], N[600]), { rx: 4 }))
    t += ribsH(88, -19, 30, 38, 4, N[800], 0.3)
    t += path('M-80 22L56 14', stroke(N.w, 5, { 'stroke-opacity': 0.75 }))
    // Vẽ nằm ngang rồi xoay đứng: nắp ở dưới, đuôi ở trên
    const o = g({ transform: 'translate(128 112) rotate(-90) scale(0.94)' }, t)
    return [ground(128, 224, 26, 6), o]
  },

  // Vỉ (pin, kẹo, dao cạo): bìa cứng có lỗ treo, vỉ nhựa trong
  vi() {
    const card =
      'M66 26L190 26Q202 26 202 38L202 212Q202 224 190 224L66 224Q54 224 54 212L54 38Q54 26 66 26Z' +
      'M112 40L144 40Q150 40 150 46Q150 52 144 52L112 52Q106 52 106 46Q106 40 112 40Z'
    let o = path(card, ink(vG(N[50], N[200]), { 'fill-rule': 'evenodd' }))
    o += rect(55, 62, 146, 6, { fill: N[300] })
    for (let i = 0; i < 4; i++) {
      const x = 80 + i * 26
      o += rect(x, 92, 20, 102, ink(cylG(N[400], 0.24), { rx: 4 }))
      o += rect(x, 92, 20, 18, { rx: 4, fill: N[600] })
      o += rect(x + 6, 86, 8, 8, { rx: 2, fill: N[500] })
      o += rect(x + 3, 112, 4, 74, { rx: 2, fill: N.w, 'fill-opacity': 0.5 })
    }
    o += rect(70, 78, 116, 128, {
      rx: 18,
      fill: N.w,
      'fill-opacity': 0.28,
      stroke: N[500],
      'stroke-opacity': 0.45,
      'stroke-width': 2,
    })
    o += shine(76, 86, 7, 110, 0.7)
    return [ground(128, 226, 72, 6), o]
  },

  // Cuộn giấy: lốc ba cuộn xếp chồng
  'cuon-giay'() {
    const roll = (x, y, r) => {
      const [dx, dy] = [14, -10]
      const L = Math.hypot(dx, dy)
      const [nx, ny] = [-dy / L, dx / L]
      let c = circle(x + dx, y + dy, r, ink(N[300]))
      c += path(
        `M${r2(x + r * nx)} ${r2(y + r * ny)}L${r2(x + dx + r * nx)} ${r2(y + dy + r * ny)}L${r2(x + dx - r * nx)} ${r2(y + dy - r * ny)}L${r2(x - r * nx)} ${r2(y - r * ny)}Z`,
        { fill: N[200] }
      )
      c += circle(x, y, r, ink(N.w))
      c += circle(x, y, r * 0.76, stroke(N[200], 2))
      c += circle(x, y, r * 0.52, stroke(N[200], 2))
      c += circle(x, y, 14, { fill: '#D9D3C7', stroke: N[400], 'stroke-width': 1.5 })
      c += circle(x, y, 9, { fill: N[500] })
      return c
    }
    const o = roll(128, 92, 44) + roll(84, 168, 44) + roll(172, 168, 44)
    return [ground(136, 216, 96), o]
  },

  // Gói mì: gói dẹt, mép hàn răng cưa trên dưới, ô nhìn thấy sợi mì
  'goi-mi'() {
    let o = path(
      'M38 90Q128 82 218 90Q222 136 218 182Q128 190 38 182Q34 136 38 90Z',
      ink(cylG(N[50], 0.12))
    )
    o += sealH(34, 74, 188, 18, true)
    o += sealH(34, 180, 188, 18, false)
    o += path('M38 120Q90 112 120 134Q100 160 38 156Z', { fill: N[200] })
    o += rect(112, 104, 92, 62, { rx: 28, fill: '#E9E6DF', stroke: N[300], 'stroke-width': 1.5 })
    for (let i = 0; i < 4; i++) {
      const y = 118 + i * 11
      o += path(`M124 ${y}q6 -6 12 0t12 0t12 0t12 0t12 0t8 0`, stroke('#C9BFAE', 3))
    }
    o += shine(46, 98, 70, 6, 0.75)
    return [ground(128, 206, 98, 6), o]
  },

  // Gói kẹo/bánh thanh: gói dài, hàn hai đầu, đặt nghiêng
  'goi-keo'() {
    let t = path('M-80 -30Q0 -38 80 -30L80 30Q0 38 -80 30Z', ink(vG(N.w, N[200])))
    t += g(
      { 'clip-path': clipOf(path('M-80 -30Q0 -38 80 -30L80 30Q0 38 -80 30Z')) },
      path('M-20 -40L20 -40L-4 40L-44 40Z', { fill: N[300] }) +
        path('M28 -40L38 -40L14 40L4 40Z', { fill: N[400] })
    )
    t += circle(44, 0, 15, { fill: N[100], stroke: N[300], 'stroke-width': 2 })
    t += sealV(-98, -32, 20, 64, true)
    t += sealV(78, -32, 20, 64, false)
    t += path('M-72 -20Q0 -27 72 -20', stroke(N.w, 4, { 'stroke-opacity': 0.9 }))
    const o = g({ transform: 'translate(128 124) rotate(-16) scale(1.1)' }, t)
    return [ground(128, 196, 100, 9, 0.28), o]
  },

  // Gói snack: túi gối phồng đứng, hàn trên dưới
  'goi-snack'() {
    const body = 'M62 40Q128 32 194 40Q208 126 194 206Q128 214 62 206Q48 126 62 40Z'
    let o = path(body, ink(cylG(N[50], 0.16)))
    o += g(
      { 'clip-path': clipOf(path(body)) },
      path('M40 150Q120 100 220 130L220 156Q120 128 40 178Z', { fill: N[300] })
    )
    o += circle(128, 112, 32, { fill: '#E7E4DD', stroke: N[300], 'stroke-width': 2 })
    for (const [x, y, a] of [
      [116, 104, -20],
      [138, 110, 25],
      [124, 124, 5],
    ])
      o += ellipse(x, y, 12, 8, {
        fill: '#D3C8B3',
        stroke: '#BBAE95',
        'stroke-width': 1.2,
        transform: `rotate(${a} ${x} ${y})`,
      })
    o += sealH(58, 22, 140, 20, true)
    o += sealH(58, 202, 140, 20, false)
    o += shine(68, 56, 8, 124, 0.7)
    return [ground(128, 224, 70, 6), o]
  },

  // Túi gạo/đồ khô: bao đứng, miệng may chỉ, lỗ xách, ô kính thấy hạt
  'tui-gao'(rnd) {
    const body =
      'M58 58L198 58Q204 130 200 200Q200 220 178 222L78 222Q56 220 56 200Q52 130 58 58Z' +
      'M112 68L144 68Q150 68 150 74Q150 80 144 80L112 80Q106 80 106 74Q106 68 112 68Z'
    let o = path(body, ink(cylG(N[50], 0.14), { 'fill-rule': 'evenodd' }))
    o += rect(54, 34, 148, 26, ink(vG(N[100], N[200]), { rx: 3 }))
    o += path(
      'M58 47L198 47',
      stroke(N[500], 1.6, { 'stroke-dasharray': '5 4', 'stroke-linecap': 'butt' })
    )
    o += rect(57, 92, 142, 8, { fill: N[300] })
    const win =
      'M90 114L166 114Q178 114 178 126L178 178Q178 190 166 190L90 190Q78 190 78 178L78 126Q78 114 90 114Z'
    o += path(win, { fill: '#E9EDF1', stroke: N[400], 'stroke-width': 1.5 })
    let grains = ''
    for (let i = 0; i < 46; i++) {
      const x = 82 + rnd() * 92
      const y = 118 + rnd() * 68
      grains += ellipse(r2(x), r2(y), 5, 2.6, {
        fill: N.w,
        stroke: N[300],
        'stroke-width': 1,
        transform: `rotate(${Math.round(rnd() * 180)} ${r2(x)} ${r2(y)})`,
      })
    }
    o += g({ 'clip-path': clipOf(path(win)) }, grains)
    o += path(win, stroke(N[400], 1.5))
    o += path('M62 206Q128 214 194 206', stroke(N[300], 2))
    o += shine(64, 104, 7, 92, 0.65)
    return [ground(128, 224, 78), o]
  },

  // Túi nước giặt/bột giặt: túi đứng có vòi rót ở góc và lỗ xách
  'tui-giat'() {
    const body =
      'M60 58L168 58L196 86L196 202Q196 222 176 222L76 222Q54 222 54 202L54 64Q54 58 60 58Z' +
      'M84 76L118 76Q124 76 124 82Q124 88 118 88L84 88Q78 88 78 82Q78 76 84 76Z'
    let o = g(
      { transform: 'translate(184 70) rotate(45)' },
      rect(-10, -6, 20, 10, ink(N[300])) +
        rect(-15, -30, 30, 26, ink(cylG(N[500], 0.25), { rx: 4 })) +
        ribsV(-15, -30, 30, 26, 4, N[800], 0.3)
    )
    o += path(body, ink(cylG(N[50], 0.14), { 'fill-rule': 'evenodd' }))
    o += path('M56 70L166 70L192 96', stroke(N[300], 2))
    o += path('M54 120Q130 104 196 124L196 136Q130 116 54 132Z', { fill: N[300] })
    for (const [x, y, r] of [
      [150, 164, 16],
      [122, 184, 10],
      [164, 196, 7],
      [96, 160, 6],
    ])
      o +=
        circle(x, y, r, { fill: N.w, stroke: N[400], 'stroke-width': 1.6 }) +
        circle(x - r * 0.35, y - r * 0.35, r * 0.25, { fill: N[200] })
    o += path('M58 206Q126 214 194 206', stroke(N[300], 2))
    o += shine(62, 142, 7, 56, 0.65)
    return [ground(126, 224, 76), o]
  },

  // Túi đông lạnh: túi zip phủ sương, biểu tượng bông tuyết
  'tui-dong-lanh'(rnd) {
    const body =
      'M54 56L202 56Q210 56 210 64L210 210Q210 218 202 218L54 218Q46 218 46 210L46 64Q46 56 54 56Z'
    let o = path(body, ink(vG('#F3F6F9', '#D9E1E9')))
    o += path('M47 70L209 70', stroke(N[400], 2))
    o += path('M47 78L209 78', stroke(N[400], 2))
    o += rect(178, 62, 20, 22, ink(cylG(N[500], 0.25), { rx: 3 }))
    let flakes = ''
    for (let i = 0; i < 40; i++)
      flakes += circle(r2(54 + rnd() * 148), r2(88 + rnd() * 124), r2(1 + rnd() * 2.4), {
        fill: N.w,
        'fill-opacity': 0.9,
      })
    o += flakes
    let snow = ''
    for (const a of [0, 60, 120]) {
      const c = Math.cos(a * DEG)
      const s = Math.sin(a * DEG)
      snow += line(-34 * s, -34 * c, 34 * s, 34 * c, stroke(N[400], 4.5))
      for (const k of [-1, 1]) {
        const bx = 22 * s * k
        const by = 22 * c * k
        for (const t of [-1, 1]) {
          const aa = (a + t * 40) * DEG
          snow += line(
            bx,
            by,
            bx + 11 * Math.sin(aa) * k,
            by + 11 * Math.cos(aa) * k,
            stroke(N[400], 3.5)
          )
        }
      }
    }
    o += g(
      { transform: 'translate(128 146)' },
      circle(0, 0, 46, { fill: N.w, 'fill-opacity': 0.55 }) + snow
    )
    o += shine(54, 92, 7, 110, 0.7)
    return [ground(128, 222, 84), o]
  },

  // Hũ: hũ thủy tinh nắp vặn rộng
  hu() {
    const body =
      'M90 92L166 92Q192 96 192 122L192 200Q192 222 170 222L86 222Q64 222 64 200L64 122Q64 96 90 92Z'
    let o = rect(80, 82, 96, 14, ink(cylG('#DDE4EA', 0.14)))
    o += path(body, ink(cylG('#E3E9EE', 0.16), { 'fill-opacity': 0.96 }))
    o += rect(64, 130, 128, 62, { fill: cylG(N.w, 0.1) })
    o += rect(64, 182, 128, 5, { fill: N[400] })
    o += ellipse(128, 156, 26, 14, stroke(N[300], 2.5))
    o += rect(70, 48, 116, 38, ink(cylG(N[500], 0.25), { rx: 7 }))
    o += ribsV(70, 48, 116, 38, 5, N[800], 0.28)
    o += rect(72, 50, 112, 6, { rx: 3, fill: N.w, 'fill-opacity': 0.3 })
    o += shine(72, 104, 7, 22, 0.6)
    o += shine(72, 196, 7, 16, 0.6)
    return [ground(128, 224, 68), o]
  },

  // Khay thịt: khay xốp trắng bọc màng, thịt ba chỉ màu tự nhiên
  'khay-thit'() {
    let o = path(
      'M40 80L216 80L232 168Q233 176 225 176L31 176Q23 176 24 168Z',
      ink(vG(N.w, N[100]))
    )
    o += path('M31 176L225 176L216 198L40 198Z', ink(vG(N[200], N[300])))
    const recess = 'M52 90L204 90L218 164L38 164Z'
    o += path(recess, { fill: '#E6EBF0', stroke: N[300], 'stroke-width': 1.5 })
    const meat = 'M60 100Q128 92 198 100L208 154Q128 162 48 154Z'
    o += path(meat, { fill: '#DC6B72', stroke: '#B84852', 'stroke-width': 2 })
    o += g(
      { 'clip-path': clipOf(path(meat)) },
      path('M40 94Q128 86 216 94L216 108Q128 100 40 108Z', { fill: '#F4DCCB' }) +
        path('M40 122Q90 116 128 124T216 120L216 128Q170 132 128 132T40 130Z', {
          fill: '#F7E4DA',
        }) +
        path('M40 140Q100 134 140 142T216 138L216 144Q170 150 130 148T40 146Z', {
          fill: '#F7E4DA',
        }) +
        path('M40 112Q128 106 216 112', stroke('#E98B91', 3))
    )
    o += path(recess, { fill: N.w, 'fill-opacity': 0.16 })
    o += path('M70 160L104 96M96 160L130 96', stroke(N.w, 3, { 'stroke-opacity': 0.6 }))
    o += path('M176 158L194 122', stroke(N.w, 3, { 'stroke-opacity': 0.5 }))
    return [ground(128, 202, 100, 6), o]
  },

  // Khay trứng: khay giấy ép hai hàng trứng màu tự nhiên
  'khay-trung'() {
    let o = path('M40 104L216 104L234 176L22 176Z', ink(vG('#CFC9BF', '#BDB6AA')))
    const egg = (x, y, rx, ry) =>
      ellipse(
        x,
        y,
        rx,
        ry,
        ink(
          linGrad([
            [0, '#F6E2C6'],
            [0.5, '#EBC99D'],
            [1, '#D2A574'],
          ]),
          { 'stroke-opacity': 0.25 }
        )
      ) +
      ellipse(x - rx * 0.35, y - ry * 0.35, rx * 0.28, ry * 0.2, { fill: N.w, 'fill-opacity': 0.7 })
    for (let i = 0; i < 5; i++) o += egg(66 + i * 31, 110, 14.5, 18)
    o += path('M34 128L222 128L226 146L30 146Z', { fill: '#C9C2B6' })
    for (let i = 0; i < 5; i++) o += egg(60 + i * 34, 138, 16.5, 20.5)
    let front = 'M22 158'
    for (let i = 0; i < 5; i++) {
      const x0 = 22 + i * 42.4
      front += `Q${r2(x0 + 21.2)} 178 ${r2(x0 + 42.4)} 158`
    }
    front += 'L222 206Q222 210 218 210L38 210Q34 210 34 206Z'
    o += path(front, ink(vG('#E3DED5', '#CFC8BC')))
    for (let i = 1; i < 5; i++) {
      const x = 22 + i * 42.4
      o += line(x, 160, x - (x - 128) * 0.08, 206, stroke('#BDB5A8', 1.6))
    }
    return [ground(128, 214, 100, 6), o]
  },

  // Bó rau: lá xanh tự nhiên, cuống trắng xanh, buộc dây
  'bo-rau'(rnd) {
    let stems = ''
    for (let i = 0; i < 7; i++) {
      const x = 112 + i * 5.4
      stems += path(
        `M${r2(x)} 222Q${r2(x + (i - 3) * 2)} 180 ${r2(128 + (i - 3) * 14)} 132`,
        stroke('#9CC47A', 7.5)
      )
      stems += path(
        `M${r2(x)} 222Q${r2(x + (i - 3) * 2)} 180 ${r2(128 + (i - 3) * 14)} 132`,
        stroke('#E6F2D6', 4.5)
      )
    }
    const colors = ['#2F8F3E', '#76C356', '#3FA34D', '#9AD468', '#267A34']
    let leaves = ''
    const order = [-4, 4, -3, 3, -2, 2, -1, 1, 0]
    for (const [j, k] of order.entries()) {
      const a = k * 13 + (rnd() - 0.5) * 6
      const len = 104 - Math.abs(k) * 6 + rnd() * 8
      const w = 26 + rnd() * 6
      const c = colors[j % colors.length]
      leaves += g(
        { transform: `translate(${r2(128 + k * 6)} 156) rotate(${r2(a)})` },
        path(leafPath(len, w), {
          fill: c,
          stroke: '#17572A',
          'stroke-width': 1.6,
          'stroke-opacity': 0.7,
        }) +
          path(`M0 -6L0 ${r2(-len * 0.9)}`, stroke(tint(c, 0.45), 2.4)) +
          range(3)
            .map((t) => {
              const y = -len * (0.3 + t * 0.18)
              return path(
                `M0 ${r2(y)}l${r2(w * 0.5)} ${r2(-w * 0.45)}M0 ${r2(y)}l${r2(-w * 0.5)} ${r2(-w * 0.45)}`,
                stroke(tint(c, 0.3), 1.4)
              )
            })
            .join('')
      )
    }
    let o = stems + leaves
    o += rect(102, 176, 52, 14, ink('#EDE3CC', { rx: 4 }))
    o += path('M104 183L152 183', stroke('#C9B98F', 1.6))
    return [ground(128, 224, 40, 6), o]
  },

  // Trái cây: chuối, táo, cam trong rổ trắng
  'trai-cay'() {
    let o = ''
    for (const [dx, dy, a] of [
      [0, 0, 0],
      [6, 12, 6],
      [-4, 22, 12],
    ]) {
      o += g(
        { transform: `translate(${dx} ${dy}) rotate(${a} 128 110)` },
        path('M64 112Q112 44 194 70Q202 74 196 80Q124 66 76 124Q66 126 64 112Z', {
          fill: linGrad(
            [
              [0, '#FBE27A'],
              [1, '#E9B92C'],
            ],
            'v'
          ),
          stroke: '#A97A12',
          'stroke-width': 1.8,
        }) +
          path('M74 108Q118 60 190 76', stroke('#FFF3B8', 2.4)) +
          path('M192 70L202 66L204 74L196 78Z', { fill: '#6B4A1C' })
      )
    }
    o += circle(160, 132, 34, {
      fill: linGrad([
        [0, '#FFB54D'],
        [1, '#E97A10'],
      ]),
      stroke: '#B85A06',
      'stroke-width': 2,
    })
    o += circle(150, 122, 9, { fill: N.w, 'fill-opacity': 0.4 })
    o += circle(160, 100, 3, { fill: '#7A5A1E' })
    o += path('M160 100Q176 84 192 92Q178 104 160 100Z', {
      fill: '#3E9A3B',
      stroke: '#2A6E2A',
      'stroke-width': 1.4,
    })
    o += path(
      'M96 108Q78 100 66 116Q58 140 70 158Q84 174 100 166Q116 174 130 158Q142 140 134 116Q122 100 104 108Q100 110 96 108Z',
      {
        fill: linGrad([
          [0, '#F0525A'],
          [1, '#B3162A'],
        ]),
        stroke: '#8E1022',
        'stroke-width': 2,
      }
    )
    o += path('M100 108Q98 96 104 88', stroke('#6B4A1C', 3.2))
    o += path('M103 96Q114 84 126 92Q114 102 103 96Z', {
      fill: '#4CAF50',
      stroke: '#2F7D32',
      'stroke-width': 1.2,
    })
    o += ellipse(82, 126, 8, 12, {
      fill: N.w,
      'fill-opacity': 0.45,
      transform: 'rotate(20 82 126)',
    })
    o += path('M38 152L218 152L200 206Q198 214 190 214L66 214Q58 214 56 206Z', ink(cylG(N.w, 0.14)))
    o += path('M48 172L208 172M54 190L202 190', stroke(N[300], 2.5))
    for (let i = 0; i < 9; i++) {
      const x = 60 + i * 17
      o += line(x, 160, x + (x - 128) * -0.06, 210, stroke(N[200], 2))
    }
    o += rect(32, 144, 192, 14, ink(cylG(N[100], 0.12), { rx: 7 }))
    return [ground(128, 218, 84, 6), o]
  },

  // Bánh mì: ổ bánh mì sandwich trong túi nilon, cột dây xoắn
  'banh-mi'() {
    const bag =
      'M30 98Q30 78 56 78L196 78Q212 78 218 96L232 120L232 152L218 178Q212 204 196 204L56 204Q30 204 30 184Z'
    // Thân túi phía sau ổ bánh: trắng mờ để nền màu không lẫn vào bánh
    let o = path(bag, { fill: N.w, 'fill-opacity': 0.55 })
    o += path('M232 124L248 112L250 160L232 148Z', {
      fill: N.w,
      'fill-opacity': 0.6,
      stroke: N[800],
      'stroke-opacity': 0.25,
      'stroke-width': 1.5,
    })
    const loaf =
      'M42 196L42 132Q42 98 74 96Q82 80 104 86Q128 74 152 86Q174 80 182 96Q214 98 214 132L214 196Z'
    o += path(loaf, {
      fill: linGrad(
        [
          [0, '#E7A95A'],
          [0.45, '#D18A3C'],
          [1, '#B06E2C'],
        ],
        'v'
      ),
      stroke: '#7E4A1C',
      'stroke-width': 2,
    })
    for (let i = 1; i < 9; i++) {
      const x = 42 + i * 19.1
      o += line(
        x,
        100 - Math.sin((i / 9) * Math.PI) * 12,
        x,
        194,
        stroke('#8F5524', 1.8, { 'stroke-opacity': 0.5 })
      )
    }
    o += path('M52 130Q56 106 78 104', stroke('#F6D29C', 5, { 'stroke-opacity': 0.85 }))
    o += path('M92 96Q128 82 166 94', stroke('#F6D29C', 4, { 'stroke-opacity': 0.6 }))
    // Mặt trước túi: chỉ viền và vệt bóng
    o += path(bag, stroke(N[800], 2, { 'stroke-opacity': 0.3 }))
    o += path('M218 96L232 120L232 152L218 178', stroke(N.w, 2.5, { 'stroke-opacity': 0.8 }))
    o += rect(226, 118, 10, 36, ink(cylG(N[500], 0.25), { rx: 3 }))
    o += path('M40 96Q40 88 52 88L120 88', stroke(N.w, 4, { 'stroke-opacity': 0.9 }))
    o += path('M38 120L38 176', stroke(N.w, 4, { 'stroke-opacity': 0.8 }))
    o += path('M60 196L190 196', stroke(N.w, 3, { 'stroke-opacity': 0.6 }))
    return [ground(132, 210, 100, 6), o]
  },
}

// ============================================================ Dựng và xuất
// Hình nhỏ hơn mặt bằng chung: [hệ số phóng, tâm phóng theo y]
const FIT = {
  'hop-sua-chua': [1.14, 150],
  'lon-sua-bot': [1.06, 222],
  'trai-cay': [1.08, 150],
  'hop-thiec': [1.04, 160],
}
function renderShape(kind) {
  defs = []
  uid = 0
  const rnd = mulberry32(hashStr(kind))
  const [shadow, obj] = SHAPES[kind](rnd)
  const fit = FIT[kind]
  const inner = shadow + g({ filter: dropShadow() }, obj)
  const body = fit
    ? g(
        { transform: `translate(128 ${fit[1]}) scale(${fit[0]}) translate(-128 ${-fit[1]})` },
        inner
      )
    : inner
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}"><defs>${defs.join('')}</defs>${body}</svg>`
}

async function encodeWebp(svg) {
  const png = await sharp(Buffer.from(svg)).png().toBuffer()
  for (let q = 90; q >= 40; q -= 6) {
    const buf = await sharp(png)
      .webp({ quality: q, alphaQuality: 90, effort: 6, smartSubsample: true })
      .toBuffer()
    if (buf.length <= MAX_BYTES) return { buf, q, png }
  }
  throw new Error('Ảnh vượt 15 KB ở mọi mức chất lượng')
}

async function main() {
  const data = JSON.parse(readFileSync(DATA_FILE, 'utf8'))
  const kinds = [...new Set(data.products.map((p) => p.image).filter(Boolean))].sort()
  const missing = kinds.filter((k) => !SHAPES[k])
  if (missing.length) throw new Error(`Chưa có hình cho kiểu bao bì: ${missing.join(', ')}`)
  mkdirSync(OUT_DIR, { recursive: true })
  if (PREVIEW) mkdirSync(PREVIEW, { recursive: true })
  const sizes = []
  for (const kind of kinds) {
    if (ONLY && !kind.includes(ONLY)) continue
    const used = data.products.filter((p) => p.image === kind).length
    const { buf, q, png } = await encodeWebp(renderShape(kind))
    writeFileSync(join(OUT_DIR, `${kind}.webp`), buf)
    if (PREVIEW) writeFileSync(join(PREVIEW, `${kind}.png`), png)
    sizes.push(buf.length)
    console.log(
      `${(kind + '.webp').padEnd(20)} ${String(used).padStart(3)} hàng hóa ${(buf.length / 1024).toFixed(1).padStart(6)} KB  q${q}`
    )
  }
  const max = Math.max(...sizes) / 1024
  const avg = sizes.reduce((a, b) => a + b, 0) / sizes.length / 1024
  console.log(
    `Đã tạo ${sizes.length} ảnh · lớn nhất ${max.toFixed(1)} KB · trung bình ${avg.toFixed(1)} KB`
  )
}

await main()
