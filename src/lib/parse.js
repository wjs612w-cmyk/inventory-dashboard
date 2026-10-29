import Papa from 'papaparse'
import { CSV_SOURCES, COLUMNS } from '../config'

const norm = (s) => String(s ?? '').replace(/\s+/g, '')

// "1,234" → 1234, "99.28%" → 99.28, 빈 값 → null
export const toNum = (v) => {
  if (v == null) return null
  let s = String(v).replace(/[,%\s]/g, '')
  if (s === '') return null
  const neg = /^\(.*\)$/.test(s) // (1,234) 처럼 괄호로 쓴 음수
  if (neg) s = s.slice(1, -1)
  const n = Number(s)
  return Number.isFinite(n) ? (neg ? -n : n) : null
}

function download(url) {
  return new Promise((resolve, reject) => {
    Papa.parse(url, {
      download: true,
      header: false, // 1행에 제목/경과일이 있어 헤더 행 위치를 직접 찾음
      skipEmptyLines: 'greedy',
      complete: (res) => resolve(res.data),
      error: (err) => reject(err),
    })
  })
}

function parseRows(rows) {
  const hi = rows.findIndex((r) => r.map(norm).includes(norm(COLUMNS.category)) && r.map(norm).includes(norm(COLUMNS.name)))
  if (hi < 0) throw new Error(`헤더 행을 찾지 못했습니다 (‘${COLUMNS.category}’, ‘${COLUMNS.name}’ 열 필요)`)

  // 헤더 위쪽 행에 있는 1~31 사이의 숫자 = 시트가 쓰는 "경과일수" (예: K1 = 27)
  let elapsedDays = null
  for (const r of rows.slice(0, hi)) {
    for (const cell of r) {
      const n = toNum(cell)
      if (n != null && Number.isInteger(n) && n >= 1 && n <= 31) elapsedDays = n
    }
  }

  const header = rows[hi].map(norm)
  const idx = {}
  const missing = []
  const OPTIONAL = new Set(['prev2Shipped', 'sub']) // 없어도 동작하는 열
  for (const [key, title] of Object.entries(COLUMNS)) {
    const i = header.indexOf(norm(title))
    if (i < 0 && !OPTIONAL.has(key)) missing.push(title)
    idx[key] = i
  }
  if (missing.length) throw new Error(`시트에서 찾지 못한 열: ${missing.join(', ')}`)

  const str = (r, k) => String(r[idx[k]] ?? '').trim()
  const num = (r, k) => toNum(r[idx[k]])
  const n0 = (r, k) => num(r, k) ?? 0

  const items = []
  rows.slice(hi + 1).forEach((r, i) => {
    const category = str(r, 'category')
    const name = str(r, 'name')
    if (!category || !name || /합계|소계|총계/.test(name)) return // 합계 행·빈 행 제외

    const salesPlan = n0(r, 'salesPlan')
    const prodPlan = n0(r, 'prodPlan')
    const shipped = n0(r, 'shipped')
    const inbound = n0(r, 'inbound')
    const sheetForecast = n0(r, 'sheetForecast')

    items.push({
      id: `${i}-${str(r, 'sku')}`,
      category,
      brand: str(r, 'brand') || '(브랜드 없음)',
      group: str(r, 'group') || '(미분류)',
      sub: idx.sub >= 0 ? str(r, 'sub') || '(미분류)' : null,
      sku: str(r, 'sku'),
      name,
      salesPlan,
      nextSalesPlan: n0(r, 'nextSalesPlan'),
      sheetProgress: num(r, 'sheetProgress'),
      sheetForecast,
      prevShipped: n0(r, 'prevShipped'),
      prev2Shipped: idx.prev2Shipped >= 0 ? n0(r, 'prev2Shipped') : null,
      shipped,
      prodPlan,
      nextProdPlan: n0(r, 'nextProdPlan'),
      inbound,
      stock: n0(r, 'stock'),
      // 계획이 있는 품목만 진도율·입고율 집계에 포함하기 위한 보조 값
      planShipped: salesPlan > 0 ? shipped : 0,
      planForecast: salesPlan > 0 ? sheetForecast : 0,
      planInbound: prodPlan > 0 ? inbound : 0,
      // 과거 → 최근
      weekly: [n0(r, 'w4'), n0(r, 'w3'), n0(r, 'w2'), n0(r, 'w1')],
    })
  })

  return { items, elapsedDays }
}

export async function loadAll() {
  const results = await Promise.allSettled(CSV_SOURCES.map(async (s) => parseRows(await download(s.url))))
  const items = []
  const errors = []
  let elapsedDays = null
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      items.push(...r.value.items)
      elapsedDays = r.value.elapsedDays ?? elapsedDays
    } else {
      errors.push(`${CSV_SOURCES[i].name}: ${r.reason?.message || '불러오기 실패'}`)
    }
  })
  return { items, errors, elapsedDays }
}
