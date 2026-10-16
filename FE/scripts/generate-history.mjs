// Sinh lịch sử 90 ngày cho src/mock/seed/demo-data.json: phiếu nhập (receipts), phiếu điều chỉnh (adjustments),
// ca (shifts), hóa đơn (orders), phiếu đổi trả (returns); ghi thêm openingStock, stock vào từng hàng hóa.
// Xác định: bộ sinh số ngẫu nhiên hạt giống cố định, chạy lại ra đúng kết quả cũ.
// Giữ nguyên phần viết tay (productGroups, products trừ openingStock/stock, suppliers, customers).
// Khóa gọn và cách suy ra trường: docs/06-THIET-KE-CSDL.md §5. Công thức tiền: docs/07-DANH-SACH-API.md §3.
// Chạy: pnpm seed:history  (hoặc node scripts/generate-history.mjs)
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const file = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'src',
  'mock',
  'seed',
  'demo-data.json'
)
const data = JSON.parse(readFileSync(file, 'utf8'))

// ---------------------------------------------------------------- Ngẫu nhiên xác định
function mulberry32(seed) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const SEED = 20261015
const rand = mulberry32(SEED)
const randInt = (min, max) => min + Math.floor(rand() * (max - min + 1))
const pick = (arr) => arr[Math.floor(rand() * arr.length)]
function weighted(entries) {
  const total = entries.reduce((s, [, w]) => s + w, 0)
  let r = rand() * total
  for (const [value, w] of entries) {
    r -= w
    if (r < 0) return value
  }
  return entries[entries.length - 1][0]
}
const hhmm = (min) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))

// ---------------------------------------------------------------- Công thức tiền (docs/07 §3)
const floor500 = (n) => Math.floor(n / 500) * 500
const products = data.products
const P = (no) => products[no - 1]
const unitOf = (p, u) => (u === 0 ? { name: p.unit, factor: 1, price: p.price } : p.units[u - 1])
const discountAmount = (base, dc) =>
  dc.ty === 'PhanTram' ? floor500((base * dc.v) / 100) : Math.min(dc.v, base)

function priceOrder(o) {
  const lines = o.it.map(([p, u, q, ld]) => {
    const prod = P(p)
    const unit = unitOf(prod, u)
    const amount = unit.price * q
    const lineDiscount = ld ? discountAmount(amount, ld) : 0
    return {
      p,
      u,
      q,
      baseQty: q * unit.factor,
      amount,
      lineDiscount,
      cost: q * unit.factor * prod.cost,
    }
  })
  const subtotal = lines.reduce((s, l) => s + l.amount, 0)
  const lineDiscountTotal = lines.reduce((s, l) => s + l.lineDiscount, 0)
  const afterLine = subtotal - lineDiscountTotal
  const orderDiscount = o.dc ? discountAmount(afterLine, o.dc) : 0
  let allocated = 0
  lines.forEach((l, i) => {
    const base = l.amount - l.lineDiscount
    l.alloc =
      i === lines.length - 1
        ? orderDiscount - allocated
        : afterLine === 0
          ? 0
          : Math.round((orderDiscount * base) / afterLine)
    allocated += l.alloc
    l.net = base - l.alloc
  })
  const total = Math.max(0, afterLine - orderDiscount)
  const costTotal = lines.reduce((s, l) => s + l.cost, 0)
  return { lines, subtotal, lineDiscountTotal, orderDiscount, total, costTotal }
}
// Mức gợi ý tiền mặt BR-12
function cashSuggestions(total) {
  const s = [total]
  for (const step of [10000, 50000, 100000, 500000]) {
    const v = Math.ceil(total / step) * step
    if (!s.includes(v)) s.push(v)
  }
  return s
}

