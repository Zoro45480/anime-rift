import { useEffect, useState } from 'react'

// « Écran occupé » : pendant une invocation ou un combat, les notifications attendent la fin pour ne rien dévoiler.
let count = 0
const listeners = new Set<(busy: boolean) => void>()
const emit = () => listeners.forEach((f) => f(count > 0))

// À appeler dans un écran plein (cinématique, combat) : l'écran est occupé tant qu'il est affiché.
export const useHoldNotifs = () => {
  useEffect(() => {
    count++; emit()
    return () => { count--; emit() }
  }, [])
}
export const useBusy = () => {
  const [busy, setBusy] = useState(count > 0)
  useEffect(() => { listeners.add(setBusy); return () => { listeners.delete(setBusy) } }, [])
  return busy
}
