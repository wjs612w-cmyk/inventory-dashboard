import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { fmt, fmtPct, weeklyToChart } from '../lib/metrics'

function Stat({ label, value, tone }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className={`font-semibold tabular-nums ${tone || ''}`}>{value}</dd>
    </div>
  )
}

export default function ItemDetail({ item, m, ctx }) {
  const chart = weeklyToChart(item.weekly)
  return (
    <div className="grid gap-4 bg-slate-50 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <div>
        <p className="mb-1 text-sm font-medium">주차별 판매 흐름</p>
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chart} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} width={52} tickFormatter={(v) => v.toLocaleString('ko-KR')} />
              <Tooltip formatter={(v) => [v.toLocaleString('ko-KR'), '판매량']} />
              <Line type="monotone" dataKey="value" stroke="#0f766e" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          {item.sku && `품번 ${item.sku} · `}{item.category} · {item.brand} · {item.group}
        </p>
      </div>

      <dl className="grid grid-cols-2 content-start gap-x-4 gap-y-3 sm:grid-cols-3">
        <Stat label="당월 영업계획" value={fmt(item.salesPlan)} />
        <Stat label="당월 출고량" value={fmt(item.shipped)} />
        <Stat label="월말 예상 판매" value={fmt(m.forecast)} />
        <Stat label="영업계획 진도율" value={fmtPct(m.pace)} />
        <Stat label="계획 대비 누적 달성" value={fmtPct(m.achieved)} />
        <Stat label="전월 출고량" value={fmt(item.prevShipped)} />
        <Stat label="당월 생산계획" value={fmt(item.prodPlan)} />
        <Stat label="당월 입고 수량" value={fmt(item.inbound)} />
        <Stat label="입고율" value={fmtPct(m.inboundRate)} />
        <Stat label="현재고" value={fmt(item.stock)} />
        <Stat label="잔여 입고 예정" value={fmt(m.pendingInbound)} />
        <Stat label={`월말 예상 재고 (${ctx.remaining}일 후)`} value={fmt(m.projectedEnd)} tone={m.risk === 'danger' ? 'text-red-600' : m.risk === 'warn' ? 'text-amber-600' : ''} />
        <Stat label="일 평균 출고" value={fmt(m.dailyAvg, 1)} />
        <Stat label="직전 3주 주간 평균" value={fmt(m.prevAvg)} />
        <Stat label="재고 커버(일)" value={m.coverDays == null ? '–' : fmt(m.coverDays, 0)} />
        <Stat label="다음달 영업/생산계획" value={`${fmt(item.nextSalesPlan)} / ${fmt(item.nextProdPlan)}`} />
      </dl>
    </div>
  )
}