// ---------------------------------------------------------------- Kiểm tra dữ liệu viết tay (docs/05 §1)
const unitPrice = (no, u) => unitOf(P(no), u).price
const checks = [
  [products.length === 300, '300 hàng hóa'],
  [data.productGroups.length === 10, '10 nhóm hàng'],
  [
    P(12).name === 'Bia lager lon 330ml' &&
      P(12).price === 18000 &&
      unitPrice(12, 1) === 105000 &&
      unitPrice(12, 2) === 410000 &&
      P(12).cost === 15500,
    'SP00012 Bia lager lon 18.000 / Lốc 6 105.000 / Thùng 24 410.000, vốn 15.500',
  ],
  [
    P(12).barcode === '8939010001214' &&
      P(12).units[0].barcode === '8939010001221' &&
      P(12).units[1].barcode === '8939010001238',
    'mã vạch Bia lager',
  ],
  [
    P(31).price === 4500 &&
      unitPrice(31, 1) === 120000 &&
      P(31).cost === 3600 &&
      P(31).units[0].factor === 30,
    'SP00031 Mì gói 4.500 / Thùng 30 120.000, vốn 3.600',
  ],
  [
    P(45).price === 8000 &&
      unitPrice(45, 1) === 31000 &&
      unitPrice(45, 2) === 360000 &&
      P(45).cost === 6500 &&
      P(45).trackExpiry,
    'SP00045 Sữa tươi 8.000 / 31.000 / 360.000, vốn 6.500, có HSD',
  ],
  [
    P(58).price === 5000 &&
      unitPrice(58, 1) === 96000 &&
      P(58).cost === 3500 &&
      P(58).minStock === 12,
    'SP00058 Nước suối 5.000 / 96.000, vốn 3.500',
  ],
  [P(77).price === 455000 && P(77).cost === 440000, 'SP00077 Sữa bột 455.000, vốn 440.000'],
  [
    P(102).barcode === '2000000000015' &&
      P(102).price === 32000 &&
      P(102).cost === 27000 &&
      !P(102).returnable,
    'SP00102 Trứng gà mã nội bộ, không đổi trả',
  ],
  [P(48).name.startsWith('Sữa chua có đường') && P(48).trackExpiry, 'SP00048 Sữa chua có HSD'],
  [
    products.every((p) => p.price % 500 === 0 && p.units.every((u) => u.price % 500 === 0)),
    'giá bội số 500',
  ],
]
const failed = checks.filter(([ok]) => !ok)
if (failed.length) {
  console.error(
    'Dữ liệu viết tay chưa đạt ràng buộc:\n' + failed.map(([, m]) => ' - ' + m).join('\n')
  )
  process.exit(1)
}

// ---------------------------------------------------------------- Tham số
const FIRST_DAY = -89 // 90 ngày: -89 … 0 (0 là hôm nay)
const TEST = new Set([12, 31, 45, 48, 58, 77, 102])
const ICE = products.findIndex((p) => p.name.startsWith('Đá viên')) + 1
const weekPattern = [1.0, 0.92, 0.95, 0.97, 1.05, 1.22, 1.25] // theo vị trí ngày trong chu kỳ 7 ngày tính từ hôm nay
const hourWeights = {
  6: 0.9,
  7: 1.2,
  8: 0.9,
  9: 0.6,
  10: 0.6,
  11: 0.8,
  12: 0.7,
  13: 0.5,
  14: 0.5,
  15: 0.6,
  16: 0.9,
  17: 1.7,
  18: 2.0,
  19: 1.9,
  20: 1.4,
  21: 0.8,
}
const groupWeight = {
  BIA: 1.6,
  MI: 1.4,
  SUA: 1.3,
  BANH: 1.1,
  GIAVI: 0.7,
  KHO: 0.6,
  TUOI: 1.2,
  THIT: 0.8,
  GIAT: 0.5,
  CANHAN: 0.5,
}
const prodWeight = products.map((p, i) => {
  const no = i + 1
  let w = groupWeight[p.group] * (p.price > 150000 ? 0.25 : p.price > 60000 ? 0.6 : 1)
  if (no === 12 || no === 31) w = 2.2
  if (no === 45) w = 1.6
  if (no === 58) w = 1.4
  if (no === 77) w = 0.35
  if (no === 102) w = 1.0
  if (no === ICE) w = 0.6
  return w
})

// ---------------------------------------------------------------- Ca
const shifts = []
const shiftOf = new Map()
for (let d = FIRST_DAY; d <= 0; d++) {
  const week = Math.floor((d - FIRST_DAY) / 7)
  const morning = d === 0 ? 'thungan2' : week % 2 === 0 ? 'thungan' : 'thungan2'
  const evening = d === 0 ? 'thungan2' : morning === 'thungan' ? 'thungan2' : 'thungan'
  for (const [k, c, o, x] of [
    [1, morning, 6 * 60 + randInt(0, 4), 14 * 60 + randInt(2, 8)],
    [2, evening, 14 * 60 + randInt(0, 4), 22 * 60 + randInt(2, 8)],
  ]) {
    const s = { d, k, c, o: hhmm(o), x: hhmm(x), oc: rand() < 0.15 ? 1000000 : 500000, df: 0 }
    shifts.push(s)
    shiftOf.set(`${d}/${k}`, s)
  }
}

// ---------------------------------------------------------------- Hóa đơn
const orders = []
const fixedOrders = {
  A: {
    d: -2,
    t: '10:15',
    k: 1,
    pm: 'TienMat',
    cash: 510000,
    it: [
      [12, 2, 1],
      [31, 1, 1],
    ],
    dc: { ty: 'PhanTram', v: 5, r: 'KhachQuen' },
    n: 'HĐ mẫu A',
  },
  B: {
    d: -1,
    t: '17:40',
    k: 2,
    pm: 'TienMat',
    cash: 200000,
    it: [
      [45, 1, 2],
      [45, 0, 4],
      [102, 0, 1],
    ],
    n: 'HĐ mẫu B',
  },
  C: { d: -10, t: '18:05', k: 2, pm: 'ChuyenKhoan', it: [[12, 1, 1]], n: 'HĐ mẫu C' },
  D: { d: -35, t: '09:20', k: 1, pm: 'TienMat', cash: 200000, it: [[31, 1, 1]], n: 'HĐ mẫu D' },
  E: { d: -3, t: '19:10', k: 2, pm: 'ChuyenKhoan', it: [[12, 2, 2]], n: 'HĐ mẫu E' },
}
const STATE_LOW = new Set()
const STATE_OUT = new Set()
// Hàng ở trạng thái đặc biệt cuối hôm qua (chọn trước để không bán hôm nay)
{
  const candidates = products
    .map((p, i) => i + 1)
    .filter(
      (no) =>
        !TEST.has(no) && no !== ICE && products[no - 1].active && !products[no - 1].trackExpiry
    )
  while (STATE_LOW.size < 9) STATE_LOW.add(pick(candidates))
  while (STATE_OUT.size < 3) {
    const no = pick(candidates)
    if (!STATE_LOW.has(no)) STATE_OUT.add(no)
  }
}
const custPhones = data.customers.map((c) => c.phone)
const reasonsDc = ['KhachQuen', 'KhachQuen', 'KhachQuen', 'HangMopMeo', 'CanHanSuDung']

