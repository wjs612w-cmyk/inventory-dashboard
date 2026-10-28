import { fmt, fmtPct } from '../lib/metrics'

function Kpi({ title, value, sub, tone = 'default' }) {
  const toneCls = { default: 'text-ink', danger: 'text-red-600', warn: 'text-amber-600', good: 'text-brand' }[tone]
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-sm text-slate-500">{title}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${toneCls}`}>{value}</p>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">{sub}</p>
    </div>
  )
}

export const paceTone = (p) => (p == null ? 'default' : p >= 100 ? 'good' : p >= 90 ? 'warn' : 'danger')

export default function KpiCards({ s, ctx }) {
  const cover = s.dailyAvg > 0 ? s.total.stock / s.dailyAvg : null
  return (
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Kpi
        title="현재고"
        value={fmt(s.total.stock)}
        sub={`일 평균 출고 ${fmt(s.dailyAvg)} · 재고 커버 ${cover == null ? '–' : `${fmt(cover, 0)}일`}`}
      />
      <Kpi
        title="생산계획 대비 입고율"
        value={fmtPct(s.inboundRate)}
        sub={`입고 ${fmt(s.total.planInbound)} / 생산계획 ${fmt(s.total.prodPlan)} · 잔여 입고 ${fmt(s.pendingInbound)}`}
        tone={s.inboundRate == null ? 'default' : s.inboundRate >= 90 ? 'good' : s.inboundRate >= 60 ? 'warn' : 'danger'}
      />
      <Kpi
        title="월말 예상 재고"
        value={fmt(s.projectedEnd)}
        sub={`현재고 + 잔여 입고 − 일 평균 출고 × ${ctx.remaining}일 · 품절 예상 ${s.danger}개 · 주의 ${s.warn}개`}
        tone={s.danger > 0 ? 'danger' : s.warn > 0 ? 'warn' : 'default'}
      />
      <Kpi
        title="영업계획 진도율"
        value={fmtPct(s.pace)}
        sub={`100% = 계획 페이스 · 누적 달성 ${fmtPct(s.achieved)} (출고 ${fmt(s.total.planShipped)} / 계획 ${fmt(s.total.salesPlan)}) · 월말 예상 ${fmt(s.forecast)}`}
        tone={paceTone(s.pace)}
      />
    </section>
  )
}
