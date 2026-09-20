import { Reveal, RevealOnScroll } from '@/components/motion/Reveal'
import { Section } from '@/components/layout/Section'
import { chip, rule } from '@/components/ui/styles'
import { profile } from '@/data/profile'
import { site } from '@/data/site'

export function Skills() {
  return (
    <Section id="skills" number={3} label={site.sections.skills.label} title={site.sections.skills.title}>
      <RevealOnScroll className="grid grid-cols-1 gap-x-10 gap-y-9 sm:grid-cols-2">
        {profile.skills.map((group) => (
          <Reveal key={group.label}>
            <h3 className="flex items-baseline gap-2 font-body text-step-1 font-semibold text-ink">
              {group.label}
              <span className="font-body text-step-0 font-normal text-ink/40">{group.items.length}</span>
            </h3>
            <span aria-hidden className={`mt-2 block w-8 ${rule}`} />
            <ul className="mt-3 flex flex-wrap gap-2">
              {group.items.map((item) => (
                <li key={item} className={chip}>
                  {item}
                </li>
              ))}
            </ul>
          </Reveal>
        ))}
      </RevealOnScroll>
    </Section>
  )
}
