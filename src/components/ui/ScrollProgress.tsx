import { motion, useScroll, useSpring } from 'framer-motion'

// A thin line across the top of the window that fills as the page is read.
export function ScrollProgress() {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, { stiffness: 180, damping: 30, restDelta: 0.001 })
  return (
    <motion.div
      aria-hidden
      className="fixed inset-x-0 top-0 z-50 h-[2px] origin-left bg-gradient-to-r from-accent via-glow to-accent shadow-[0_0_12px_rgb(var(--ui-glow)/0.7)]"
      style={{ scaleX }}
    />
  )
}