function randomBasket(d) {
  const lineCount = weighted([
    [1, 26],
    [2, 26],
    [3, 20],
    [4, 13],
    [5, 8],
    [6, 5],
    [8, 2],
  ])
  const used = new Set()
  const it = []
  for (let i = 0; i < lineCount; i++) {
    let no
    for (let tries = 0; tries < 20; tries++) {
      no = weighted(prodWeight.map((w, idx) => [idx + 1, w]))
      const p = P(no)
      if (used.has(no)) continue
      if (!p.active && d > -30) continue
      if (d === 0 && (TEST.has(no) || STATE_LOW.has(no) || STATE_OUT.has(no) || no === ICE))
        continue
      break
    }
    if (used.has(no)) continue
    used.add(no)
    const p = P(no)
    let u = 0
    if (p.units.length && rand() < 0.14) u = p.units[0].factor <= 12 || rand() < 0.3 ? 1 : 1
    if (u === 1 && p.units.length > 1 && rand() < 0.2) u = 2
    if (u > 0 && unitOf(p, u).factor > 30 && rand() < 0.7) u = 0
    const q =
      u > 0
        ? 1
        : p.group === 'MI' || p.group === 'BIA'
          ? weighted([
              [1, 40],
              [2, 25],
              [3, 15],
              [4, 8],
              [6, 7],
              [10, 5],
            ])
          : weighted([
              [1, 70],
              [2, 22],
              [3, 8],
            ])
    it.push([no, u, q])
  }
  return it.length ? it : [[31, 0, 1]]
}

function payFor(total) {
  const pm = weighted([
    ['TienMat', 60],
    ['ChuyenKhoan', 30],
    ['The', 10],
  ])
  if (pm !== 'TienMat') return { pm }
  const sug = cashSuggestions(total)
  const cash = weighted(sug.map((v, i) => [v, i === 0 ? 30 : i === 1 ? 35 : i === 2 ? 25 : 10]))
  return { pm, cash }
}

let lineDiscounted = 0
let orderDiscounted = 0
for (let d = FIRST_DAY; d <= 0; d++) {
  const pos = ((-d % 7) + 7) % 7
  const trend = 1 + 0.12 * ((d - FIRST_DAY) / 89)
  const count = Math.round(50 * weekPattern[pos] * trend * (0.9 + rand() * 0.2))
  const times = []
  for (let i = 0; i < count; i++) {
    const h = Number(weighted(Object.entries(hourWeights).map(([hh, w]) => [hh, w])))
    times.push(h * 60 + randInt(0, 59))
  }
  times.sort((a, b) => a - b)
  for (const m of times) {
    const k = m < 14 * 60 ? 1 : 2
    const o = { d, t: hhmm(m), k, it: randomBasket(d) }
    let pr = priceOrder(o)
    const r = rand()
    if (r < 0.003) {
      // giảm giá dòng hàng móp, cận hạn
      const li = randInt(0, o.it.length - 1)
      o.it[li].push({
        ty: 'PhanTram',
        v: pick([10, 15, 20]),
        r: pick(['HangMopMeo', 'CanHanSuDung']),
      })
      lineDiscounted++
    } else if (r < 0.065) {
      const fixedOk = [1000, 2000, 5000, 10000].filter((v) => v * 20 <= pr.subtotal)
      o.dc =
        rand() < 0.5 || !fixedOk.length
          ? { ty: 'PhanTram', v: pick([2, 3, 5]), r: pick(reasonsDc) }
          : { ty: 'SoTien', v: pick(fixedOk), r: pick(reasonsDc) }
      orderDiscounted++
    } else if (r < 0.07) {
      o.dc = { ty: 'PhanTram', v: pick([8, 10]), r: 'KhachQuen' }
      orderDiscounted++
    }
    pr = priceOrder(o)
    const discountTotal = pr.lineDiscountTotal + pr.orderDiscount
    if (discountTotal > 0) {
      if (pr.total < pr.costTotal) {
        // bỏ giảm giá làm bán dưới giá vốn
        delete o.dc
        o.it.forEach((l) => (l.length = 3))
        pr = priceOrder(o)
      } else if (discountTotal * 100 > pr.subtotal * 5) {
        o.by = 'quanly'
      }
    }
    if (rand() < 0.12) o.cu = pick(custPhones)
    Object.assign(o, payFor(pr.total))
    orders.push(o)
  }
}
// Chèn hóa đơn mẫu A–E đúng chỗ theo thời gian
for (const fo of Object.values(fixedOrders)) {
  const idx = orders.findIndex((o) => o.d > fo.d || (o.d === fo.d && toMin(o.t) > toMin(fo.t)))
  orders.splice(idx, 0, fo)
}

