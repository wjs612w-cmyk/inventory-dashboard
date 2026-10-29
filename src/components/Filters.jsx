import { CATEGORIES } from '../config'

const sel = 'rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-ink focus:outline-2 focus:outline-brand'

export default function Filters({ category, setCategory, brand, setBrand, brands, basis, setBasis, counts, query, setQuery, hideInactive, setHideInactive, moveFilter, setMoveFilter, group, setGroup, groups, sub, setSub, subs }) {
  const chip = (active) =>
    `rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
      active ? 'border-brand bg-brand text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-brand'
    }`

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label="품목군 필터">
        {['전체', ...CATEGORIES].map((c) => (
          <button key={c} onClick={() => setCategory(c)} className={chip(category === c)} aria-pressed={category === c}>
            {c} <span className="ml-1 opacity-70">{counts[c] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          브랜드
          <select value={brand} onChange={(e) => setBrand(e.target.value)} className={sel}>
            <option value="전체">전체 브랜드</option>
            {brands.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </label>

        {category !== '전체' && groups.length > 0 && (
          <label className="flex items-center gap-2 text-sm text-slate-600">
            카테고리
            <select value={group} onChange={(e) => setGroup(e.target.value)} className={sel}>
              <option value="전체">전체 카테고리</option>
              {groups.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </label>
        )}

        {group !== '전체' && subs.length > 0 && (
          <label className="flex items-center gap-2 text-sm text-slate-600">
            하위카테고리
            <select value={sub} onChange={(e) => setSub(e.target.value)} className={sel}>
              <option value="전체">전체 하위카테고리</option>
              {subs.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
        )}

        <label className="flex items-center gap-2 text-sm text-slate-600">
          일 평균 출고 기준
          <select value={basis} onChange={(e) => setBasis(e.target.value)} className={sel}>
            <option value="7">최근 7일 평균</option>
            <option value="28">최근 28일 평균</option>
            <option value="mtd">당월 평균</option>
          </select>
        </label>

        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="품목명·품번 검색"
          className={`${sel} w-52`}
          aria-label="품목 검색"
        />

        <label className="flex items-center gap-2 text-sm text-slate-600">
          판매 변동
          <select value={moveFilter} onChange={(e) => setMoveFilter(e.target.value)} className={sel}>
            <option value="0">전체 보기</option>
            <optgroup label="급증 (직전 3주 평균 대비)">
              <option value="up:1.5">1.5배 이상</option>
              <option value="up:2">2배 이상</option>
              <option value="up:3">3배 이상</option>
            </optgroup>
            <optgroup label="급감 (직전 3주 평균 대비)">
              <option value="down:0.7">30% 이상 감소</option>
              <option value="down:0.5">50% 이상 감소</option>
              <option value="down:0.3">70% 이상 감소</option>
            </optgroup>
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={hideInactive} onChange={(e) => setHideInactive(e.target.checked)} className="size-4 accent-teal-700" />
          계획·재고·출고가 모두 0인 품목 숨기기
        </label>
      </div>
    </section>
  )
}
