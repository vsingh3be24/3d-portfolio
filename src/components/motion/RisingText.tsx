import { motion } from 'framer-motion'

const EASE = [0.22, 1, 0.36, 1] as const

type RisingTextProps = {
  text: string
  // 'mount' rises as soon as it is drawn; 'view' waits until it scrolls in.
  on?: 'mount' | 'view'
  delay?: number
  // Class for the last word, which can carry the gradient.
  lastClassName?: string
}

// Each word rises into place from behind a mask, one after another. The mask
// carries extra room below the baseline so descenders are never clipped, and
// gives it back with a negative margin so line spacing is untouched. Real
// spaces sit between the masks, so the text still wraps like text.
export function RisingText({ text, on = 'mount', delay = 0.1, lastClassName }: RisingTextProps) {
  const words = text.split(' ')
  const trigger = on === 'mount' ? { animate: { y: 0 } } : { whileInView: { y: 0 }, viewport: { once: true, margin: '-10% 0px' } }

  return (
    <>
      {words.map((word, index) => (
        <span key={word + index}>
          {index > 0 && ' '}
          <span className="-mb-[0.14em] inline-block overflow-hidden pb-[0.14em] align-bottom">
            <motion.span
              className={`inline-block ${index === words.length - 1 && lastClassName ? lastClassName : ''}`}
              initial={{ y: '110%' }}
              {...trigger}
              transition={{ duration: 0.9, delay: delay + index * 0.08, ease: EASE }}
            >
              {word}
            </motion.span>
          </span>
        </span>
      ))}
    </>
  )
}
