import { useMemo, useState } from 'react'
import { useSheetData } from './hooks'
import { CATEGORIES } from './config'
import { buildGroupedTrend, buildGroupSummary, computeMetrics, getMonthContext, isInactive, summarize } from './lib/metrics'
import Filters from './components/Filters'
import KpiCards from './components/KpiCards'
import TrendChart from './components/TrendChart'
import TrendCards from './components/TrendCards'
import ItemTable from './components/ItemTable'

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
  const [trendView, setTrendView] = useState('cards')

  const ctx = useMemo(() => getMonthContext(elapsedDays), [elapsedDays])
  const opts = useMemo(() => ({ basis, ctx }), [basis, ctx])

  const base = useMemo(() => (hideInactive ? items.filter((i) => !isInactive(i)) : items), [items, hideInactive])
  const counts = useMemo(() => {
    const c = { 전체: base.length }
    CATEGORIES.forEach((k) => (c[k] = base.filter((i) => i.category === k).length))
    return c
  }, [base])

  // 품목군(A열) → 브랜드(B열) → 검색어 순으로 좁힘
  const byCategory = useMemo(() => (category === '전체' ? base : base.filter((i) => i.category === category)), [base, category])
  const brands = useMemo(() => [...new Set(byCategory.map((i) => i.brand))].sort((a, b) => a.localeCompare(b, 'ko')), [byCategory])
  const scoped = useMemo(() => {
    const q = query.trim().toLowerCase()
    return byCategory.filter((i) => (brand === '전체' || i.brand === brand) && (!q || i.name.toLowerCase().includes(q) || i.sku.includes(q)))
  }, [byCategory, brand, query])

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
  const groupKey = category === '전체' ? 'category' : brand === '전체' ? 'brand' : 'group'
  const groupLabel = { category: '품목군별', brand: '브랜드별', group: '카테고리별' }[groupKey]
  const trend = useMemo(() => buildGroupedTrend(filtered, groupKey, trendMode), [filtered, groupKey, trendMode])

  const groupSummary = useMemo(() => buildGroupSummary(filtered, groupKey), [filtered, groupKey])

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

  const handleCategory = (c) => {
    setCategory(c)
    setBrand('전체')
  }

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
        brand={brand} setBrand={setBrand} brands={brands}
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
          {trendView === 'cards' ? (
            <TrendCards
              summary={groupSummary}
              title={`${groupLabel} 주차별 판매 흐름`}
              view={trendView}
              setView={setTrendView}
              onSelect={groupKey === 'category' ? handleCategory : groupKey === 'brand' ? setBrand : undefined}
            />
          ) : (
            <TrendChart data={trend.data} names={trend.names} title={`${groupLabel} 주차별 판매 흐름`} mode={trendMode} setMode={setTrendMode} view={trendView} setView={setTrendView} />
          )}

          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold">품목 상세 <span className="ml-1 text-sm font-normal text-slate-500">행을 누르면 주차별 그래프와 세부 지표가 펼쳐집니다</span></h2>
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
            <ItemTable key={`${category}|${brand}|${query}|${sort}|${basis}|${hideInactive}|${moveFilter}`} rows={rows} ctx={ctx} />
          </section>
        </>
      )}
    </div>
  )
}
