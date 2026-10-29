import { WEEK_LABELS, SPIKE_MIN_QTY, DROP_MIN_QTY, FORECAST_SOURCE } from '../config'

const sum = (a) => a.reduce((x, y) => x + y, 0)

// 시트 1행의 "경과일수"(예: 27)를 기준일로 사용. 없으면 어제까지로 가정.
export function getMonthContext(elapsedFromSheet, today = new Date()) {
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  const fallback = Math.max(1, today.getDate() - 1)
  const elapsed = Math.min(daysInMonth, Math.max(1, elapsedFromSheet || fallback))
  return { month: today.getMonth() + 1, daysInMonth, elapsed, remaining: daysInMonth - elapsed, fromSheet: !!elapsedFromSheet }
}

// 월말 예상 출고(판매)량: 시트의 '당월 예상 판매량' 또는 직접 계산 (config.js의 FORECAST_SOURCE)
export function forecastOf(it, ctx) {
  if (FORECAST_SOURCE === 'sheet' && it.sheetForecast > 0) return it.sheetForecast
  return (it.shipped / ctx.elapsed) * ctx.daysInMonth
}

// 그래프용 기간 정의: 주간(최근 4주) / 월별(전전월·전월·당월 예상)
export const WEEK_SERIES = { labels: WEEK_LABELS, get: (it) => it.weekly }

export function makeMonthSeries(ctx, hasPrev2) {
  const m = ctx.month
  const mm = (k) => ((m - 1 - k + 12) % 12) + 1 // k개월 전의 '월'
  const all = [`${mm(2)}월`, `${mm(1)}월`, `${m}월(예상)`]
  return hasPrev2
    ? { labels: all, get: (it) => [it.prev2Shipped ?? 0, it.prevShipped, forecastOf(it, ctx)] }
    : { labels: all.slice(1), get: (it) => [it.prevShipped, forecastOf(it, ctx)] }
}

/**
 * 품목 1개 지표
 * basis: '7' 최근 7일 평균 / '28' 최근 28일 평균 / 'mtd' 당월 평균(당월 출고 ÷ 경과일)
 */
export function computeMetrics(item, { basis = '7', ctx }) {
  const [w4, w3, w2, w1] = item.weekly
  const dailyAvg = basis === '28' ? (w1 + w2 + w3 + w4) / 28 : basis === 'mtd' ? item.shipped / ctx.elapsed : w1 / 7

  // 입고율 = 당월 입고 수량 ÷ 당월 생산계획
  const inboundRate = item.prodPlan > 0 ? (item.inbound / item.prodPlan) * 100 : null
  // 당월 입고 예정량(잔여) = 생산계획 − 이미 입고된 수량
  const pendingInbound = Math.max(0, item.prodPlan - item.inbound)
  // 월말 예상 재고 = 현재고 + 잔여 입고 예정 − 일 평균 출고 × 월말까지 남은 일수
  const projectedEnd = item.stock + pendingInbound - dailyAvg * ctx.remaining

  // 영업계획 진도율(시트와 동일 정의) = 당월 출고 ÷ (영업계획 × 경과일/월일수). 100% = 계획 페이스
  const pace =
    item.salesPlan > 0 ? (item.planShipped / (item.salesPlan * (ctx.elapsed / ctx.daysInMonth))) * 100 : item.sheetProgress
  const achieved = item.salesPlan > 0 ? (item.planShipped / item.salesPlan) * 100 : null // 계획 대비 누적 달성률
  const forecast = forecastOf(item, ctx) // 월말 예상 판매량

  const coverDays = dailyAvg > 0 ? item.stock / dailyAvg : null
  const wow = w2 > 0 ? ((w1 - w2) / w2) * 100 : null

  // 판매 급증: 최근 7일 판매량 ÷ 직전 3주 주간 평균 (직전 3주가 0이면 Infinity = 신규 판매)
  const prevAvg = (w2 + w3 + w4) / 3
  const spikeRatio = w1 >= SPIKE_MIN_QTY ? (prevAvg > 0 ? w1 / prevAvg : Infinity) : null
  // 판매 급감: 직전 3주 평균이 어느 정도 있던 품목이 최근 7일에 얼마나 줄었는지 (0 = 판매 중단)
  const dropRatio = prevAvg >= DROP_MIN_QTY ? w1 / prevAvg : null

  let risk = 'ok'
  if (projectedEnd < -0.5) risk = 'danger'
  else if (dailyAvg > 0 && projectedEnd < dailyAvg * 7) risk = 'warn'

  return { dailyAvg, inboundRate, pendingInbound, projectedEnd, pace, achieved, forecast, coverDays, wow, risk, prevAvg, spikeRatio, dropRatio }
}

export function aggregate(items) {
  return items.reduce(
    (a, it) => {
      a.stock += it.stock
      a.prodPlan += it.prodPlan
      a.inbound += it.inbound
      a.planInbound += it.planInbound
      a.salesPlan += it.salesPlan
      a.shipped += it.shipped
      a.planShipped += it.planShipped
      a.planForecast += it.planForecast
      a.prevShipped += it.prevShipped
      a.weekly = a.weekly.map((v, i) => v + it.weekly[i])
      return a
    },
    { stock: 0, prodPlan: 0, inbound: 0, planInbound: 0, salesPlan: 0, shipped: 0, planShipped: 0, planForecast: 0, prevShipped: 0, weekly: [0, 0, 0, 0] }
  )
}

