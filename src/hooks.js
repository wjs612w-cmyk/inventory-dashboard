import { useEffect, useState } from 'react'
import { loadAll } from './lib/parse'

export function useSheetData() {
  const [state, setState] = useState({ items: [], errors: [], elapsedDays: null, loading: true })
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    let alive = true
    setState((s) => ({ ...s, loading: true }))
    loadAll()
      .then((r) => alive && setState({ ...r, loading: false }))
      .catch((e) => alive && setState({ items: [], errors: [e.message], elapsedDays: null, loading: false }))
    return () => {
      alive = false
    }
  }, [nonce])

  return { ...state, reload: () => setNonce((n) => n + 1) }
}