// ---------------------------------------------------------------- Đổi trả (~80) và hóa đơn đổi hàng
// Giữ tham chiếu đối tượng; chỉ số mảng gán lúc ghi file.
const returns = []
const fixedSet = new Set(Object.values(fixedOrders))
const returnReasons = [
  ['KhachDoiY', 35],
  ['MuaNham', 25],
  ['LoiNhaSanXuat', 20],
  ['HetHan', 10],
  ['Khac', 10],
]
const returnedOrders = new Set()
const refundOf = (o, li, q) => {
  const pr = priceOrder(o)
  const l = o.it[li]
  return q === l[2] ? pr.lines[li].net : floor500((pr.lines[li].net * q) / l[2])
}
let guard = 0
while (returns.length < 80 && guard++ < 20000) {
  const o = orders[randInt(0, orders.length - 1)]
  if (o.d > -2 || o.d < -85 || fixedSet.has(o) || returnedOrders.has(o)) continue
  const lines = o.it
    .map((l, i) => [l, i])
    .filter(([l]) => P(l[0]).returnable && !TEST.has(l[0]) && l[0] !== ICE)
  if (!lines.length) continue
  const late = rand() < 0.12
  const dd = Math.min(-1, o.d + (late ? randInt(8, 14) : randInt(0, 6)))
  const m = randInt(7 * 60, 21 * 60 + 30)
  if (dd === o.d && m <= toMin(o.t) + 10) continue
  const [l, li] = pick(lines)
  const q = randInt(1, l[2])
  const reason = weighted(returnReasons)
  const cond =
    (reason === 'LoiNhaSanXuat' || reason === 'HetHan') && rand() < 0.85 ? 'HangLoi' : 'BanLaiDuoc'
  const rt = {
    d: dd,
    t: hhmm(m),
    k: m < 14 * 60 ? 1 : 2,
    src: o,
    li: [[li, q, cond, reason]],
    rm: rand() < 0.8 ? 'TienMat' : 'ChuyenKhoan',
  }
  if (reason === 'Khac') rt.n = pick(['Khách mua dư', 'Bao bì rách', 'Khách tặng lại không dùng'])
  rt.refund = refundOf(o, li, q)
  if (dd - o.d > 7 || rt.refund > 500000) rt.by = 'quanly'
  returnedOrders.add(o)
  returns.push(rt)
}
returns.sort((a, b) => a.d - b.d || toMin(a.t) - toMin(b.t))
// 15 phiếu có hàng đổi (BR-20): hóa đơn đổi cùng thời điểm, bù trừ tiền hoàn
let exchangeCount = 0
for (const rt of returns) {
  if (exchangeCount >= 15 || rand() > 0.22) continue
  const it = []
  const n = randInt(1, 2)
  let g2 = 0
  while (it.length < n && g2++ < 100) {
    const no = weighted(prodWeight.map((w, idx) => [idx + 1, w]))
    if (TEST.has(no) || no === ICE || !P(no).active || it.some((x) => x[0] === no)) continue
    it.push([no, 0, randInt(1, 2)])
  }
  const xo = { d: rt.d, t: rt.t, k: rt.k, it, rxRef: rt }
  const X = priceOrder(xo).total
  if (X > rt.refund) Object.assign(xo, payFor(X - rt.refund))
  rt.xRef = xo
  exchangeCount++
  const idx = orders.findIndex((o) => o.d > xo.d || (o.d === xo.d && toMin(o.t) > toMin(xo.t)))
  orders.splice(idx === -1 ? orders.length : idx, 0, xo)
}

