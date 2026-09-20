import { Color, Vector2, Vector3 } from 'three'
import { plots } from '@/data/plots'
import { BUSHES, COMMUNITY, ESTATE, PARK, ROAD, SLAB, TREES } from './constants'
import { getPointAt, roadJunctions } from './curves'
import { gateAnchor, isOnSlab } from './slab'
import type { TreeSpecies } from './trees'

// Where everything that grows on the estate stands. Kept apart from the props
// that draw it, because the grass is painted with the shade of that same
// planting and so has to know where it is too.

// Small deterministic PRNG: the estate must lay out identically on every load.
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type TreePlacement = { x: number; z: number; scale: number; rotation: number; species: TreeSpecies; tint: Color }

// Sampled across the whole slab rather than in an annulus, because the rounded
// corners of the slab are exactly where an annulus leaves bald patches.
// Points along the ring road and the approach from the gate, which nothing
// planted may stand too close to.
let roadSamplesCache: Vector2[] | null = null

function roadSamples(): Vector2[] {
  if (roadSamplesCache) return roadSamplesCache

  const samples: Vector2[] = []
  const point = new Vector3()
  for (let index = 0; index < 260; index += 1) {
    getPointAt(index / 260, point)
    samples.push(new Vector2(point.x, point.z))
  }

  // The approach from the gate is road too, so it needs the same clearance.
  const gate = gateAnchor()
  getPointAt(roadJunctions().gate.u, point)
  for (let index = 0; index <= 24; index += 1) {
    const t = index / 24
    samples.push(new Vector2(gate.x + (point.x - gate.x) * t, gate.z + (point.z - gate.z) * t))
  }

  roadSamplesCache = samples
  return samples
}

function placeTrees(): TreePlacement[] {
  const random = mulberry32(ESTATE.treeSeed)
  const placements: TreePlacement[] = []
  const road = roadSamples()

  const plotPoints = plots.map((plot) => new Vector2(plot.position[0], plot.position[2]))
  const pond = new Vector2(PARK.pondCentre[0], PARK.pondCentre[1])
  const community = new Vector2(COMMUNITY.position[0], COMMUNITY.position[2])
  const candidate = new Vector2()
  const roadClearance = ROAD.width / 2 + ROAD.kerbWidth + ESTATE.treeClearanceFromRoad

  let attempts = 0
  while (placements.length < ESTATE.treeCount && attempts < 20000) {
    attempts += 1

    candidate.set((random() - 0.5) * SLAB.width, (random() - 0.5) * SLAB.depth)

    if (!isOnSlab(candidate.x, candidate.y, ESTATE.treeSlabMargin)) continue
    if (candidate.distanceTo(pond) < PARK.pondRadius + ESTATE.treeClearanceFromPond) continue
    if (candidate.distanceTo(community) < COMMUNITY.width) continue
    if (road.some((sample) => sample.distanceTo(candidate) < roadClearance)) continue
    if (plotPoints.some((plot) => plot.distanceTo(candidate) < ESTATE.treeClearanceFromPlot)) continue
    if (
      placements.some(
        (tree) => Math.hypot(tree.x - candidate.x, tree.z - candidate.y) < ESTATE.treeMinSpacing,
      )
    ) {
      continue
    }

    // Keep the ring of grass around the pond path clear so the walk reads.
    const fromCentre = candidate.length()
    if (fromCentre > PARK.pathInnerRadius - 0.6 && fromCentre < PARK.pathOuterRadius + 0.6) continue

    placements.push({
      x: candidate.x,
      z: candidate.y,
      scale: 0.75 + random() * 0.6,
      rotation: random() * Math.PI * 2,
      species: 'broadleaf',
      tint: new Color(),
    })
  }

  // Species and colour come from their own stream, so choosing them never
  // moves a tree that the placement above already settled.
  const look = mulberry32(TREES.speciesSeed)
  for (const tree of placements) {
    const pick = look()
    const { broadleaf, conifer } = TREES.species
    tree.species = pick < broadleaf ? 'broadleaf' : pick < broadleaf + conifer ? 'conifer' : 'column'
    const brightness = 1 + (look() * 2 - 1) * TREES.brightnessRange
    const warmth = (look() * 2 - 1) * TREES.warmthRange
    tree.tint.setRGB(brightness * (1 + warmth), brightness, brightness * (1 - warmth))
  }

  return placements
}

export type ShrubPlacement = { x: number; z: number; scale: number; rotation: number; tint: Color }

// Shrubs shelter under the trees: each one picks a tree and sits a little way
// off it, wherever that spot is clear of the road, the plots and the water.
function placeShrubs(trees: TreePlacement[]): ShrubPlacement[] {
  const random = mulberry32(BUSHES.seed)
  const shrubs: ShrubPlacement[] = []
  if (trees.length === 0) return shrubs

  const pond = new Vector2(PARK.pondCentre[0], PARK.pondCentre[1])
  const plotPoints = plots.map((plot) => new Vector2(plot.position[0], plot.position[2]))
  const [near, far] = BUSHES.spread
  const [small, large] = BUSHES.scale
  const road = roadSamples()
  const roadClearance = ROAD.width / 2 + ROAD.kerbWidth + BUSHES.clearance
  const spot = new Vector2()

  let attempts = 0
  while (shrubs.length < BUSHES.count && attempts < 4000) {
    attempts += 1
    const tree = trees[Math.floor(random() * trees.length)]
    const angle = random() * Math.PI * 2
    const distance = near + random() * (far - near)
    spot.set(tree.x + Math.cos(angle) * distance, tree.z + Math.sin(angle) * distance)

    if (!isOnSlab(spot.x, spot.y, ESTATE.treeSlabMargin)) continue
    if (road.some((sample) => sample.distanceTo(spot) < roadClearance)) continue
    if (spot.distanceTo(pond) < PARK.pondRadius + BUSHES.clearance) continue
    if (plotPoints.some((plot) => plot.distanceTo(spot) < ESTATE.treeClearanceFromPlot)) continue
    // Off the ring road and off the park's walk.
    const fromCentre = spot.length()
    if (fromCentre > PARK.pathInnerRadius - BUSHES.clearance && fromCentre < PARK.pathOuterRadius + BUSHES.clearance) {
      continue
    }
    if (shrubs.some((other) => Math.hypot(other.x - spot.x, other.z - spot.y) < BUSHES.clearance)) continue

    const brightness = 1 + (random() * 2 - 1) * TREES.brightnessRange
    const warmth = (random() * 2 - 1) * TREES.warmthRange
    shrubs.push({
      x: spot.x,
      z: spot.y,
      scale: small + random() * (large - small),
      rotation: random() * Math.PI * 2,
      tint: new Color(brightness * (1 + warmth), brightness, brightness * (1 - warmth)),
    })
  }

  return shrubs
}


let plantedTrees: TreePlacement[] | null = null
let plantedShrubs: ShrubPlacement[] | null = null

export function trees(): TreePlacement[] {
  if (!plantedTrees) plantedTrees = placeTrees()
  return plantedTrees
}

export function shrubs(): ShrubPlacement[] {
  if (!plantedShrubs) plantedShrubs = placeShrubs(trees())
  return plantedShrubs
}
