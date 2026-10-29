import { Area, AreaChart, Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import Segmented from './Segmented'
import { fmt } from '../lib/metrics'

const tone = (p) => (p == null ? 'text-slate-500' : p >= 0 ? 'text-teal-700' : 'text-red-600')
const pctText = (p) => (p == null ? '–' : p >= 0 ? `▲ ${p.toFixed(0)}%` : `▼ ${Math.abs(p).toFixed(0)}%`)

// info: { cur, c1, cf, short[], estimate } — 주간/월별에 따라 라벨이 달라집니다.
function Card({ g, onSelect, info }) {
  const up = g.chg1 == null || g.chg1 >= 0
  const color = up ? '#0f766e' : '#dc2626'
  const data = g.series.map((value, i) => ({ label: info.short[i], value }))
  const gid = `fill-${String(g.name).replace(/[^a-zA-Z0-9가-힣]/g, '')}`
  const last = data.length - 1
  return (
    <button
      onClick={() => onSelect?.(g.name)}
      disabled={!onSelect}
      className="rounded-lg border border-slate-200 bg-white p-3 text-left enabled:hover:border-brand focus-visible:outline-2 focus-visible:outline-brand"
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate font-semibold">{g.name}</span>
        <span className="shrink-0 text-xs text-slate-500">{g.count}개 품목</span>
      </div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="text-2xl font-semibold tabular-nums">{fmt(g.cur)}</span>
        <span className="text-xs text-slate-500">{info.cur}</span>
      </div>
      <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs">
        <span className={`font-medium ${tone(g.chg1)}`}>{info.c1} {pctText(g.chg1)}</span>
        {info.cf && <span className={tone(g.chgFirst)}>{info.cf} {pctText(g.chgFirst)}</span>}
      </div>

      <div className="mt-2 h-20">
        <ResponsiveContainer width="100%" height="100%">
          {info.estimate ? (
            <BarChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 0 }} barCategoryGap="18%">
              <XAxis dataKey="label" hide />
              <YAxis hide domain={[0, 'auto']} />
              <Tooltip formatter={(v) => [v.toLocaleString('ko-KR'), '출고량']} />
              <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                {data.map((d, i) => (
                  <Cell key={d.label} fill={color} fillOpacity={i === last ? 0.4 : 0.9} stroke={i === last ? color : 'none'} strokeDasharray="3 2" />
                ))}
              </Bar>
            </BarChart>
          ) : (
            <AreaChart data={data} margin={{ top: 6, right: 8, left: 8, bottom: 0 }}>
              <defs>
                <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} interval={0} />
              <YAxis hide domain={[(m) => Math.max(0, Math.floor(m * 0.8)), (m) => Math.ceil(m * 1.05) || 1]} />
              <Tooltip formatter={(v) => [v.toLocaleString('ko-KR'), '판매량']} />
              <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill={`url(#${gid})`} dot={{ r: 3, fill: color }} />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>

      {info.estimate && (
        <div className="mt-1 grid gap-1 text-center text-[11px] text-slate-500" style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}>
          {data.map((d) => (
            <div key={d.label}>
              <div>{d.label}</div>
              <div className="tabular-nums text-ink">{fmt(d.value)}</div>
            </div>
          ))}
        </div>
      )}
    </button>
  )
}

export default function TrendCards({ summary, title, view, setView, period, setPeriod, info, note, onSelect }) {
  const { groups, hidden, total } = summary
  return (
    <section className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="mt-0.5 text-sm text-slate-600">
            {info.cur} 전체 <b className="tabular-nums">{fmt(total.cur)}</b>개 ·{' '}
            <span className={`font-medium ${tone(total.chg1)}`}>{info.c1} {pctText(total.chg1)}</span>
            {info.cf && (
              <>
                {' '}· <span className={tone(total.chgFirst)}>{info.cf} {pctText(total.chgFirst)}</span>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Segmented label="기간" value={period} onChange={setPeriod} options={[['week', '주간 흐름'], ['month', '월별 흐름']]} />
          <Segmented label="그래프 보기 방식" value={view} onChange={setView} options={[['cards', '카드로 보기'], ['line', '한 그래프에서 비교']]} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {groups.map((g) => (
          <Card key={g.name} g={g} onSelect={onSelect} info={info} />
        ))}
      </div>

      <p className="text-xs text-slate-500">
        카드마다 눈금이 달라서 모양은 "증감 흐름"만 보여 줍니다. 규모 비교는 숫자를 보세요. 초록 ▲ 는 늘어남, 빨강 ▼ 는 줄어듦({info.c1} 대비)입니다.
        {note}
        {onSelect && ' 카드를 누르면 그 항목만 골라서 볼 수 있어요.'}
        {hidden > 0 && ` 규모가 작은 ${hidden}개 항목은 생략했습니다.`}
      </p>
    </section>
  )
}