// ---------------------------------------------------------------- Phiếu điều chỉnh tồn (12)
const adjustments = []
{
  const plan = [
    ['Hong', 4],
    ['HetHan', 3],
    ['Mat', 2],
    ['DemLai', 3],
  ]
  const usable = products
    .map((p, i) => i + 1)
    .filter(
      (no) =>
        !TEST.has(no) && no !== ICE && P(no).active && !STATE_LOW.has(no) && !STATE_OUT.has(no)
    )
  for (const [r, n] of plan) {
    for (let i = 0; i < n; i++) {
      const pool = r === 'HetHan' ? usable.filter((no) => P(no).trackExpiry) : usable
      const no = pick(pool)
      const diff =
        r === 'Hong'
          ? -randInt(1, 2)
          : r === 'HetHan'
            ? -randInt(2, 6)
            : r === 'Mat'
              ? -1
              : pick([-2, -1, 1, 2])
      const a = {
        d: -randInt(3, 85),
        t: hhmm(randInt(21 * 60 + 40, 21 * 60 + 55)),
        r,
        li: [[no, diff]],
      }
      if (r === 'Hong')
        a.n = pick(['Móp méo khi trưng bày', 'Rơi vỡ khi xếp kệ', 'Chuột cắn bao bì'])
      if (r === 'HetHan') a.n = 'Hủy hàng quá hạn sử dụng'
      if (r === 'Mat') a.n = 'Kiểm kệ cuối ngày thiếu'
      if (r === 'DemLai') a.n = 'Đếm lại kệ trưng bày'
      adjustments.push(a)
    }
  }
  adjustments.sort((a, b) => a.d - b.d || toMin(a.t) - toMin(b.t))
}

// ---------------------------------------------------------------- Chênh lệch ca, kiểm tra ca
{
  const closed = shifts.filter((s) => s.d < 0)
  for (const s of closed) {
    const r = rand()
    if (r < 0.26) s.df = randInt(-30, 30) * 500
    if (s.df && Math.abs(s.df) <= 20000 && rand() < 0.4)
      s.n = pick(['Thối nhầm tiền lẻ', 'Khách gửi lại tiền thừa', 'Đếm lại vẫn lệch ít'])
  }
  const big = [
    [
      -60,
      2,
      -35000,
      'Thiếu tiền, nghi thối nhầm tờ 50.000',
      'Đã trừ lương ca, nhắc kiểm tiền khi thối',
    ],
    [
      -47,
      1,
      42000,
      'Thừa tiền, có thể khách quên lấy tiền thối',
      'Giữ lại tiền thừa, ghi sổ chờ khách quay lại',
    ],
    [
      -33,
      2,
      -50000,
      'Thiếu tiền, chưa rõ nguyên nhân',
      'Xem lại camera, thu ngân nhầm hoàn tiền mặt cho phiếu chuyển khoản',
    ],
    [-19, 1, -28000, 'Thiếu tiền lẻ', 'Đã bổ sung tiền lẻ, nhắc đổi tiền đầu ca'],
    [
      -12,
      2,
      30000,
      'Thừa tiền',
      'Một hóa đơn chuyển khoản khách trả tiền mặt, thu ngân bấm nhầm phương thức',
    ],
    [-3, 2, -45000, 'Thiếu tiền sau giờ cao điểm, đã đếm lại 2 lần', null],
  ]
  for (const [d, k, df, n, rv] of big) {
    const s = shiftOf.get(`${d}/${k}`)
    s.df = df
    s.n = n
    if (rv) s.rv = { n: rv, by: 'quanly' }
  }
}

// ---------------------------------------------------------------- Phiếu nhập: dựng ngược từ tồn cuối hôm qua
const supplierDates = {
  NCC001: [-72, -58, -44, -30, -16, -4],
  NCC002: [-88, -70, -52, -34, -19, -6],
  NCC003: [-82, -68, -54, -40, -24, -10],
  NCC004: [-84, -63, -42, -21, -7],
  NCC005: [-80, -66, -52, -38, -24, -12, -3],
  NCC006: [-78, -57, -36, -15, -2],
  NCC007: [-75, -45, -14],
}
const supplierOfGroup = {}
for (const s of data.suppliers) for (const g of s.groups) supplierOfGroup[g] = s.code
const receiptSlots = []
for (const [sup, days] of Object.entries(supplierDates)) {
  for (const d of days)
    receiptSlots.push({
      d,
      t: hhmm(randInt(7 * 60 + 20, 9 * 60 + 10)),
      s: sup,
      st: 'DaNhapKho',
      li: [],
    })
}
receiptSlots.sort((a, b) => a.d - b.d || toMin(a.t) - toMin(b.t))
const shelfLife = (p) =>
  ({
    'hop-giay': 180,
    'hop-sua-chua': 40,
    'chai-nhua': 45,
    'lon-sua-bot': 540,
    'hop-banh': 150,
    'banh-mi': 25,
    'goi-keo': 120,
    'hop-thiec': 720,
    'tui-dong-lanh': 120,
  })[p.image] ?? 180
const fixedLots = {
  45: [
    [-40, 96, 20],
    [-10, 96, 150],
  ],
  48: [
    [-40, 48, -2],
    [-10, 48, 28],
  ],
}
const targets = { 12: 50, 31: 90, 45: 120, 48: 60, 58: 24, 77: 6, 102: 2 }
targets[ICE] = -3

