import { profile } from '@/data/profile'
import { site } from '@/data/site'

export function Footer() {
  return (
    <footer className="border-t border-ink/10">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-10 font-body text-step-0 text-ink/55 sm:flex-row sm:items-center sm:justify-between sm:px-10">
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
