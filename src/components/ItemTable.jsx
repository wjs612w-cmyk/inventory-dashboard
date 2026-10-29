import { Fragment, useState } from 'react'
import Sparkline from './Sparkline'
import ItemDetail from './ItemDetail'
import { paceTone } from './KpiCards'
import { fmt, fmtPct } from '../lib/metrics'

const RISK = {
  danger: { label: '품절 예상', cls: 'bg-red-50 text-red-700' },
  warn: { label: '재고 부족 주의', cls: 'bg-amber-50 text-amber-700' },
  ok: { label: '정상', cls: 'bg-teal-50 text-teal-700' },
}
const TONE = { default: '', good: 'text-teal-700', warn: 'text-amber-600', danger: 'text-red-600' }
const PAGE = 50

// "직전 3주 평균 대비" 칸 표시 (×2.3 = 2.3배, ×0.4 = 60% 감소)
const moveCell = (m) => {
  const r = m.spikeRatio ?? m.dropRatio
  if (r == null) return { text: '–', cls: '' }
  if (r === Infinity) return { text: '신규', cls: 'font-semibold text-violet-700' }
  if (r === 0) return { text: '중단', cls: 'font-semibold text-orange-700' }
  return { text: `×${r.toFixed(1)}`, cls: r >= 1.5 ? 'font-semibold text-violet-700' : r <= 0.67 ? 'font-semibold text-orange-700' : '' }
}

// 열 정의: first = 제목을 처음 눌렀을 때의 정렬 방향 (품목·상태는 오름차순, 숫자는 큰 값부터)
const COLS = [
  { key: 'name', label: '품목', get: (r) => r.it.name, text: true, first: 'asc' },
  { key: 'stock', label: '현재고', get: (r) => r.it.stock, right: true, first: 'desc' },
  { key: 'daily', label: '일 평균 출고', get: (r) => r.m.dailyAvg, right: true, first: 'desc' },
  { key: 'trend', label: '4주 추이', get: (r) => r.it.weekly[3], first: 'desc', title: '최근 7일 판매량 기준으로 정렬됩니다' },
  { key: 'wow', label: '전주 대비', get: (r) => r.m.wow, right: true, first: 'desc' },
  { key: 'move', label: '직전 3주 대비', get: (r) => r.m.spikeRatio ?? r.m.dropRatio, right: true, first: 'desc', title: '최근 7일 판매 ÷ 직전 3주 주간 평균. 1보다 크면 증가, 작으면 감소' },
  { key: 'inbound', label: '입고율', get: (r) => r.m.inboundRate, right: true, first: 'desc' },
  { key: 'proj', label: '월말 예상 재고', get: (r) => r.m.projectedEnd, right: true, first: 'desc' },
  { key: 'pace', label: '영업 진도율', get: (r) => r.m.pace, right: true, first: 'desc' },
  { key: 'risk', label: '상태', get: (r) => ({ danger: 0, warn: 1, ok: 2 })[r.m.risk], first: 'asc', title: '오름차순 = 위험한 품목이 먼저' },
]

// 빈 값(–)은 방향과 상관없이 항상 맨 뒤로 보냅니다.
function sortRows(rows, col, dir) {
  const mul = dir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    const x = col.get(a)
    const y = col.get(b)
    const xn = x == null || Number.isNaN(x)
    const yn = y == null || Number.isNaN(y)
    if (xn && yn) return 0
    if (xn) return 1
    if (yn) return -1
    if (col.text) return mul * String(x).localeCompare(String(y), 'ko')
    if (x === y) return 0
    return x < y ? -mul : mul
  })
}