// sự kiện theo hàng hóa (trước hôm nay)
const events = products.map(() => [])
orders.forEach((o, i) => {
  if (o.d > -1) return
  for (const l of o.it)
    events[l[0] - 1].push({
      d: o.d,
      m: toMin(o.t),
      rank: 1,
      idx: i,
      delta: -l[2] * unitOf(P(l[0]), l[1]).factor,
    })
})
returns.forEach((rt, i) => {
  for (const [li, q, cond] of rt.li) {
    if (cond !== 'BanLaiDuoc') continue
    const l = rt.src.it[li]
    events[l[0] - 1].push({
      d: rt.d,
      m: toMin(rt.t),
      rank: 2,
      idx: i,
      delta: q * unitOf(P(l[0]), l[1]).factor,
    })
  }
})
adjustments.forEach((a, i) => {
  for (const [no, diff] of a.li)
    events[no - 1].push({ d: a.d, m: toMin(a.t), rank: 3, idx: i, delta: diff })
})
const salesPerDay = products.map(
  (_, i) => -events[i].filter((e) => e.rank === 1).reduce((s, e) => s + e.delta, 0) / 89
)

for (let i = 0; i < products.length; i++) {
  const no = i + 1
  const p = P(no)
  const min = p.minStock
  const shortShelf = p.trackExpiry && shelfLife(p) < 100
  const f = shortShelf
    ? (p.units.find((u) => u.factor <= 6)?.factor ?? 1)
    : ([...p.units].reverse().find((u) => u.factor <= 30)?.factor ?? 1)
  let T
  if (targets[no] !== undefined) T = targets[no]
  else if (STATE_OUT.has(no)) T = 0
  else if (STATE_LOW.has(no)) T = randInt(1, min)
  else if (!p.active) T = 0
  else T = min + randInt(Math.ceil(min / 2), 2 * min) + Math.ceil(salesPerDay[i] * 4)
  const sup = supplierOfGroup[p.group]
  const fixed = fixedLots[no]
  const slots = no === ICE || !sup ? [] : receiptSlots.filter((r) => r.s === sup)
  const timeline = [
    ...events[i].map((e) => ({ ...e, kind: 'E', orig: e })),
    ...slots.map((r) => ({
      d: r.d,
      m: toMin(r.t),
      rank: 0,
      idx: receiptSlots.indexOf(r),
      kind: 'R',
      r,
    })),
  ].sort((a, b) => a.d - b.d || a.m - b.m || a.rank - b.rank || a.idx - b.idx)
  let cur = T
  const low = shortShelf ? 0 : randInt(Math.max(1, Math.ceil(min * 0.3)), Math.max(1, min))
  // hàng ngừng bán: không nhập trong 30 ngày cuối
  for (let j = timeline.length - 1; j >= 0; j--) {
    const ev = timeline[j]
    if (ev.kind === 'E') {
      cur -= ev.delta
      if (cur < 0 && no !== ICE && ev.rank === 2) {
        // trả hàng ngay lúc tồn đang 0: đổi dòng trả thành hàng lỗi (không cộng tồn)
        cur += ev.delta
        for (const l of returns[ev.idx].li)
          if (returns[ev.idx].src.it[l[0]][0] === no) l[2] = 'HangLoi'
        events[i].splice(events[i].indexOf(timeline[j].orig), 1)
      } else if (cur < 0 && no !== ICE && ev.rank === 3) {
        // điều chỉnh tăng lúc tồn thấp: đổi thành điều chỉnh giảm
        cur += 2 * ev.delta
        timeline[j].orig.delta = -ev.delta
        for (const l of adjustments[ev.idx].li) if (l[0] === no) l[1] = -l[1]
      }
      if (cur < 0 && no !== ICE)
        throw new Error(`Tồn âm khi dựng ngược ${p.code} (${p.name}) tại ngày ${ev.d}`)
      continue
    }
    let q = 0
    let e
    if (fixed) {
      const fx = fixed.find(([fd]) => fd === ev.d)
      if (fx) {
        q = fx[1]
        e = fx[2]
      } else if (ev.d > fixed[0][0]) q = 0
      else q = Math.max(0, Math.floor((cur - low) / f) * f)
    } else if (!p.active && ev.d > -40) q = 0
    else q = Math.max(0, Math.floor((cur - low) / f) * f)
    if (q > 0) {
      if (cur - q < 0) throw new Error(`Lô cố định làm tồn âm ${p.code}`)
      cur -= q
      const u = f === 1 ? 0 : p.units.findIndex((x) => x.factor === f) + 1
      const line = [no, u, q / f]
      if (p.trackExpiry) {
        line.push(null)
        line.push(e ?? ev.d + shelfLife(p))
      }
      ev.r.li.unshift(line)
    }
  }
  p.openingStock = cur
  p.stock = T
}
// sắp dòng phiếu nhập theo mã hàng; phiếu không có dòng thì bỏ
for (const r of receiptSlots) r.li.sort((a, b) => a[0] - b[0])
let receipts = receiptSlots.filter((r) => r.li.length)
// 2 phiếu nháp (không ảnh hưởng tồn)
receipts.push({
  d: -2,
  t: '16:20',
  s: 'NCC007',
  st: 'Nhap',
  n: 'Chờ nhà cung cấp giao đủ hàng',
  li: [
    [products.findIndex((p) => p.name.startsWith('Nước rửa chén hương chanh')) + 1, 1, 2],
    [products.findIndex((p) => p.name.startsWith('Giấy vệ sinh lốc')) + 1, 0, 10],
  ],
})
receipts.push({
  d: -1,
  t: '20:45',
  s: 'NCC002',
  st: 'Nhap',
  n: 'Đơn đặt cho tuần sau',
  li: [
    [products.findIndex((p) => p.name.startsWith('Hạt nêm thịt heo')) + 1, 1, 1],
    [products.findIndex((p) => p.name.startsWith('Đường trắng')) + 1, 0, 20],
    [products.findIndex((p) => p.name.startsWith('Gạo thơm')) + 1, 0, 10],
  ],
})
receipts.sort((a, b) => a.d - b.d || toMin(a.t) - toMin(b.t))
for (const r of receipts)
  for (const l of r.li) while (l.length > 3 && l[l.length - 1] === null) l.pop()

