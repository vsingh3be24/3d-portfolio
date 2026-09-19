import { CountUp } from "@/components/motion/CountUp";
import { Reveal, RevealGroup } from "@/components/motion/Reveal";
import { PlotIndex } from "@/components/ui/PlotIndex";
import { Magnetic } from "@/components/motion/Magnetic";
import { RisingText } from "@/components/motion/RisingText";
import { Glow } from "@/components/ui/Glow";
import { nudge, pill, rule } from "@/components/ui/styles";
import { profile } from "@/data/profile";
import { site } from "@/data/site";
import { useEstate } from "@/store/useEstate";

// The left half of the hero: who, how to reach them, three numbers, then the
// way into the estate. Inside a room the list at the bottom becomes that
// room's own contents, and the pitch and numbers step aside for it: they
// introduce the campus, and without them the room's list stays in view.
export function IntroColumn() {
  const atCampus = useEstate((state) => state.level === "campus");

  return (
    // Centred with auto margins rather than justify-center: when the column is
    // taller than the screen, this starts at the top and scrolls, instead of
    // spilling off both ends where the name could never be scrolled back to.
    <div className="relative flex h-full flex-col overflow-y-auto overflow-x-hidden px-6 py-10 sm:px-10 lg:py-8 xl:px-16">
      {/* Light from the estate spilling across, behind the name. */}
      <Glow className="-left-24 top-[8%] h-[420px] w-[420px]" />
      <Glow tone="glow" delay={7} className="-right-32 top-[38%] h-[360px] w-[360px]" />
      <RevealGroup className="relative my-auto">
        <Reveal>
          <p className="inline-flex items-center gap-2 rounded-full border border-ink/10 bg-ink/[0.03] py-1 pl-2.5 pr-3.5 font-body text-step-0 text-ink/75">
            <span aria-hidden className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60 motion-reduce:animate-none" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
            </span>
            {site.availability}
          </p>
        </Reveal>

        <h1 className="mt-4 max-w-[14ch] font-display text-step-5 font-semibold leading-[0.95] tracking-[-0.03em] text-ink lg:text-[76px] lg:[@media(max-height:860px)]:text-step-5">
          <RisingText text={profile.name} lastClassName="text-sheen motion-safe:animate-sheen" />
        </h1>

        <Reveal>
          <div className={`mt-5 w-16 ${rule}`} />
        </Reveal>

        <Reveal>
          <p className="mt-4 max-w-[38ch] font-body text-step-2 leading-relaxed text-ink/80">
            {profile.role}, {profile.place}. {profile.batch}.
          </p>
        </Reveal>

        {atCampus && profile.pitch && (
          <Reveal>
            <p className="mt-3 max-w-[40ch] font-body text-step-1 leading-relaxed text-ink/65">
              {profile.pitch}
            </p>
          </Reveal>
        )}

        <Reveal className="mt-6 flex flex-wrap gap-2.5">
          <Magnetic>
            <a href={`mailto:${profile.email}`} className={pill.primary}>
              Email
              <span aria-hidden className={nudge}>
                →
              </span>
            </a>
          </Magnetic>
          <a href={profile.github} target="_blank" rel="noreferrer" className={pill.secondary}>
            GitHub
            <span aria-hidden className={nudge}>
              ↗
            </span>
          </a>
          <a href={profile.resume} target="_blank" rel="noreferrer" className={pill.secondary}>
            CV
            <span aria-hidden className={nudge}>
              ↗
            </span>
          </a>
        </Reveal>

        {atCampus && (
          <Reveal className="mt-7 flex flex-wrap gap-x-8 gap-y-4">
            {profile.stats.map((stat) => (
              <div key={stat.label} className="relative pt-3">
                <span aria-hidden className={`absolute left-0 top-0 w-6 ${rule}`} />
                <div className="font-display text-step-4 font-semibold leading-none tracking-[-0.02em] text-ink">
                  <CountUp value={stat.value} />
                </div>
                <div className="mt-1.5 max-w-[14ch] font-body text-step-0 leading-tight text-ink/55">
                  {stat.label}
                </div>
              </div>
            ))}
          </Reveal>
        )}

        <div className="mt-6">
          <PlotIndex />
        </div>
      </RevealGroup>
    </div>
  );
}
