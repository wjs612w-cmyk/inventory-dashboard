export default function Segmented({ options, value, onChange, label }) {
  return (
    <div className="inline-flex overflow-hidden rounded-md border border-slate-300 text-sm" role="group" aria-label={label}>
      {options.map(([k, text]) => (
        <button
          key={k}
          onClick={() => onChange(k)}
          aria-pressed={value === k}
          className={`px-3 py-1.5 ${value === k ? 'bg-brand text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}
        >
          {text}
        </button>
      ))}
    </div>
  )
}