// ---------------------------------------------------------------- Kiểm tra xuôi: tồn không âm, lô sắp hết hạn
{
  const fwd = products.map((p) => p.openingStock)
  const all = []
  receipts
    .filter((r) => r.st === 'DaNhapKho')
    .forEach((r, i) =>
      r.li.forEach((l) =>
        all.push({
          d: r.d,
          m: toMin(r.t),
          rank: 0,
          idx: i,
          no: l[0],
          delta: l[2] * unitOf(P(l[0]), l[1]).factor,
        })
      )
    )
  for (let i = 0; i < products.length; i++) for (const e of events[i]) all.push({ ...e, no: i + 1 })
  all.sort((a, b) => a.d - b.d || a.m - b.m || a.rank - b.rank || a.idx - b.idx)
  for (const e of all) {
    fwd[e.no - 1] += e.delta
    if (fwd[e.no - 1] < 0 && e.no !== ICE)
      throw new Error(`Tồn âm khi chạy xuôi ${P(e.no).code} ngày ${e.d}`)
  }
  products.forEach((p, i) => {
    if (fwd[i] !== p.stock) throw new Error(`Lệch tồn ${p.code}: ${fwd[i]} ≠ ${p.stock}`)
  })
}

// ---------------------------------------------------------------- Hôm nay không bán vượt tồn cuối hôm qua (docs/06 §5.3)
// Dòng hôm nay vượt phần tồn còn lại thì đổi về 1 đơn vị cơ bản (giữ số dòng, không gọi thêm rand() để
// lịch sử trước hôm nay không đổi); hóa đơn tiền mặt có tiền khách đưa nhỏ hơn tổng mới thì đưa đúng tổng.
{
  const left = products.map((p) => p.stock)
  let fixedLines = 0
  for (const o of orders.filter((x) => x.d === 0)) {
    for (const l of o.it) {
      const need = l[2] * unitOf(P(l[0]), l[1]).factor
      if (need > left[l[0] - 1]) {
        l[1] = 0
        l[2] = 1
        l.length = Math.min(l.length, 3)
        fixedLines++
      }
      left[l[0] - 1] -= l[2] * unitOf(P(l[0]), l[1]).factor
      if (left[l[0] - 1] < 0) throw new Error(`Hôm nay bán vượt tồn ${P(l[0]).code}`)
    }
    if (o.pm === 'TienMat' && o.cash < priceOrder(o).total) o.cash = priceOrder(o).total
  }
  if (fixedLines) console.log(`Hôm nay: ${fixedLines} dòng đổi về đơn vị cơ bản để không vượt tồn`)
}

// ---------------------------------------------------------------- Ghi file
orders.sort((a, b) => a.d - b.d || toMin(a.t) - toMin(b.t))
const orderIndex = new Map(orders.map((o, i) => [o, i]))
const returnIndex = new Map(returns.map((r, i) => [r, i]))
const ordersOut = orders.map((o) => {
  const out = { d: o.d, t: o.t, k: o.k }
  if (o.pm) out.pm = o.pm
  if (o.cash) out.cash = o.cash
  out.it = o.it
  for (const key of ['dc', 'by', 'cu', 'n']) if (o[key] !== undefined) out[key] = o[key]
  if (o.rxRef) out.rx = returnIndex.get(o.rxRef)
  return out
})
const returnsOut = returns.map((r) => {
  const out = { d: r.d, t: r.t, k: r.k, o: orderIndex.get(r.src), li: r.li, rm: r.rm }
  if (r.xRef) out.x = orderIndex.get(r.xRef)
  if (r.by) out.by = r.by
  if (r.n) out.n = r.n
  return out
})
const productsOut = products.map((p) => {
  const { openingStock, stock, ...rest } = p
  return { ...rest, openingStock, stock }
})
const result = {
  $comment: data.$comment,
  productGroups: data.productGroups,
  products: productsOut,
  suppliers: data.suppliers,
  customers: data.customers,
  receipts,
  adjustments,
  shifts,
  orders: ordersOut,
  returns: returnsOut,
}
const lines = ['{']
const keys = Object.keys(result)
keys.forEach((key, ki) => {
  const v = result[key]
  const tail = ki === keys.length - 1 ? '' : ','
  if (Array.isArray(v)) {
    lines.push(`  ${JSON.stringify(key)}: [`)
    v.forEach((item, i) =>
      lines.push('    ' + JSON.stringify(item) + (i === v.length - 1 ? '' : ','))
    )
    lines.push('  ]' + tail)
  } else lines.push(`  ${JSON.stringify(key)}: ${JSON.stringify(v)}${tail}`)
})
lines.push('}')
writeFileSync(file, lines.join('\n') + '\n')

