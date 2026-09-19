import { useEffect, useRef, useState } from 'react'
import { useInView } from 'framer-motion'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { UI } from '@/scene/constants'

// "87.8%" -> prefix "", number 87.8 with one decimal, suffix "%". Anything
// without a number in it is shown as it is.
function parse(value: string): { prefix: string; target: number; decimals: number; suffix: string } | null {
  const match = value.match(/^([^\d]*)(\d+(?:\.\d+)?)(.*)$/)
  if (!match) return null
  const [, prefix, number, suffix] = match
  return { prefix, target: Number(number), decimals: number.split('.')[1]?.length ?? 0, suffix }
}

// Counts a figure up from zero the first time it comes into view, keeping its
// own format: "~120", "0.55", "87.8%". Reduced motion shows the figure
// straight away.
export function CountUp({ value }: { value: string }) {
  const prefersReducedMotion = usePrefersReducedMotion()
  const [shown, setShown] = useState(() => {
    const parsed = parse(value)
    return prefersReducedMotion || !parsed ? value : `${parsed.prefix}${(0).toFixed(parsed.decimals)}${parsed.suffix}`
  })
  const frame = useRef(0)
  const spanRef = useRef<HTMLSpanElement>(null)
  const inView = useInView(spanRef, { once: true })

  useEffect(() => {
    const parsed = parse(value)
    if (prefersReducedMotion || !parsed || !inView) return
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min((now - start) / UI.countUpMs, 1)
      const eased = 1 - (1 - t) ** 3
      setShown(`${parsed.prefix}${(parsed.target * eased).toFixed(parsed.decimals)}${parsed.suffix}`)
      if (t < 1) frame.current = requestAnimationFrame(tick)
    }
    frame.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame.current)
  }, [value, prefersReducedMotion, inView])

  return (
    <span ref={spanRef} className="tabular-nums">
      {shown}
    </span>
  )
}
