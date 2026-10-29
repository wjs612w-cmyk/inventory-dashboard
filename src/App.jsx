import { useMemo, useState } from 'react'
import { useSheetData } from './hooks'
import { CATEGORIES, FORECAST_SOURCE, SUB_ORDER } from './config'
import { WEEK_SERIES, buildGroupedTrend, buildGroupSummary, computeMetrics, getMonthContext, isInactive, makeMonthSeries, sortByOrder, summarize } from './lib/metrics'
import Filters from './components/Filters'
import KpiCards from './components/KpiCards'
import TrendChart from './components/TrendChart'
import TrendCards from './components/TrendCards'
import ItemTable from './components/ItemTable'
import Breadcrumb from './components/Breadcrumb'

const uniq = (arr) => [...new Set(arr)].sort((a, b) => a.localeCompare(b, 'ko'))

// 급증 정렬용 값: 기준 미달(null)은 맨 뒤, 신규(Infinity)는 맨 앞
const spikeKey = (m) => (m.spikeRatio == null ? -1 : Math.min(m.spikeRatio, 1e9))
// 급감 정렬용 값: 많이 줄어든(작은 비율) 품목이 앞, 기준 미달(null)은 맨 뒤
const dropKey = (m) => (m.dropRatio == null ? 1e9 : m.dropRatio)

