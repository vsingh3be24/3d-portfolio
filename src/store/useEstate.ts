import { create } from 'zustand'
import { site } from '@/data/site'
import type { ThemeName } from '@/theme'

const THEME_KEY = 'estate.theme'
const PAUSED_KEY = 'estate.paused'

// Storage can be missing or throw (private windows, blocked site data), and
// the site must still open, in daylight and moving, when it does.
function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function storedTheme(): ThemeName | null {
  const stored = read(THEME_KEY)
  return stored === 'day' || stored === 'dusk' ? stored : null
}

function write(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Remembering is a convenience; the control still works for this visit.
  }
}

// Where the visitor is: the whole estate, inside one plot's room, or looking
// at one exhibit in that room. Set together with the ids in every action, so
// the level and the ids can never disagree.
export type Level = 'campus' | 'interior' | 'exhibit'

// The campus view the visitor left from, restored when they come back to it.
// The campus is always looked at from its centre, so the angles and distance
// are the whole of it.
export type CampusCamera = { theta: number; phi: number; radius: number }

type EstateState = {
  level: Level
  activePlotId: string | null
  // The exhibit whose panel is open. Only ever set inside the active plot.
  activeExhibitId: string | null
  theme: ThemeName
  // Freezes every ambient motion: traffic and the idle drift. Camera moves the
  // visitor asks for still run.
  paused: boolean
  // Until the visitor deliberately interacts, the canvas stays out of the way:
  // the wheel scrolls the page and a touch swipe scrolls it too.
  hasInteracted: boolean
  campusCamera: CampusCamera | null
  hoveredPlotId: string | null
  // One field for both the object in the room and its entry in the list, which
  // is what makes hovering either one light up the other.
  hoveredExhibitId: string | null
  // Bumped to ask the camera to reframe its current level. A counter rather
  // than a flag, so asking twice in a row still reaches the camera twice.
  resetRequest: number

  goToPlot: (id: string) => void
  goToExhibit: (id: string) => void
  backToInterior: () => void
  backToCampus: () => void
  // Steps back exactly one level: exhibit to room, room to campus.
  back: () => void
  markInteracted: () => void
  setCampusCamera: (view: CampusCamera | null) => void
  setHovered: (id: string | null) => void
  setHoveredExhibit: (id: string | null) => void
  toggleTheme: () => void
  togglePaused: () => void
  requestReset: () => void
}

export const useEstate = create<EstateState>()((set, get) => ({
  level: 'campus',
  activePlotId: null,
  activeExhibitId: null,
  theme: storedTheme() ?? site.defaultTheme,
  paused: read(PAUSED_KEY) === 'true',
  hasInteracted: false,
  campusCamera: null,
  hoveredPlotId: null,
  hoveredExhibitId: null,
  resetRequest: 0,

  // Entering a room never carries an exhibit over from the last one.
  goToPlot: (id) =>
    set({
      level: 'interior',
      activePlotId: id,
      activeExhibitId: null,
      hoveredExhibitId: null,
      // The building gives way to its room, so the pointer never leaves it
      // and its hover would otherwise stay set for the whole visit.
      hoveredPlotId: null,
      hasInteracted: true,
    }),

  goToExhibit: (id) =>
    set((state) => (state.activePlotId ? { level: 'exhibit', activeExhibitId: id } : state)),

  backToInterior: () =>
    set((state) => (state.activePlotId ? { level: 'interior', activeExhibitId: null } : state)),

  backToCampus: () =>
    set({ level: 'campus', activePlotId: null, activeExhibitId: null, hoveredExhibitId: null }),

  back: () => {
    const { level, backToInterior, backToCampus } = get()
    if (level === 'exhibit') backToInterior()
    else if (level === 'interior') backToCampus()
  },

  markInteracted: () => set({ hasInteracted: true }),

  setCampusCamera: (view) => set({ campusCamera: view }),

  setHovered: (id) => set({ hoveredPlotId: id }),

  setHoveredExhibit: (id) => set({ hoveredExhibitId: id }),

  toggleTheme: () =>
    set((state) => {
      const theme = state.theme === 'day' ? 'dusk' : 'day'
      write(THEME_KEY, theme)
      return { theme }
    }),

  togglePaused: () =>
    set((state) => {
      write(PAUSED_KEY, String(!state.paused))
      return { paused: !state.paused }
    }),

  requestReset: () => set((state) => ({ resetRequest: state.resetRequest + 1 })),
}))
