// The single source of identity for the whole site: palette and type.
//
// Nothing about a specific person or project belongs here, and no component may
// hardcode a colour. Swapping the values below is meant to be the entire job of
// re-skinning the site for a second instance.

export type Palette = {
  // The sky around the estate: overhead, at the horizon, and the void below
  // the slab, which is most of what the camera sees around the model.
  skyZenith: string
  skyHorizon: string
  groundFar: string
  // The model itself.
  slabTop: string
  slabEdge: string
  // Roads and markings.
  road: string
  roadMark: string
  kerb: string
  // Building surfaces. Every roof colour is one plot's identity — it is how a
  // tab-bar swatch points at a building — so no two plots may share one.
  sand: string
  clay: string
  indigo: string
  sage: string
  ochre: string
  plum: string
  charcoal: string
  // Planting and water.
  grassDark: string
  hedge: string
  trunk: string
  foliage: string
  foliageDark: string
  water: string
  path: string
  // Glazing. Dusk is the only time windowLit is doing any work.
  windowDark: string
  windowLit: string
  // Plot pads.
  pad: string
  padHighlight: string
  // Type and trim.
  ink: string
  paper: string
  // Interior furnishing.
  wood: string
  woodDark: string
  fabric: string
  rug: string
  pot: string
  leaf: string
  screenFrame: string
  screenBg: string
  shelfBlock: string
  brass: string
}

// A bright midday society. Chosen over a night-first scheme because it reads as
// friendlier in a five-second scan and is legible before the visitor has
// touched anything.
const day: Palette = {
  // A clear sky overhead, a bright haze at the horizon, and a soft blue below
  // the slab for the estate to float in. Shown exactly: the sky is not tone
  // mapped.
  skyZenith: '#8ab8dc',
  skyHorizon: '#e6eef0',
  groundFar: '#bfd5e1',
  slabTop: '#b9cf9e',
  slabEdge: '#a08767',
  road: '#7b8189',
  roadMark: '#eef0e6',
  kerb: '#cfc9b8',
  sand: '#ede2cc',
  clay: '#c2603f',
  indigo: '#3d5a80',
  sage: '#6d9a6a',
  // Chosen to sit apart in hue from the three above rather than between them,
  // so six roofs stay six distinct swatches at campus distance.
  ochre: '#c9973e',
  plum: '#7b4b6a',
  charcoal: '#4b4f57',
  grassDark: '#a3bd88',
  hedge: '#587f45',
  trunk: '#7a5b42',
  foliage: '#5c8a4a',
  foliageDark: '#4a7440',
  water: '#6f9fb5',
  path: '#d8d0bd',
  windowDark: '#2a3a4a',
  windowLit: '#e8f0f8',
  pad: '#a8c485',
  padHighlight: '#c6dda2',
  ink: '#212934',
  paper: '#f3efe6',
  wood: '#a88153',
  woodDark: '#6f5233',
  fabric: '#5b6b7c',
  rug: '#b26a5e',
  pot: '#b5765a',
  leaf: '#4e8a52',
  screenFrame: '#2a3038',
  screenBg: '#12181f',
  shelfBlock: '#c9b48c',
  brass: '#c8a44e',
}

// The toggle. Windows and streetlights are the whole point of it, so anything
// that glows keeps its value while the surfaces around it fall away.
const dusk: Palette = {
  ...day,
  skyZenith: '#101a2e',
  skyHorizon: '#2e2b47',
  groundFar: '#141b2b',
  slabTop: '#3e5545',
  slabEdge: '#2b2620',
  road: '#333a44',
  roadMark: '#5b6470',
  kerb: '#4a4f52',
  sand: '#6f6960',
  grassDark: '#33452f',
  hedge: '#2f4a2c',
  trunk: '#3f3229',
  foliage: '#2f4a32',
  foliageDark: '#263c29',
  water: '#2f4a5c',
  path: '#4a4740',
  windowDark: '#1b2430',
  windowLit: '#ffd9a0',
  pad: '#35492f',
  padHighlight: '#445c3a',
  paper: '#f0ece2',
}

export const themes = { day, dusk } as const
export type ThemeName = keyof typeof themes

// Data refers to colours by name, never by value, so a theme swap — or the dusk
// toggle re-resolving against its own palette — reaches every building.
export type PaletteToken = keyof Palette

// One accent, in both modes, used sparingly: active states, the wordmark dot,
// the exhibit claim line.
export const ACCENT = '#c2603f'

// The page's own colours, which follow the theme the same as the scene does.
// ink is type, paper is the page and any surface type sits on, sky is the
// void behind the slab. At dusk type goes light on dark.
// onAccent is type laid on the accent itself, light in both themes.
export type UiColours = { ink: string; paper: string; sky: string; onAccent: string }

export const ui: Record<ThemeName, UiColours> = {
  day: { ink: day.ink, paper: day.paper, sky: day.groundFar, onAccent: day.paper },
  dusk: { ink: dusk.paper, paper: '#1f2735', sky: dusk.groundFar, onAccent: dusk.paper },
}

export const TYPE = {
  display: "'Bricolage Grotesque', sans-serif",
  body: "'Inter', sans-serif",
  scale: [12, 14, 16, 20, 28, 44, 68] as const,
  maxLineLength: 62,
} as const

// The palette the scene is built against. The dusk toggle swaps material and
// vertex colours at runtime rather than rebuilding geometry, so this stays the
// construction-time reference.
export const palette = day