export default function App() {
  const { items, errors, elapsedDays, loading, reload } = useSheetData()
  const [category, setCategory] = useState('전체')
  const [brand, setBrand] = useState('전체')
  const [basis, setBasis] = useState('7')
  const [sort, setSort] = useState('risk')
  const [query, setQuery] = useState('')
  const [hideInactive, setHideInactive] = useState(true)
  const [trendMode, setTrendMode] = useState('qty')
  const [moveFilter, setMoveFilter] = useState('0')
  const [group, setGroup] = useState('전체') // 카테고리(C열)
  const [sub, setSub] = useState('전체') // 하위카테고리
  const [trendView, setTrendView] = useState('cards')
  const [period, setPeriod] = useState('week')

  const ctx = useMemo(() => getMonthContext(elapsedDays), [elapsedDays])
  const opts = useMemo(() => ({ basis, ctx }), [basis, ctx])

  // 월별 흐름: 전전월(선택 열) · 전월 · 당월(예상)
  const hasPrev2 = useMemo(() => items.some((i) => i.prev2Shipped != null), [items])
  const months = useMemo(() => makeMonthSeries(ctx, hasPrev2), [ctx, hasPrev2])
  const series = period === 'month' ? months : WEEK_SERIES
  const periodInfo = useMemo(
    () =>
      period === 'week'
        ? { cur: '최근 7일', c1: '전주', cf: '4주 전', short: ['4주 전', '3주 전', '2주 전', '최근'], estimate: false, base: '22~28일 전', note: '' }
        : {
            cur: `${ctx.month}월 예상`,
            c1: '전월',
            cf: hasPrev2 ? '2개월 전' : null,
            short: months.labels,
            estimate: true,
            base: months.labels[0],
            note:
              (FORECAST_SOURCE === 'sheet'
                ? ` ${ctx.month}월(예상)은 시트의 '당월 예상 판매량' 값입니다.`
                : ` ${ctx.month}월(예상)은 당월 출고량 ÷ 경과일 × 월 일수로 계산한 값입니다.`) +
              (hasPrev2 ? '' : " 시트에서 '전전월 출고량' 열을 찾지 못해 2개월만 표시합니다."),
          },
    [period, ctx, hasPrev2, months]
  )

  const base = useMemo(() => (hideInactive ? items.filter((i) => !isInactive(i)) : items), [items, hideInactive])
  const counts = useMemo(() => {
    const c = { 전체: base.length }
    CATEGORIES.forEach((k) => (c[k] = base.filter((i) => i.category === k).length))
    return c
  }, [base])

  // 품목군(A열) → 브랜드(B열) → 검색어 순으로 좁힘
  const byCategory = useMemo(() => (category === '전체' ? base : base.filter((i) => i.category === category)), [base, category])
  const brands = useMemo(() => [...new Set(byCategory.map((i) => i.brand))].sort((a, b) => a.localeCompare(b, 'ko')), [byCategory])
  // 드릴다운: 품목군 → 브랜드 → 카테고리 → 하위카테고리 (각 단계의 선택지는 앞 단계 선택 안에서만 만듭니다)
  const byBrand = useMemo(() => (brand === '전체' ? byCategory : byCategory.filter((i) => i.brand === brand)), [byCategory, brand])
  const groups = useMemo(() => uniq(byBrand.map((i) => i.group)), [byBrand])
  const byGroup = useMemo(() => (group === '전체' ? byBrand : byBrand.filter((i) => i.group === group)), [byBrand, group])
  const subs = useMemo(() => {
    const real = sortByOrder(uniq(byGroup.map((i) => i.sub).filter((s) => s && s !== '(미분류)')), SUB_ORDER[category])
    if (real.length === 0) return [] // 하위카테고리 값이 없으면 이 단계는 건너뜁니다
    return byGroup.some((i) => i.sub === '(미분류)') ? [...real, '(미분류)'] : real
  }, [byGroup, category])

  const scoped = useMemo(() => {
    const q = query.trim().toLowerCase()
    return byGroup.filter((i) => (sub === '전체' || i.sub === sub) && (!q || i.name.toLowerCase().includes(q) || i.sku.includes(q)))
  }, [byGroup, sub, query])

  // 판매 급증·급감 판정 (품목군·브랜드·검색 조건 안에서)
  const moveMetrics = useMemo(() => new Map(scoped.map((i) => [i.id, computeMetrics(i, opts)])), [scoped, opts])
  const moveCounts = useMemo(() => {
    let up = 0
    let down = 0
    moveMetrics.forEach((m) => {
      if (m.spikeRatio != null && m.spikeRatio >= 2) up += 1
      if (m.dropRatio != null && m.dropRatio <= 0.5) down += 1
    })
    return { up, down }
  }, [moveMetrics])

  const filtered = useMemo(() => {
    if (moveFilter === '0') return scoped
    const [kind, v] = moveFilter.split(':')
    const t = Number(v)
    return scoped.filter((i) => {
      const m = moveMetrics.get(i.id)
      return kind === 'up' ? (m.spikeRatio ?? 0) >= t : m.dropRatio != null && m.dropRatio <= t
    })
  }, [scoped, moveFilter, moveMetrics])

  const summary = useMemo(() => summarize(filtered, opts), [filtered, opts])

  // 전체 → 품목군별 / 품목군 선택 → 브랜드별 / 브랜드까지 선택 → 카테고리(C열)별
  const groupKey =
    category === '전체' ? 'category'
    : brand === '전체' ? 'brand'
    : group === '전체' ? 'group'
    : sub === '전체' && subs.length > 0 ? 'sub'
    : 'name'
  const groupLabel = { category: '품목군별', brand: '브랜드별', group: '카테고리별', sub: '하위카테고리별', name: '품목별' }[groupKey]
  // 하위카테고리 단계에서는 config.js의 SUB_ORDER 순서(예: 마스크 대형→중형→소형…)로 보여 줍니다
  const subOrder = groupKey === 'sub' ? SUB_ORDER[category] ?? null : null
  const trend = useMemo(() => buildGroupedTrend(filtered, groupKey, trendMode, series, 8, subOrder), [filtered, groupKey, trendMode, series, subOrder])

  const groupSummary = useMemo(() => buildGroupSummary(filtered, groupKey, series, 12, subOrder), [filtered, groupKey, series, subOrder])

  const rows = useMemo(() => {
    const order = { danger: 0, warn: 1, ok: 2 }
    const r = filtered.map((it) => ({ it, m: computeMetrics(it, opts) }))
    const cmp = {
      risk: (a, b) => order[a.m.risk] - order[b.m.risk] || a.m.projectedEnd - b.m.projectedEnd,
      sales: (a, b) => b.it.weekly[3] - a.it.weekly[3],
      stock: (a, b) => b.it.stock - a.it.stock,
      pace: (a, b) => (a.m.pace ?? 1e12) - (b.m.pace ?? 1e12),
      paceDesc: (a, b) => (b.m.pace ?? -1) - (a.m.pace ?? -1),
      spike: (a, b) => spikeKey(b.m) - spikeKey(a.m),
      drop: (a, b) => dropKey(a.m) - dropKey(b.m) || b.m.prevAvg - a.m.prevAvg,
      name: (a, b) => a.it.name.localeCompare(b.it.name, 'ko'),
    }[sort]
    return r.sort(cmp)
  }, [filtered, opts, sort])

  // 윗 단계를 바꾸면 아래 단계 선택은 초기화합니다
  const handleCategory = (c) => {
    setCategory(c)
    setBrand('전체')
    setGroup('전체')
    setSub('전체')
  }
  const handleBrand = (b) => {
    setBrand(b)
    setGroup('전체')
    setSub('전체')
  }
  const handleGroup = (g) => {
    setGroup(g)
    setSub('전체')
  }
  const handleSub = (s) => setSub(s)

  const crumbs = [
    { label: '전체', go: () => handleCategory('전체') },
    category !== '전체' && { label: category, go: () => handleCategory(category) },
    brand !== '전체' && { label: brand, go: () => handleBrand(brand) },
    group !== '전체' && { label: group, go: () => handleGroup(group) },
    sub !== '전체' && { label: sub, go: () => handleSub(sub) },
  ].filter(Boolean)

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">재고·판매 대시보드</h1>
          <p className="text-sm text-slate-500">
            {ctx.month}월 {ctx.elapsed}일 기준{ctx.fromSheet ? ' (시트 값)' : ''} · 월말까지 {ctx.remaining}일 · 조회 품목 {filtered.length}개
          </p>
        </div>
        <button onClick={reload} disabled={loading} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:border-brand disabled:opacity-50">
          {loading ? '불러오는 중…' : '데이터 새로고침'}
        </button>
      </header>

      {errors.length > 0 && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          <p className="font-medium">시트를 불러오지 못했습니다. 웹 게시 상태와 링크를 확인해 주세요.</p>
          <ul className="list-disc pl-5">{errors.map((e) => <li key={e}>{e}</li>)}</ul>
        </div>
      )}

      <Filters
        category={category} setCategory={handleCategory}
        brand={brand} setBrand={handleBrand} brands={brands}
        group={group} setGroup={handleGroup} groups={groups}
        sub={sub} setSub={handleSub} subs={subs}
        basis={basis} setBasis={setBasis} counts={counts}
        query={query} setQuery={setQuery}
        hideInactive={hideInactive} setHideInactive={setHideInactive}
        moveFilter={moveFilter} setMoveFilter={setMoveFilter}
      />

      {loading && items.length === 0 ? (
        <p className="p-10 text-center text-slate-500">시트 데이터를 불러오는 중입니다…</p>
      ) : filtered.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          조건에 맞는 품목이 없습니다. 필터나 검색어를 바꿔 보세요.
        </p>
      ) : (
        <>
          <KpiCards s={summary} ctx={ctx} />
          <Breadcrumb crumbs={crumbs} />
          {trendView === 'cards' ? (
            <TrendCards
              summary={groupSummary}
              title={`${groupLabel} ${period === 'week' ? '주차별' : '월별'} 판매 흐름`}
              view={trendView}
              setView={setTrendView}
              period={period}
              setPeriod={setPeriod}
              info={periodInfo}
              note={periodInfo.note}
              onSelect={{ category: handleCategory, brand: handleBrand, group: handleGroup, sub: handleSub }[groupKey]}
            />
          ) : (
            <TrendChart
              data={trend.data}
              names={trend.names}
              title={`${groupLabel} ${period === 'week' ? '주차별' : '월별'} 판매 흐름`}
              mode={trendMode}
              setMode={setTrendMode}
              view={trendView}
              setView={setTrendView}
              period={period}
              setPeriod={setPeriod}
              baseLabel={periodInfo.base}
              note={periodInfo.note}
            />
          )}

          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold">품목 상세 <span className="ml-1 text-sm font-normal text-slate-500">행을 누르면 세부 지표가 펼쳐지고, 열 제목을 누르면 정렬됩니다</span></h2>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                정렬
                <select value={sort} onChange={(e) => setSort(e.target.value)} className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-ink">
                  <option value="risk">재고 위험 순</option>
                  <option value="sales">최근 7일 판매 많은 순</option>
                  <option value="stock">현재고 많은 순</option>
                  <option value="pace">영업 진도율 낮은 순</option>
                  <option value="paceDesc">영업 진도율 높은 순</option>
                  <option value="spike">최근 7일 판매 급증 순</option>
                  <option value="drop">최근 7일 판매 급감 순</option>
                  <option value="name">품목명 순</option>
                </select>
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-slate-500">빠르게 보기</span>
              {[
                ['up:2', `판매 급증 ${moveCounts.up}개`, 'border-violet-300 bg-violet-600'],
                ['down:0.5', `판매 급감 ${moveCounts.down}개`, 'border-orange-300 bg-orange-600'],
              ].map(([v, label, on]) => (
                <button
                  key={v}
                  onClick={() => setMoveFilter(moveFilter === v ? '0' : v)}
                  aria-pressed={moveFilter === v}
                  className={`rounded-full border px-3 py-1 ${moveFilter === v ? `${on} text-white` : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'}`}
                >
                  {label}
                </button>
              ))}
              <span className="text-xs text-slate-500">급증 = 직전 3주 평균의 2배 이상, 급감 = 절반 이하</span>
            </div>
            <ItemTable key={`${category}|${brand}|${group}|${sub}|${query}|${sort}|${basis}|${hideInactive}|${moveFilter}`} rows={rows} ctx={ctx} months={months} />
          </section>
        </>
      )}
    </div>
  )
}
