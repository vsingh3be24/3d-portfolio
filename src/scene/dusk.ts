import { Color, Vector3 } from 'three'
import { themes, type PaletteToken } from '@/theme'
import { DUSK } from './constants'

// Where the dusk sequence has got to, shared by everything that takes part in
// it. The controller in Lighting advances it; everything else only reads.
export const dusk = {
  // Seconds into the sequence: 0 is full day, DUSK.duration is full dusk.
  time: 0,
  // Where the camera stood when the current toggle began, which is what the
  // window cascade orders itself by. The epoch changes with every toggle.
  origin: new Vector3(),
  epoch: 0,
}

export function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1)
}

export function smooth(value: number): number {
  const t = clamp01(value)
  return t * t * (3 - 2 * t)
}

// Progress of a stage of the sequence that runs from start to end.
export function stage(start: number, end: number): number {
  return smooth((dusk.time - start) / (end - start))
}

// A material colour that cross-fades with the sky. Registered once at the
// point the material is made, so no component needs to know dusk exists.
type Tracked = { colour: Color; day: Color; dusk: Color }
const tracked: Tracked[] = []
// The level last applied. A colour registered after that — a material made
// late, or remade by a hot reload — starts at it rather than waiting, unset,
// for the next theme change.
let appliedLevel = 0

function track(entry: Tracked): void {
  tracked.push(entry)
  entry.colour.lerpColors(entry.day, entry.dusk, appliedLevel)
}

export function trackColour(colour: Color, token: PaletteToken): void {
  track({ colour, day: new Color(themes.day[token]), dusk: new Color(themes.dusk[token]) })
}

// For a textured material whose map already carries the day colour: the
// colour becomes a multiplier that takes the map from day to dusk.
export function trackTint(colour: Color, token: PaletteToken): void {
  const day = new Color(themes.day[token])
  const target = new Color(themes.dusk[token])
  const ratio = new Color(target.r / day.r, target.g / day.g, target.b / day.b)
  track({ colour, day: new Color(1, 1, 1), dusk: ratio })
}

// How far the surface colours have gone towards dusk. Capped below 1 by
// design: surfaces only travel part of the way, since dimmed lights do the rest.
export function colourLevel(): number {
  return appliedLevel
}

// How far the sky has gone from day to dusk: the whole way, 0 to 1. For
// anything that follows the time of day rather than the surface palette.
export function duskLevel(): number {
  return stage(0, DUSK.colourEnd)
}

export function applyColours(level: number): void {
  appliedLevel = level
  for (const entry of tracked) entry.colour.lerpColors(entry.day, entry.dusk, level)
}

// Window cascade: the step a window at this distance comes on in, as a delay
// into the cascade. Quantised, so neighbours at similar range light together.
export function cascadeDelay(distance: number, nearest: number, farthest: number): number {
  const span = Math.max(farthest - nearest, 1e-3)
  const raw = ((distance - nearest) / span) * DUSK.cascadeSpan
  return Math.floor(raw / DUSK.cascadeStep) * DUSK.cascadeStep
}
