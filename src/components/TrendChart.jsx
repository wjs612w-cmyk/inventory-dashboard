import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import Segmented from './Segmented'

export const PALETTE = ['#0f766e', '#d97706', '#2563eb', '#be185d', '#7c3aed', '#475569', '#16a34a', '#dc2626']

export default function TrendChart({ data, names, title, mode, setMode, view, setView, period, setPeriod, baseLabel, note }) {
  const isIndex = mode === 'index'
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">{title}</h2>
        <div className="flex flex-wrap gap-2">
          <Segmented label="기간" value={period} onChange={setPeriod} options={[['week', '주간 흐름'], ['month', '월별 흐름']]} />
          <Segmented label="그래프 값 단위" value={mode} onChange={setMode} options={[['qty', '수량'], ['index', `지수 (${baseLabel} = 100)`]]} />
          <Segmented label="그래프 보기 방식" value={view} onChange={setView} options={[['cards', '카드로 보기'], ['line', '한 그래프에서 비교']]} />
        </div>
      </div>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => v.toLocaleString('ko-KR')} width={64} />
            <Tooltip formatter={(v) => (v == null ? '–' : isIndex ? v.toFixed(1) : v.toLocaleString('ko-KR'))} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {names.map((n, i) => (
              <Line key={n} type="monotone" dataKey={n} stroke={PALETTE[i % PALETTE.length]} strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {isIndex && `규모가 다른 그룹의 증감 흐름을 비교할 때 편합니다. 100보다 크면 ${baseLabel}보다 늘었다는 뜻입니다. `}
        {note}
      </p>
    </section>
  )
}
