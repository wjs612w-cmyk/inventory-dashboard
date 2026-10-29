// 현재 위치 표시: 전체 › 마스크 › CLA › 슬림핏 › 대형  (앞 단계를 누르면 그 단계로 돌아갑니다)
export default function Breadcrumb({ crumbs }) {
  return (
    <nav aria-label="현재 보고 있는 위치" className="flex flex-wrap items-center gap-1 text-sm">
      {crumbs.map((c, i) => {
        const last = i === crumbs.length - 1
        return (
          <span key={`${c.label}-${i}`} className="flex items-center gap-1">
            {i > 0 && <span className="text-slate-400" aria-hidden>›</span>}
            {last ? (
              <span className="font-semibold text-ink" aria-current="page">{c.label}</span>
            ) : (
              <button onClick={c.go} className="text-slate-500 underline-offset-2 hover:text-brand hover:underline focus-visible:outline-2 focus-visible:outline-brand">
                {c.label}
              </button>
            )}
          </span>
        )
      })}
    </nav>
  )
}
