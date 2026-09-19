import type { ReactNode } from 'react'
import { motion, type Variants } from 'framer-motion'
import { UI } from '@/scene/constants'

const group: Variants = {
  hidden: {},
  shown: { transition: { staggerChildren: UI.revealStagger, delayChildren: UI.revealDelay } },
}

const item: Variants = {
  hidden: { opacity: 0, y: UI.revealRise },
  shown: { opacity: 1, y: 0, transition: { duration: 0.42, ease: [0.22, 1, 0.36, 1] } },
}

// A block whose Reveal children fade up one after another when it mounts.
// Remounting it (a new key) plays the sequence again.
export function RevealGroup({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={group} initial="hidden" animate="shown">
      {children}
    </motion.div>
  )
}

// The same stagger, but played when the block first scrolls into view.
export function RevealOnScroll({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      variants={group}
      initial="hidden"
      whileInView="shown"
      viewport={{ once: true, margin: '-12% 0px' }}
    >
      {children}
    </motion.div>
  )
}

export function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={item}>
      {children}
    </motion.div>
  )
}