// ---------------------------------------------------------------- Số đối chiếu (ghi vào docs/06 §5.5)
const hist = orders.filter((o) => o.d < 0)
const today = orders.filter((o) => o.d === 0)
const sum = (arr, f) => arr.reduce((s, x) => s + f(x), 0)
const histTotal = sum(hist, (o) => priceOrder(o).total)
const histCost = sum(hist, (o) => priceOrder(o).costTotal)
const refundTotal = sum(returns, (r) => r.refund)
const status = { AmKho: 0, HetHang: 0, SapHet: 0, ConHang: 0 }
for (const p of products) {
  if (!p.active) continue
  status[
    p.stock < 0 ? 'AmKho' : p.stock === 0 ? 'HetHang' : p.stock <= p.minStock ? 'SapHet' : 'ConHang'
  ]++
}
// lô theo BR-27 (tồn cuối hôm qua, chưa trừ bán hôm nay)
let near = 0
let expired = 0
const nearList = []
for (let i = 0; i < products.length; i++) {
  const p = products[i]
  if (!p.trackExpiry || p.stock <= 0) continue
  const lots = receipts
    .filter((r) => r.st === 'DaNhapKho')
    .flatMap((r) =>
      r.li
        .filter((l) => l[0] === i + 1)
        .map((l) => ({ d: r.d, t: r.t, qty: l[2] * unitOf(p, l[1]).factor, e: l[4] }))
    )
    .sort((a, b) => b.d - a.d || toMin(b.t) - toMin(a.t))
  let left = p.stock
  for (const lot of lots) {
    const take = Math.min(left, lot.qty)
    left -= take
    if (take > 0 && lot.e < 0) {
      expired++
      nearList.push(`${p.code} còn ${take} hết hạn ${lot.e}`)
    } else if (take > 0 && lot.e <= 30) {
      near++
      nearList.push(`${p.code} còn ${take} hạn +${lot.e}`)
    }
  }
}
const vnd = (n) => n.toLocaleString('vi-VN')
console.log(`Hạt giống ${SEED}`)
console.log(
  `Hóa đơn: ${orders.length} (trước hôm nay ${hist.length}, hôm nay cả ngày ${today.length}), hóa đơn đổi hàng ${exchangeCount}`
)
console.log(`Dòng hóa đơn: ${sum(orders, (o) => o.it.length)}`)
console.log(
  `Giảm giá: hóa đơn ${orderDiscounted}, dòng ${lineDiscounted}, vượt hạn mức có quanly ${orders.filter((o) => o.by).length}`
)
console.log(`Tổng thanh toán trước hôm nay: ${vnd(histTotal)} ₫; giá vốn dòng: ${vnd(histCost)} ₫`)
console.log(`Tổng thanh toán hôm nay cả ngày: ${vnd(sum(today, (o) => priceOrder(o).total))} ₫`)
console.log(
  `Phiếu đổi trả: ${returns.length} (hàng lỗi ${returns.filter((r) => r.li[0][2] === 'HangLoi').length}, cần xác nhận ${returns.filter((r) => r.by).length}), tổng tiền hoàn ${vnd(refundTotal)} ₫`
)
console.log(
  `Phiếu nhập: ${receipts.length} (đã nhập kho ${receipts.filter((r) => r.st === 'DaNhapKho').length}, nháp ${receipts.filter((r) => r.st === 'Nhap').length}), dòng ${sum(receipts, (r) => r.li.length)}`
)
console.log(`Phiếu điều chỉnh: ${adjustments.length}`)
console.log(
  `Ca: ${shifts.length}; cần kiểm tra ${shifts.filter((s) => Math.abs(s.df) > 20000).length} (đã xử lý ${shifts.filter((s) => s.rv).length})`
)
console.log(`Trạng thái tồn hàng đang bán (cuối hôm qua): ${JSON.stringify(status)}`)
console.log(`Lô sắp hết hạn ${near}, đã hết hạn ${expired}: ${nearList.join('; ')}`)
console.log(
  `Hóa đơn mẫu: ${Object.entries(fixedOrders)
    .map(([k, o]) => `${k}=#${orderIndex.get(o)} ${vnd(priceOrder(o).total)}`)
    .join(', ')}`
)
console.log(
  `Tổng tồn đầu kỳ ${vnd(sum(products, (p) => p.openingStock))}, giá trị tồn cuối hôm qua ${vnd(sum(products, (p) => p.stock * p.cost))} ₫`
)
console.log(`Kích thước file: ${Math.round(readFileSync(file).length / 1024)} KB`)
