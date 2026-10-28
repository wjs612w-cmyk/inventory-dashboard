// 표 안에 넣는 가벼운 SVG 꺾은선 (과거 → 최근)
export default function Sparkline({ values, width = 84, height = 26, color = '#0f766e' }) {
  const max = Math.max(...values)
  const min = Math.min(...values)
  const span = max - min || 1
  const pad = 3
  const pts = values.map((v, i) => [pad + (i * (width - pad * 2)) / (values.length - 1), height - pad - ((v - min) / span) * (height - pad * 2)])
  const flat = max === min
  return (
    <svg width={width} height={height} role="img" aria-label={`주차별 판매 ${values.join(', ')}`}>
      <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke={flat ? '#94a3b8' : color} strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2.5" fill={flat ? '#94a3b8' : color} />
    </svg>
  )
}
