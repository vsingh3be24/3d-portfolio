import { MotionConfig } from 'framer-motion'
import { Hero } from '@/components/layout/Hero'
import { About } from '@/components/sections/About'
import { Projects } from '@/components/sections/Projects'
import { Skills } from '@/components/sections/Skills'
import { Timeline } from '@/components/sections/Timeline'
import { Contact } from '@/components/sections/Contact'
import { useThemeVariables } from '@/hooks/useThemeVariables'

function App() {
  useThemeVariables()

  // Every entrance and reveal on the page steps aside for reduced motion.
  return (
    <MotionConfig reducedMotion="user">
      <Hero />
      <About />
      <Projects />
      <Skills />
      <Timeline />
      <Contact />
    </MotionConfig>
  )
}

export default App
