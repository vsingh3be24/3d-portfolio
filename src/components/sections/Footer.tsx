import { profile } from '@/data/profile'
import { site } from '@/data/site'

const firstName = profile.name.split(' ')[0]

// The page signs off with the name set huge and fading into the floor, over
// the small print.
export function Footer() {
  return (
    <footer className="relative overflow-hidden border-t border-ink/10">
      <p
        aria-hidden
        className="pointer-events-none select-none text-center font-display text-[24vw] font-bold leading-[0.8] tracking-[-0.05em] sm:text-[19vw]"
        style={{
          backgroundImage: 'linear-gradient(180deg, rgb(var(--ui-ink) / 0.13), rgb(var(--ui-ink) / 0))',
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          color: 'transparent',
        }}
      >
        {firstName}
      </p>
      <div className="relative mx-auto -mt-[6vw] flex max-w-6xl flex-col gap-4 px-6 pb-10 font-body text-step-0 text-ink/55 sm:flex-row sm:items-center sm:justify-between sm:px-10">
        <p>
          © {new Date().getFullYear()} {profile.name} · {profile.location}
        </p>
        <p className="sm:text-center">{site.builtNote}</p>
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="group inline-flex items-center gap-1.5 self-start text-ink/70 transition-colors hover:text-accent sm:self-auto"
        >
          {site.backToTop}
          <span aria-hidden className="transition-transform duration-200 group-hover:-translate-y-0.5">
            ↑
          </span>
        </button>
      </div>
    </footer>
  )
}
