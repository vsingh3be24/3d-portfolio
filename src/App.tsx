import { MotionConfig } from 'framer-motion'
import { Hero } from '@/components/layout/Hero'
import { About } from '@/components/sections/About'
import { Projects } from '@/components/sections/Projects'
import { Skills } from '@/components/sections/Skills'
import { Timeline } from '@/components/sections/Timeline'
import { Contact } from '@/components/sections/Contact'
import { Footer } from '@/components/sections/Footer'
import { Marquee } from '@/components/sections/Marquee'
import { ScrollProgress } from '@/components/ui/ScrollProgress'
import { useThemeVariables } from '@/hooks/useThemeVariables'

function App() {
  useThemeVariables()

  // Every entrance and reveal on the page steps aside for reduced motion.
  return (
    <MotionConfig reducedMotion="user">
      <ScrollProgress />
      <Hero />
      {/* Everything below the estate sits on one grained surface. */}
      <div className="grain relative">
        <About />
        <Projects />
        <Marquee />
        <Skills />
        <Timeline />
        <Contact />
        <Footer />
      </div>
    </MotionConfig>
  )
}

export default App
