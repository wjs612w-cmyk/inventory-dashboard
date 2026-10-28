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

// rows: [{ it, m }]. 필터·정렬이 바뀌면 부모에서 key를 바꿔 펼침/페이지 상태를 초기화합니다.
export default function ItemTable({ rows, ctx }) {
  const [limit, setLimit] = useState(PAGE)
  const [openId, setOpenId] = useState(null)
  const shown = rows.slice(0, limit)

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1060px] text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">품목</th>
              <th className="px-3 py-2 text-right font-medium">현재고</th>
              <th className="px-3 py-2 text-right font-medium">일 평균 출고</th>
              <th className="px-3 py-2 font-medium">4주 추이</th>
              <th className="px-3 py-2 text-right font-medium">전주 대비</th>
              <th className="px-3 py-2 text-right font-medium" title="최근 7일 판매 ÷ 직전 3주 주간 평균. 1보다 크면 증가, 작으면 감소">직전 3주 대비</th>
              <th className="px-3 py-2 text-right font-medium">입고율</th>
              <th className="px-3 py-2 text-right font-medium">월말 예상 재고</th>
              <th className="px-3 py-2 text-right font-medium">영업 진도율</th>
              <th className="px-3 py-2 font-medium">상태</th>
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
                      <td colSpan={10} className="p-0"><ItemDetail item={it} m={m} ctx={ctx} /></td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
      {rows.length > limit && (
        <div className="border-t border-slate-100 p-3 text-center">
          <button onClick={() => setLimit((l) => l + PAGE)} className="rounded-md border border-slate-300 px-4 py-1.5 text-sm hover:border-brand">
            {Math.min(PAGE, rows.length - limit)}개 더 보기 ({limit}/{rows.length})
          </button>
        </div>
      )}
    </div>
  )
}