// rows: [{ it, m }]. 필터·정렬 드롭다운이 바뀌면 부모에서 key를 바꿔 펼침/페이지/열 정렬 상태를 초기화합니다.
export default function ItemTable({ rows, ctx, months }) {
  const [limit, setLimit] = useState(PAGE)
  const [openId, setOpenId] = useState(null)
  const [sort, setSort] = useState(null) // { key, dir } | null (null = 위쪽 정렬 드롭다운 순서)

  const activeCol = sort && COLS.find((c) => c.key === sort.key)
  const sorted = activeCol ? sortRows(rows, activeCol, sort.dir) : rows
  const shown = sorted.slice(0, limit)

  // 같은 열을 누를 때마다: 처음 방향 → 반대 방향 → 해제
  const onSort = (col) => {
    setLimit(PAGE)
    setSort((s) => {
      if (!s || s.key !== col.key) return { key: col.key, dir: col.first }
      if (s.dir === col.first) return { key: col.key, dir: col.first === 'asc' ? 'desc' : 'asc' }
      return null
    })
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1060px] text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              {COLS.map((col) => {
                const active = sort?.key === col.key
                return (
                  <th
                    key={col.key}
                    className="px-3 py-2 font-medium"
                    aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    <button
                      onClick={() => onSort(col)}
                      title={col.title || '눌러서 정렬 (한 번 더: 반대 방향, 세 번째: 해제)'}
                      className={`inline-flex w-full items-center gap-1 whitespace-nowrap hover:text-ink focus-visible:outline-2 focus-visible:outline-brand ${col.right ? 'justify-end' : ''} ${active ? 'font-semibold text-ink' : ''}`}
                    >
                      {col.label}
                      <span aria-hidden className={active ? 'text-brand' : 'text-slate-300'}>
                        {active ? (sort.dir === 'asc' ? '▲' : '▼') : '↕'}
                      </span>
                    </button>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {shown.map(({ it, m }) => {
              const open = openId === it.id
              const risk = RISK[m.risk]
              const mv = moveCell(m)
              return (
                <Fragment key={it.id}>
                  <tr className={open ? 'bg-slate-50' : 'hover:bg-slate-50'}>
                    <td className="max-w-[340px] px-3 py-2">
                      <button onClick={() => setOpenId(open ? null : it.id)} aria-expanded={open} className="w-full text-left focus-visible:outline-2 focus-visible:outline-brand">
                        <span className="block truncate font-medium" title={it.name}>{it.name}</span>
                        <span className="block text-xs text-slate-500">{it.category} · {it.brand} · {it.group}</span>
                      </button>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmt(it.stock)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmt(m.dailyAvg, 1)}</td>
                    <td className="px-3 py-2"><Sparkline values={it.weekly} /></td>
                    <td className={`px-3 py-2 text-right tabular-nums ${m.wow == null ? '' : m.wow >= 0 ? 'text-teal-700' : 'text-red-600'}`}>
                      {m.wow == null ? '–' : `${m.wow >= 0 ? '+' : ''}${m.wow.toFixed(0)}%`}
                    </td>
                    <td className={`px-3 py-2 text-right tabular-nums ${mv.cls}`}>{mv.text}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtPct(m.inboundRate, 0)}</td>
                    <td className={`px-3 py-2 text-right tabular-nums ${m.risk === 'danger' ? 'text-red-600' : m.risk === 'warn' ? 'text-amber-600' : ''}`}>{fmt(m.projectedEnd)}</td>
                    <td className={`px-3 py-2 text-right tabular-nums ${TONE[paceTone(m.pace)]}`}>{fmtPct(m.pace, 0)}</td>
                    <td className="whitespace-nowrap px-3 py-2">
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${risk.cls}`}>{risk.label}</span>
                      {m.spikeRatio != null && m.spikeRatio >= 2 && (
                        <span className="ml-1 rounded bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700">판매 급증</span>
                      )}
                      {m.dropRatio != null && m.dropRatio <= 0.5 && (
                        <span className="ml-1 rounded bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700">판매 급감</span>
                      )}
                    </td>
                  </tr>
                  {open && (
                    <tr>
                      <td colSpan={COLS.length} className="p-0"><ItemDetail item={it} m={m} ctx={ctx} monthly={{ labels: months.labels, values: months.get(it) }} /></td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
      {sorted.length > limit && (
        <div className="border-t border-slate-100 p-3 text-center">
          <button onClick={() => setLimit((l) => l + PAGE)} className="rounded-md border border-slate-300 px-4 py-1.5 text-sm hover:border-brand">
            {Math.min(PAGE, sorted.length - limit)}개 더 보기 ({limit}/{sorted.length})
          </button>
        </div>
      )}
    </div>
  )
}
