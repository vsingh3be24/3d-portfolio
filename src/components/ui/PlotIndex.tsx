import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Reveal, RevealGroup } from "@/components/motion/Reveal";
import { OVERVIEW_ID, plots } from "@/data/plots";
import { profile } from "@/data/profile";
import { site } from "@/data/site";
import { useEstate } from "@/store/useEstate";

// The destinations, in reading order: who, then the work, then the resume.
// Contact is the noticeboard in the park, not a place to go into.
const destinations = [
  ...plots.filter((plot) => plot.kind === "about"),
  ...plots.filter((plot) => plot.kind === "project"),
];

const FADE_SECONDS = 0.2;

// When the element holding focus is removed or hidden — a list swapped for
// the next level's, a panel sliding shut — focus falls back to the top of the
// page. Keyboard users are put back beside where they were instead. Mouse
// users never notice: this only acts when focus has actually been lost.
function focusIfLost(target: HTMLElement | null | undefined) {
  const active = document.activeElement;
  const lost =
    !active ||
    active === document.body ||
    active.closest('[aria-hidden="true"]') !== null;
  if (target && lost) target.focus({ preventScroll: true });
}

// Type only: no borders, no backgrounds. The active item takes the accent and
// a 2px underline that draws in from the left.
function Entry({ active, children }: { active: boolean; children: ReactNode }) {
  return (
    <span
      className={`relative inline-block pb-0.5 transition-colors duration-200 ${active ? "text-accent" : ""}`}
    >
      {children}
      <span
        aria-hidden
        className={`absolute bottom-0 left-0 h-[2px] w-full origin-left bg-accent transition-transform duration-200 ease-out ${
          active ? "scale-x-100" : "scale-x-0"
        }`}
      />
    </span>
  );
}

const itemClass =
  "block py-0.5 text-left font-body text-step-1 text-ink sm:text-step-2";

function Destinations({ returnTo }: { returnTo: RefObject<string | null> }) {
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  useEffect(() => {
    if (returnTo.current) focusIfLost(buttons.current.get(returnTo.current));
  }, [returnTo]);
  const hoveredPlotId = useEstate((state) => state.hoveredPlotId);
  const goToPlot = useEstate((state) => state.goToPlot);
  const setHovered = useEstate((state) => state.setHovered);

  return (
    <nav aria-label="Destinations">
      <RevealGroup>
        <ul className="flex flex-col">
          {destinations.map((plot) => (
            <li key={plot.id}>
              <Reveal>
                <button
                  ref={(button) => {
                    if (button) buttons.current.set(plot.id, button);
                    else buttons.current.delete(plot.id);
                  }}
                  type="button"
                  onClick={() => goToPlot(plot.id)}
                  onMouseEnter={() => setHovered(plot.id)}
                  onMouseLeave={() => setHovered(null)}
                  onFocus={() => setHovered(plot.id)}
                  onBlur={() => setHovered(null)}
                  className={itemClass}
                >
                  <Entry active={plot.id === hoveredPlotId}>{plot.title}</Entry>
                </button>
              </Reveal>
            </li>
          ))}
          <li>
            <Reveal>
              <a
                href={profile.resume}
                target="_blank"
                rel="noreferrer"
                className={`${itemClass} transition-colors duration-200 hover:text-accent`}
              >
                {site.resumeLabel}
              </a>
            </Reveal>
          </li>
        </ul>
      </RevealGroup>
    </nav>
  );
}

// Inside a room the destinations give way to that room's own contents.
// Hovering an exhibit here lights its object in the scene and hovering the
// object lights it here, because both read and write the same store field.
function RoomContents({ plotId }: { plotId: string }) {
  const plot = plots.find((entry) => entry.id === plotId);
  const hoveredExhibitId = useEstate((state) => state.hoveredExhibitId);
  const activeExhibitId = useEstate((state) => state.activeExhibitId);
  const setHoveredExhibit = useEstate((state) => state.setHoveredExhibit);
  const goToExhibit = useEstate((state) => state.goToExhibit);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const lastExhibit = useRef<string | null>(null);

  useEffect(() => {
    focusIfLost(headingRef.current);
  }, []);

  // An exhibit closing hands focus back to its own entry in the list.
  useEffect(() => {
    if (activeExhibitId) lastExhibit.current = activeExhibitId;
    else if (lastExhibit.current)
      focusIfLost(buttons.current.get(lastExhibit.current));
  }, [activeExhibitId]);

  if (!plot) return null;

  // The project's overview comes first where it has one: the way in to the
  // whole story, before the objects in the room.
  const entries = [
    ...(plot.overview ? [{ id: OVERVIEW_ID, name: site.overviewLabel }] : []),
    ...plot.exhibits.map((exhibit) => ({ id: exhibit.id, name: exhibit.name })),
  ];

  return (
    <nav aria-label={`Inside ${plot.title}`}>
      <RevealGroup>
        <Reveal>
          <p className="font-body text-step-0 text-ink/55">{plot.eyebrow}</p>
        </Reveal>
        <Reveal>
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="mt-1 font-display text-step-4 leading-tight text-ink outline-none"
          >
            {plot.roomHeadline}
          </h2>
        </Reveal>
        <Reveal>
          <p className="mt-1 max-w-[34ch] font-body text-step-1 text-ink/70">
            {plot.subhead}
          </p>
        </Reveal>

        <ul className="mt-4 flex flex-col">
          {entries.map((exhibit) => (
            <li key={exhibit.id}>
              <Reveal>
                <button
                  ref={(button) => {
                    if (button) buttons.current.set(exhibit.id, button);
                    else buttons.current.delete(exhibit.id);
                  }}
                  type="button"
                  onClick={() => goToExhibit(exhibit.id)}
                  onMouseEnter={() => setHoveredExhibit(exhibit.id)}
                  onMouseLeave={() => setHoveredExhibit(null)}
                  onFocus={() => setHoveredExhibit(exhibit.id)}
                  onBlur={() => setHoveredExhibit(null)}
                  aria-current={
                    exhibit.id === activeExhibitId ? "true" : undefined
                  }
                  className={itemClass}
                >
                  <Entry
                    active={
                      exhibit.id === hoveredExhibitId ||
                      exhibit.id === activeExhibitId
                    }
                  >
                    {exhibit.name}
                    {exhibit.id === OVERVIEW_ID && (
                      <span
                        aria-hidden
                        className="ml-1.5 inline-block text-accent"
                      >
                        →
                      </span>
                    )}
                  </Entry>
                </button>
              </Reveal>
            </li>
          ))}
        </ul>
      </RevealGroup>
    </nav>
  );
}

// The campus list and a room's list cross-fade into each other: one goes
// out, then the other comes in, so the two never overlap mid-change.
export function PlotIndex() {
  const activePlotId = useEstate((state) => state.activePlotId);
  // The room last visited, so coming back to the campus returns focus to it.
  const lastPlot = useRef<string | null>(null);
  useEffect(() => {
    if (activePlotId) lastPlot.current = activePlotId;
  }, [activePlotId]);

  return (
    <div className="pointer-events-auto">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={activePlotId ?? "campus"}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: FADE_SECONDS }}
        >
          {activePlotId ? (
            <RoomContents plotId={activePlotId} />
          ) : (
            <Destinations returnTo={lastPlot} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
