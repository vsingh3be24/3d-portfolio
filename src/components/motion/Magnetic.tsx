import { useRef, type ReactNode } from 'react'
import { motion, useReducedMotion, useSpring } from 'framer-motion'
import { useCoarsePointer } from '@/hooks/useIsMobile'

const SPRING = { stiffness: 260, damping: 18, mass: 0.4 }

// Leans its contents toward the pointer while it is over them, and springs
// back when it leaves. Mouse only, and never under reduced motion.
export function Magnetic({ children, strength = 0.3 }: { children: ReactNode; strength?: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const x = useSpring(0, SPRING)
  const y = useSpring(0, SPRING)
  const reduced = useReducedMotion()
  const coarse = useCoarsePointer()
  const active = !reduced && !coarse

  return (
    <motion.span
      ref={ref}
      className="inline-flex"
      style={{ x, y }}
      onPointerMove={(event) => {
        if (!active || !ref.current) return
        const box = ref.current.getBoundingClientRect()
        x.set((event.clientX - (box.left + box.width / 2)) * strength)
        y.set((event.clientY - (box.top + box.height / 2)) * strength)
      }}
      onPointerLeave={() => {
        x.set(0)
        y.set(0)
      }}
    >
      {children}
    </motion.span>
  )
}
