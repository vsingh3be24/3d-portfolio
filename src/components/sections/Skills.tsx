import { Reveal, RevealOnScroll } from '@/components/motion/Reveal'
import { profile } from '@/data/profile'

export function Skills() {
  return (
    <section id="skills" className="mx-auto max-w-3xl px-6 py-24 sm:px-10 lg:px-0">
      <RevealOnScroll>
        <Reveal>
          <h2 className="font-display text-step-4 text-ink">Skills</h2>
        </Reveal>
        <div className="mt-10 grid grid-cols-1 gap-10 sm:grid-cols-2">
          {profile.skills.map((group) => (
            <Reveal key={group.label}>
              <h3 className="font-body text-step-1 font-medium text-ink/60">{group.label}</h3>
              <ul className="mt-3 flex flex-wrap gap-2">
                {group.items.map((item) => (
                  <li
                    key={item}
                    className="border border-ink/20 px-3 py-1 font-body text-step-0 text-ink transition-colors duration-200 hover:border-accent hover:text-accent"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </Reveal>
          ))}
        </div>
      </RevealOnScroll>
    </section>
  )
}