// 상단 KPI용 요약 (월말 재고는 품목별로 계산해 합산 → 한 품목의 품절이 다른 품목 잉여와 상쇄되지 않게 건수도 함께 제공)
export function summarize(items, opts) {
  const t = aggregate(items)
  const ms = items.map((it) => computeMetrics(it, opts))
  const { ctx } = opts
  return {
    total: t,
    dailyAvg: sum(ms.map((m) => m.dailyAvg)),
    pendingInbound: sum(ms.map((m) => m.pendingInbound)),
    projectedEnd: sum(ms.map((m) => m.projectedEnd)),
    inboundRate: t.prodPlan > 0 ? (t.planInbound / t.prodPlan) * 100 : null,
    pace: t.salesPlan > 0 ? (t.planShipped / (t.salesPlan * (ctx.elapsed / ctx.daysInMonth))) * 100 : null,
    achieved: t.salesPlan > 0 ? (t.planShipped / t.salesPlan) * 100 : null,
    forecast: FORECAST_SOURCE === 'sheet' ? t.planForecast : (t.planShipped / ctx.elapsed) * ctx.daysInMonth,
    danger: ms.filter((m) => m.risk === 'danger').length,
    warn: ms.filter((m) => m.risk === 'warn').length,
  }
}

// 지정한 순서(order)대로 정렬. 목록에 없는 값은 맨 뒤에 원래 순서를 유지한 채 붙습니다. (공백은 무시)
export function sortByOrder(list, order, key = (x) => x) {
  if (!order) return list
  const idx = (x) => {
    const i = order.indexOf(String(key(x)).replace(/\s+/g, ''))
    return i < 0 ? order.length : i
  }
  return [...list].sort((a, b) => idx(a) - idx(b))
}

// 그룹별 추이. mode: 'qty' 수량 / 'index' 지수(첫 기간 = 100). 그룹이 많으면 상위 N-1 + 기타
export function buildGroupedTrend(items, groupKey, mode = 'qty', series = WEEK_SERIES, limit = 8, order = null) {
  const n = series.labels.length
  const groups = new Map()
  items.forEach((it) => {
    const g = it[groupKey] || '(없음)'
    const w = groups.get(g) || new Array(n).fill(0)
    series.get(it).forEach((v, i) => (w[i] += v))
    groups.set(g, w)
  })
  let entries = [...groups.entries()].sort((a, b) => sum(b[1]) - sum(a[1]))
  if (entries.length > limit) {
    const rest = entries.slice(limit - 1)
    const other = new Array(n).fill(0)
    rest.forEach(([, w]) => w.forEach((v, i) => (other[i] += v)))
    entries = [...entries.slice(0, limit - 1), ['기타', other]]
  }
  if (order) entries = sortByOrder(entries, order, (e) => e[0])
  const names = entries.map((e) => e[0])
  const data = series.labels.map((label, i) => {
    const row = { label }
    entries.forEach(([nm, w]) => {
      row[nm] = mode === 'index' ? (w[0] > 0 ? Math.round((w[i] / w[0]) * 1000) / 10 : null) : w[i]
    })
    return row
  })
  return { data, names }
}

export const weeklyToChart = (weekly) => WEEK_LABELS.map((label, i) => ({ label, value: weekly[i] }))

export const isInactive = (it) =>
  it.salesPlan === 0 && it.prodPlan === 0 && it.inbound === 0 && it.stock === 0 && it.shipped === 0 && it.prevShipped === 0 && it.weekly.every((v) => v === 0)

export const fmt = (n, d = 0) =>
  n == null || !Number.isFinite(n) ? '–' : n.toLocaleString('ko-KR', { maximumFractionDigits: d, minimumFractionDigits: d })
export const fmtPct = (n, d = 1) => (n == null || !Number.isFinite(n) ? '–' : `${n.toFixed(d)}%`)

// 대표 보고용 카드 요약: 그룹별 현재 기간 값 · 직전 기간 대비 · 처음 기간 대비
export function buildGroupSummary(items, groupKey, series = WEEK_SERIES, limit = 12, order = null) {
  const n = series.labels.length
  const map = new Map()
  items.forEach((it) => {
    const g = it[groupKey] || '(없음)'
    const e = map.get(g) || { name: g, series: new Array(n).fill(0), count: 0 }
    series.get(it).forEach((v, i) => (e.series[i] += v))
    e.count += 1
    map.set(g, e)
  })
  const pct = (a, b) => (b > 0 ? ((a - b) / b) * 100 : null)
  const calc = (e) => {
    const cur = e.series[n - 1]
    return { ...e, cur, chg1: n >= 2 ? pct(cur, e.series[n - 2]) : null, chgFirst: n >= 3 ? pct(cur, e.series[0]) : null }
  }
  const all = [...map.values()].map(calc).sort((a, b) => b.cur - a.cur)
  const totalSeries = new Array(n).fill(0)
  items.forEach((it) => series.get(it).forEach((v, i) => (totalSeries[i] += v)))
  const total = calc({ name: '전체', series: totalSeries, count: items.length })
  const ordered = order ? sortByOrder(all, order, (g) => g.name) : all
  return { groups: ordered.slice(0, limit), hidden: Math.max(0, all.length - limit), total }
}
