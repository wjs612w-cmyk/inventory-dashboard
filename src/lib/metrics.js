import { WEEK_LABELS, SPIKE_MIN_QTY, DROP_MIN_QTY } from '../config'

const sum = (a) => a.reduce((x, y) => x + y, 0)

// 시트 1행의 "경과일수"(예: 27)를 기준일로 사용. 없으면 어제까지로 가정.
export function getMonthContext(elapsedFromSheet, today = new Date()) {
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  const fallback = Math.max(1, today.getDate() - 1)
  const elapsed = Math.min(daysInMonth, Math.max(1, elapsedFromSheet || fallback))
  return { month: today.getMonth() + 1, daysInMonth, elapsed, remaining: daysInMonth - elapsed, fromSheet: !!elapsedFromSheet }
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
  const forecast = (item.shipped / ctx.elapsed) * ctx.daysInMonth // 월말 예상 판매량

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
      a.prevShipped += it.prevShipped
      a.weekly = a.weekly.map((v, i) => v + it.weekly[i])
      return a
    },
    { stock: 0, prodPlan: 0, inbound: 0, planInbound: 0, salesPlan: 0, shipped: 0, planShipped: 0, prevShipped: 0, weekly: [0, 0, 0, 0] }
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
    forecast: (t.planShipped / ctx.elapsed) * ctx.daysInMonth,
    danger: ms.filter((m) => m.risk === 'danger').length,
    warn: ms.filter((m) => m.risk === 'warn').length,
  }
}

// 그룹별 주차 추이. mode: 'qty' 수량 / 'index' 지수(22~28일 전 = 100). 그룹이 많으면 상위 N-1 + 기타
export function buildGroupedTrend(items, groupKey, mode = 'qty', limit = 8) {
  const groups = new Map()
  items.forEach((it) => {
    const g = it[groupKey] || '(없음)'
    const w = groups.get(g) || [0, 0, 0, 0]
    it.weekly.forEach((v, i) => (w[i] += v))
    groups.set(g, w)
  })
  let entries = [...groups.entries()].sort((a, b) => sum(b[1]) - sum(a[1]))
  if (entries.length > limit) {
    const rest = entries.slice(limit - 1)
    const other = [0, 0, 0, 0]
    rest.forEach(([, w]) => w.forEach((v, i) => (other[i] += v)))
    entries = [...entries.slice(0, limit - 1), ['기타', other]]
  }
  const names = entries.map((e) => e[0])
  const data = WEEK_LABELS.map((label, i) => {
    const row = { label }
    entries.forEach(([n, w]) => {
      row[n] = mode === 'index' ? (w[0] > 0 ? Math.round((w[i] / w[0]) * 1000) / 10 : null) : w[i]
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

// 대표 보고용 카드 요약: 그룹별 최근 7일 판매 · 전주 대비 · 4주 전 대비
export function buildGroupSummary(items, groupKey, limit = 12) {
  const map = new Map()
  items.forEach((it) => {
    const g = it[groupKey] || '(없음)'
    const e = map.get(g) || { name: g, weekly: [0, 0, 0, 0], count: 0 }
    it.weekly.forEach((v, i) => (e.weekly[i] += v))
    e.count += 1
    map.set(g, e)
  })
  const calc = (e) => {
    const [w4, w3, w2, w1] = e.weekly
    return { ...e, w1, wow: w2 > 0 ? ((w1 - w2) / w2) * 100 : null, vs4: w4 > 0 ? ((w1 - w4) / w4) * 100 : null }
  }
  const all = [...map.values()].map(calc).sort((a, b) => b.w1 - a.w1)
  const total = calc({ name: '전체', weekly: aggregate(items).weekly, count: items.length })
  return { groups: all.slice(0, limit), hidden: Math.max(0, all.length - limit), total }
}
