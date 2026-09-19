import { CountUp } from "@/components/motion/CountUp";
import { PlotIndex } from "@/components/ui/PlotIndex";
import { profile } from "@/data/profile";
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
    <div className="flex h-full flex-col overflow-y-auto px-6 py-10 sm:px-10 lg:py-8 xl:px-16">
      <div className="my-auto">
        <h1 className="max-w-[14ch] font-display text-step-5 leading-[0.95] tracking-tight text-ink lg:text-step-6 lg:[@media(max-height:860px)]:text-step-5">
          {profile.name}
        </h1>

        <div className="mt-5 h-px w-16 bg-ink" />

        <p className="mt-5 max-w-[38ch] font-body text-step-2 leading-relaxed text-ink/80">
          {profile.role}, {profile.place}. {profile.batch}.
        </p>

        {atCampus && profile.pitch && (
          <p className="mt-4 max-w-[38ch] font-body text-step-1 leading-relaxed text-ink/70">
            {profile.pitch}
          </p>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href={`mailto:${profile.email}`}
            className="border border-ink bg-ink px-5 py-2.5 font-body text-step-0 text-paper"
          >
            Email
          </a>
          <a
            href={profile.github}
            target="_blank"
            rel="noreferrer"
            className="border border-ink px-5 py-2.5 font-body text-step-0 text-ink"
          >
            GitHub
          </a>
          <a
            href={profile.resume}
            target="_blank"
            rel="noreferrer"
            className="border border-ink px-5 py-2.5 font-body text-step-0 text-ink"
          >
            CV
          </a>
        </div>

        {atCampus && (
          <div className="mt-8 flex flex-wrap gap-x-8 gap-y-4">
            {profile.stats.map((stat) => (
              <div key={stat.label}>
                <div className="font-display text-step-4 text-ink">
                  <CountUp value={stat.value} />
                </div>
                <div className="mt-1 max-w-[14ch] font-body text-step-0 leading-tight text-ink/60">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6">
          <PlotIndex />
        </div>
      </div>
    </div>
  );
}
