import { palette } from '@/theme'

// Scene geometry. The estate reads from the middle out: park, ring road, then
// the plots facing inward from beyond it.
export const SCENE = {
  // Control radii for the ring road loop. Varying them gives the curvature the
  // cars bank into; the list is fixed so the layout is identical every load.
  roadControlRadii: [11.9, 11.4, 10.9, 10.8, 11.1, 11.7, 11.8, 11.2],
} as const

// The floating slab. Its thick exposed edge is what makes the estate read as a
// model on a table rather than a world with a horizon, so the edge is the one
// dimension worth being generous with.
export const SLAB = {
  width: 38,
  depth: 38,
  cornerRadius: 6,
  thickness: 1.05,
  // A slight chamfer catches the light where grass meets soil, so the two
  // materials never meet in a hard black line.
  bevel: 0.09,
  bevelSegments: 2,
  // Resolution of the rounded corners.
  curveSegments: 14,
  // Everything on the model is laid out relative to a top surface at y = 0, so
  // the road and prop heights never need to know the slab is there at all.
  topY: 0,
  // Usable ground stops short of the lip, so nothing hangs over the edge.
  margin: 1.6,
  // The slab floats, so its shadow lands on nothing: one large blurred plane
  // below it does the whole job of grounding the model in the void.
  shadowDrop: 1.5,
  shadowScale: 1.16,
  shadowOpacity: 0.17,
  shadowTextureSize: 256,
} as const

// The grass painted onto the slab's top face.
export const GROUND = {
  grassTextureSize: 1024,
  grassSeed: 48221,
  // Patches of lighter and darker green, as a share of the texture's width.
  patchCount: 220,
  patchRadius: [0.02, 0.1] as [number, number],
  patchOpacity: [0.08, 0.26] as [number, number],
  // How far the lighter patches are lifted towards white.
  patchLift: 0.22,
  // The darkening towards the lip, over the patches.
  falloffOpacity: 0.7,
  anisotropy: 8,
  // Where a crown meets the grass. A shadow cast from one direction alone
  // never darkens the ground right under a trunk, so the planting's own
  // shade is painted into the lawn: the light a crown keeps off the ground
  // right beneath itself. Radii are multiples of the plant's own scale.
  treeShadeRadius: 1.3,
  shrubShadeRadius: 0.75,
  treeShadeOpacity: 0.42,
  shrubShadeOpacity: 0.3,
} as const

// Road. Every surface gets its own y so no two are ever coplanar.
export const ROAD = {
  width: 2.4,
  laneOffset: 0.6,
  // Samples round the loop for each lane's length relative to the centreline.
  laneStretchSamples: 512,
  kerbWidth: 0.35,
  dashLength: 0.6,
  dashGap: 0.4,
  dashWidth: 0.11,
  // Resolution of the ribbon. High enough that the outer edge reads as a smooth
  // curve rather than a polygon at the closest camera distance.
  segments: 260,
  kerbY: 0.03,
  roadY: 0.06,
  dashY: 0.08,
  arcLengthDivisions: 2000,
} as const

export const DRIVEWAY = {
  width: 1.5,
  // Above the kerb it crosses, below nothing else.
  y: 0.05,
} as const

export type VehicleBody = 'sedan' | 'suv'

export const TRAFFIC = {
  // Three one way round the ring, two the other. Each car's cruising speed is
  // baseSpeed times its scale; start is where round the loop it begins.
  vehicles: [
    { direction: 1, start: 0, speedScale: 1, colour: '#c2603f', body: 'sedan' },
    { direction: 1, start: 0.36, speedScale: 0.9, colour: '#37506b', body: 'suv' },
    { direction: 1, start: 0.68, speedScale: 0.95, colour: '#e9e4d8', body: 'sedan' },
    { direction: -1, start: 0.18, speedScale: 0.97, colour: '#6b7f5a', body: 'suv' },
    { direction: -1, start: 0.6, speedScale: 0.92, colour: '#9aa3ad', body: 'sedan' },
  ] as { direction: number; start: number; speedScale: number; colour: string; body: VehicleBody }[],
  baseSpeed: 3.2,
  // A touch of wander so they never look metronomic.
  wanderAmplitude: 0.06,
  wanderFrequency: 0.8,
  // Following: a car closes on the one ahead until the gap between them is
  // followGap, and never lets it shrink below stopGap. Accelerating is gentler
  // than braking, as in a real car.
  followGap: 3.2,
  stopGap: 1.1,
  acceleration: 1.8,
  braking: 4.5,
  // How quickly the brake lights come on and fade.
  brakeLightRate: 8,
  maxBank: 0.052,
  bankScale: 9,
  wheelRadius: 0.13,
  wheelWidth: 0.12,
  hubRadius: 0.075,
  track: 0.74,
  wheelbase: 1.0,
  bodyWidth: 0.8,
  // Side profiles as [along, up] points, front to the right. The lower body
  // carries the paint, the cabin is glass, and a thin painted roof sits on it.
  sedan: {
    lower: [[-0.86, 0.12], [-0.86, 0.38], [-0.76, 0.46], [0.5, 0.46], [0.86, 0.39], [0.86, 0.12]] as [number, number][],
    cabin: [[-0.46, 0.46], [-0.24, 0.7], [0.18, 0.7], [0.46, 0.46]] as [number, number][],
    roof: { from: -0.22, to: 0.16, top: 0.7 },
    lightY: 0.34,
  },
  suv: {
    lower: [[-0.9, 0.12], [-0.9, 0.5], [0.62, 0.5], [0.9, 0.44], [0.9, 0.12]] as [number, number][],
    cabin: [[-0.86, 0.5], [-0.8, 0.84], [0.28, 0.84], [0.58, 0.5]] as [number, number][],
    roof: { from: -0.8, to: 0.26, top: 0.84 },
    lightY: 0.4,
  },
  cabinWidth: 0.7,
  roofThickness: 0.035,
  bodyBevel: 0.03,
  glass: '#26313b',
  trim: '#2b2f33',
  hub: '#b9bec4',
  headlight: '#f4efe2',
  taillight: '#b3322a',
  // Emitted light, by colour, once the lamps are on at dusk. Tail lights
  // glow dimly at night and fully under braking at any time of day.
  headlightGlow: '#fff1cc',
  taillightGlow: '#ff3b2a',
  headlightStrength: 2.4,
  taillightNight: 0.55,
  taillightStrength: 2.2,
  // The pool of headlight thrown on the road ahead at dusk.
  beamLength: 2.6,
  beamWidth: 1.3,
  beamAhead: 1.9,
  beamY: 0.094,
  beamOpacity: 0.55,
  beamTextureSize: 64,
  // Cars don't cast real shadows: they move every frame, and a moving caster
  // would force the whole shadow map to redraw every frame. A soft blob under
  // each one grounds it instead, drawn just above the road markings.
  blobLength: 2.0,
  blobWidth: 1.05,
  blobY: 0.092,
  blobOpacity: 0.32,
  blobTextureSize: 64,
} as const

// Camera
export const CAMERA = {
  fov: 50,
  near: 0.1,
  far: 150,
  // Distance is set by the narrowest viewport the canvas gets: the desktop
  // right column is taller than wide, so horizontal FOV frames the plinth.
  homePosition: [20.4, 31.5, 50.6] as [number, number, number],
  homeTarget: [0, 0, 0] as [number, number, number],
  defaultDistance: 63,
  minDistance: 28,
  maxDistance: 88,
  minPolarAngle: 0.5,
  maxPolarAngle: 1.35,
  rotateSpeed: 0.55,
  zoomSpeed: 0.7,
  // Share of drag momentum still left one second after letting go: 0.94 per
  // frame at 60fps. Applied per second rather than per frame, so the glide is
  // the same length at 60Hz or 120Hz and a dropped frame doesn't stall it.
  dampingDecay: Math.pow(0.94, 60),
  idleDriftSpeed: 0.015,
  // Seconds untouched at campus level before the camera starts to drift.
  idleDelay: 5,
  // A backgrounded tab resumes with one enormous delta; clamping it stops the
  // drift from lurching on the first frame back.
  maxFrameDelta: 0.05,
} as const

// Every camera move is a fixed-duration eased tween off elapsed time, one per
// kind of move between levels.
export const FLIGHT = {
  // Campus into a room, and back out to where the visitor left the campus.
  enterSeconds: 1.2,
  exitSeconds: 1.2,
  // Room to exhibit and back: the room slides aside for the panel.
  shiftSeconds: 0.6,
  // Room to a different room: up through campus altitude, then down.
  hopSeconds: 1.8,
  // Peak of a hop, as a fraction of the default campus distance, and how far
  // toward looking straight down the camera tilts at that peak.
  hopRadiusFactor: 0.55,
  hopPhi: 0.72,
  // Slack on the safety timer that lands a flight whose frames stopped coming.
  settleGraceSeconds: 0.05,
  // An interrupting flight inherits the camera's velocity, measured over at
  // least the first span and forgotten if the last sample is older than the
  // second.
  // No flight ever takes the camera below floorHeight. Within cushion of it
  // the descent eases off smoothly rather than stopping against a hard line.
  floorHeight: 1.2,
  floorCushion: 1.5,
  velocitySampleSeconds: 0.008,
  velocityStaleSeconds: 0.2,
} as const

// How the camera frames a selected plot. Every value is derived from the plot's
// own geometry, so no building ever needs a hand-placed camera.
export const FOCUS = {
  // Distance as a multiple of the room's larger floor dimension.
  roomDistanceScale: 2.0,
  elevation: 0.62,
  // Swings off the radial axis toward the room's open corner. The room builds
  // its walls on the far two sides, so this sign and the walls must agree.
  azimuthOffset: 0.6,
  // Look-at height as a fraction of the room's height.
  targetHeightFactor: 0.38,
  // With an exhibit's panel open on desktop, the room is framed in the strip
  // the panel leaves. panelFraction is the share of the scene's width the
  // panel covers, and must match PlotPanel's own width; exhibitFill is how
  // much of the remaining strip the room spans.
  panelFraction: 0.55,
  exhibitFill: 0.72,
  minDistanceFactor: 0.6,
  maxDistanceFactor: 1.8,
  // Half-width, in radians, of the orbit allowed inside a room.
  roomAzimuthArc: 0.55,
} as const

// Lighting. The directional light keeps its distance from the estate as it
// moves, so the shadow frustum below still encloses the slab at dusk.
export const LIGHTING = {
  // More sun against less sky fill: the same overall brightness, but shadows
  // that read as sunlight rather than overcast.
  hemiIntensity: 0.62,
  hemiSky: "#dcecf5",
  hemiGround: "#6f7a5c",
  directionalIntensity: 1.35,
  directionalColor: "#fff0d9",
  // Far enough out that the shadow frustum stays tight around the estate.
  directionalPosition: [26, 34, 20] as [number, number, number],
  // Four times the texels across the same ground as before, so an edge is a
  // line rather than a gradient. Redrawn only on request, so the extra
  // resolution costs memory rather than frames; weaker devices keep the old
  // size, where the memory matters more than the edge does.
  shadowMapSize: 4096,
  shadowMapSizeLowTier: 2048,
  shadowBias: -0.00035,
  shadowNormalBias: 0.02,
  // PCFSoftShadowMap was removed in three r186, so softness comes from the PCF
  // kernel radius instead. Cheaper than PCSS, which the frame budget rules out.
  // In texels, so at the higher resolution this is a narrower penumbra too.
  shadowRadius: 1.8,
  shadowExtent: 24,
  shadowNear: 20,
  shadowFar: 80,
} as const

// The dusk toggle: one timeline, played forward into dusk and backward out of
// it, so reversing midway simply turns round wherever it has got to. Times are
// seconds from the start of the sequence.
export const DUSK = {
  duration: 1.4,
  // Sky and slab cross-fade. Surfaces travel only this far toward their dusk
  // colours, because the dimmed lights darken them as well; the sky, which no
  // light touches, goes all the way.
  colourEnd: 0.9,
  surfaceFade: 0.55,
  // The sun dims, warms and drops.
  lightEnd: 1.0,
  // Windows come on in steps of cascadeStep, nearest the camera first, each
  // step fading in over windowFade.
  cascadeStart: 0.3,
  cascadeSpan: 0.72,
  cascadeStep: 0.04,
  windowFade: 0.14,
  // Streetlights last.
  lampStart: 1.02,
  lampEnd: 1.4,

  // Night is lit by a cool moon rather than a low warm sun, so everything
  // warm in the frame is a light someone switched on.
  sunElevationDusk: 0.62,
  sunColourDusk: '#9fb6de',
  sunIntensityDusk: 0.42,
  hemiSkyDusk: '#6d82b0',
  hemiGroundDusk: '#34332f',
  hemiIntensityDusk: 0.8,

  windowGlow: 1.8,
  lampGlow: 2.9,
  poolRadius: 2.6,
  poolOpacity: 0.5,
  poolY: 0.09,
  poolTextureSize: 128,
} as const

// The first sight of the estate. The camera arrives from high up and round
// to one side, sweeping down into the home view as the loading screen fades;
// arriving at dusk, the estate is shown dark and its lights come on around
// the camera as it settles. Skipped for reduced motion, paused motion, and a
// link straight into a building.
export const INTRO = {
  seconds: 3.6,
  // The start of the sweep, relative to the home view: this much further out,
  // looking this steeply down (polar angle from straight up), and swung this
  // far round the estate.
  radiusScale: 1.5,
  phi: 0.42,
  swing: -1.25,
  // Arrival eases out: quick while the loading screen is still fading, then
  // a long settle. The power of the ease.
  easePower: 3,
  // The lights wait this long after the reveal, then run the dusk sequence's
  // window cascade and streetlights this much slower than a toggle does.
  lightsDelay: 0.55,
  lightsRate: 0.55,
} as const

// The finishing pass over the rendered frame. Bright lights bleed a soft glow
// into the dark around them, the corners fall off a little, and a fine grain
// keeps the dark sky free of banding. The glow is the dusk's: it rises as the
// lights come on and is gone by day, when there is nothing lit to glow.
export const POSTFX = {
  // Glow is gathered from what is brighter than this (0 to 1, as displayed),
  // easing in over the knee so nothing pops as it crosses the line.
  threshold: 0.6,
  knee: 0.25,
  // Blur levels, each half the size of the one before, from half resolution.
  levels: 5,
  // How far each level spreads, and how strongly the glow is added back.
  radius: 0.9,
  strength: 2.2,
  // Share of the glow's own colour kept, against a warm push towards the
  // lamp colour, so white-hot centres still glow warm.
  warmth: 0.25,
  // Corner fall-off by day and at dusk, and where it starts from the centre.
  vignetteDay: 0.16,
  vignetteDusk: 0.3,
  vignetteStart: 0.35,
  // Film grain, as a fraction of full brightness. Dither as much as texture.
  grain: 0.022,
  // A light grade on the estate itself, never on the sky: a little more
  // colour and contrast by day, and at dusk a cool lift in the shadows under
  // warm light.
  saturationDay: 1.12,
  saturationDusk: 1.08,
  contrastDay: 1.06,
  contrastDusk: 1.1,
  shadowTint: '#1d3350',
  shadowTintAmount: 0.12,
} as const

// The park inside the ring road, and the estate dressing around it.
export const PARK = {
  pondCentre: [-1.8, -1.5] as [number, number],
  pondRadius: 3.0,
  pondY: 0.025,
  pathInnerRadius: 5.0,
  pathOuterRadius: 5.9,
  pathY: 0.022,
  benchCount: 4,
  benchRadius: 4.2,
} as const

export const ESTATE = {
  treeCount: 84,
  treeSeed: 20280512,
  treeClearanceFromRoad: 2.4,
  treeClearanceFromPlot: 3.4,
  treeClearanceFromPond: 1.2,
  treeMinSpacing: 1.5,
  // Trees have to reach the lip now that the ground is a slab, or the rounded
  // corners read as bald patches.
  treeSlabMargin: 2.5,
  lampCount: 14,
  lampHeight: 1.5,
  // Extra room a lamp keeps beyond the edge of any driveway or crossing.
  lampJunctionClearance: 0.55,
  noticeBoardWidth: 1.5,
  noticeBoardHeight: 0.95,
  noticeBoardPostHeight: 0.75,
} as const

// Ambient motion that runs on its own clock: tree sway, water, birds. The
// clock stops while motion is paused or reduced, which freezes all of it.
export const AMBIENT = {
  // Render layer for what the pond reflects. The mirror camera draws only
  // this layer, so the reflection costs a handful of draw calls, not a scene.
  reflectLayer: 1,
} as const

// Life around the estate. Everything here runs on the ambient clock, so it
// stops when motion is paused and keeps to one draw call per kind.

// A two-tier fountain in the middle of the pond. Water rises from the nozzle
// in a bell that falls into the upper bowl, spills over its rim in a sheet to
// the lower bowl, and over that one into the pond, with foam where each fall
// lands. Heights are above the pond floor at y 0; radii are from its centre.
export const FOUNTAIN = {
  pedestal: { radiusTop: 0.24, radiusBottom: 0.32, top: 0.3 },
  lowerBowl: { radiusTop: 0.9, radiusBottom: 0.34, bottom: 0.3, top: 0.44, water: 0.428, waterRadius: 0.85 },
  stem: { radiusTop: 0.07, radiusBottom: 0.1, top: 0.8 },
  upperBowl: { radiusTop: 0.42, radiusBottom: 0.14, top: 0.89, water: 0.878, waterRadius: 0.39 },
  nozzle: { radius: 0.028, top: 0.95 },
  // Profiles of the falling water as [radius, height], from where it leaves
  // to where it lands. Each is spun round the centre into a sheet.
  bell: [
    [0.018, 0.95], [0.02, 1.12], [0.03, 1.26], [0.06, 1.33], [0.12, 1.345],
    [0.19, 1.3], [0.26, 1.19], [0.31, 1.05], [0.35, 0.88],
  ] as [number, number][],
  upperFall: [[0.42, 0.89], [0.435, 0.84], [0.45, 0.74], [0.47, 0.62], [0.49, 0.5], [0.5, 0.428]] as [number, number][],
  lowerFall: [[0.9, 0.445], [0.925, 0.4], [0.95, 0.3], [0.97, 0.17], [0.985, 0.06], [0.99, 0.027]] as [number, number][],
  // Where each fall churns the surface white: [inner, outer] radius and height.
  foam: [
    [0.28, 0.4, 0.882],
    [0.44, 0.6, 0.432],
    [0.93, 1.16, 0.03],
  ] as [number, number, number][],
  segments: 40,
  // Falling water: streaks running down it, how fast, and how many round it.
  flowSpeed: 1.3,
  flowLength: 5,
  streaks: 9,
  // How much of the falling sheets and bowl water are see-through.
  sheetOpacity: 0.42,
  foamOpacity: 0.75,
  // Pale falling water would glow in the dark if it dimmed only as much as
  // the pond does; at full dusk it keeps this much of its brightness.
  duskLight: 0.36,
  // Rings on the pond: how tightly packed, how fast they travel, how soon
  // they die away, and how much they bend the reflection.
  ringFrequency: 7,
  ringSpeed: 2.4,
  ringDecay: 0.9,
  ringStrength: 0.012,
} as const

// People walking the park path, back and forth between the ends of an arc
// that stops short of the noticeboard.
export const WALKERS = {
  count: 8,
  seed: 9021,
  // Radii across the path's width.
  radius: [5.15, 5.75] as [number, number],
  speed: [0.42, 0.62] as [number, number],
  stride: 0.34,
  // Room kept either side of the noticeboard, beyond its own half width.
  boardClearance: 0.5,
  legSwing: 0.55,
  armSwing: 0.45,
  bob: 0.012,
  hipY: 0.22,
  shoulderY: 0.42,
  shirts: ['#c2603f', '#37506b', '#d9b44a', '#6b7f5a', '#a05a7a', '#3f7f8a', '#e9e4d8', '#8a6d52'],
  trousers: '#3a3f4a',
  skin: '#c99a74',
} as const

// Smoke from every chimney: puffs that rise, grow, drift downwind and fade.
export const SMOKE = {
  puffsPerChimney: 14,
  lifetime: 4.6,
  rise: 2.3,
  drift: [0.7, 0.25] as [number, number],
  size: [0.22, 0.95] as [number, number],
  opacity: 0.5,
} as const

// Fireflies over the grass after dark: drifting points that blink.
export const FIREFLIES = {
  count: 70,
  seed: 2213,
  // Scattered within this radius of the centre, at knee to head height.
  radius: 17,
  height: [0.25, 1.4] as [number, number],
  wander: 0.6,
  size: 0.18,
  colour: '#e4f58a',
  brightness: 3,
} as const

// The sky dome: a sphere coloured by the direction it is seen in, centred on
// whichever camera is drawing it. Its radius must stay inside the camera's
// far plane.
export const SKY = {
  radius: 120,
  // How quickly the colour leaves the horizon, looking up and looking down.
  // Below 1 widens the horizon band; the camera mostly looks down, so the
  // lower band is where the look of the backdrop is decided.
  upCurve: 0.55,
  downCurve: 0.8,
  // Clouds painted into the sky. The camera looks down on the estate, so the
  // backdrop it sees runs from a little below the horizon (top of the view)
  // to well below it; the band is placed across that, so clouds sit behind
  // the estate like distant weather seen from high ground. [low, fullest,
  // high], as the vertical part of the view direction.
  cloudBand: [-0.5, -0.16, 0.3] as [number, number, number],
  // Noise frequency around the horizon and up it: stretched wide and flat.
  // Directions only span -1 to 1, so these set roughly how many clouds fit
  // across a view.
  cloudStretch: [8, 20] as [number, number],
  // How much of the band is cloud, and how soft their edges are.
  cloudCover: 0.5,
  cloudSoftness: 0.16,
  // Radians per second the whole cloud layer turns round the estate.
  cloudDrift: 0.006,
  // Night stays a plain navy: the clouds all but vanish into it.
  cloudOpacity: 1,
  cloudOpacityDusk: 0.12,
} as const

// The pond: a mirror of what stands around it, broken up by ripples.
export const WATER = {
  // Reflection resolution. Ripples blur it anyway, so it can be small.
  textureSize: 512,
  textureSizeLowTier: 256,
  segments: 48,
  // Pulls the mirror's clip plane down a touch, so nothing standing right at
  // the waterline leaks a sliver into the reflection.
  clipBias: 0.003,
  // Ripples: how far they shift the reflection, their size and speed.
  rippleStrength: 0.008,
  rippleScale: 2.4,
  rippleSpeed: 0.9,
  // Share of the reflection that shows looking straight down, and at the
  // most grazing angle: water mirrors more the flatter you look across it.
  // The mix happens in linear light, where a pale sky outweighs the water, so
  // these read lower than they look.
  reflectNear: 0.12,
  reflectFar: 0.7,
  // Water tints what it reflects: this much of the reflection takes the
  // water's colour, so a pale sky still reads as a blue pond.
  reflectionTint: 0.3,
  fresnelPower: 3,
  // The water darkens towards the rim, and brightens a little where ripples
  // crest.
  edgeDarkening: 0.3,
  // The water's body is a shade deeper than the palette's flat water colour,
  // so the sky's sheen reads as lying on top of it.
  depth: 0.72,
  // The water is unlit, so it does not dim with the lights at dusk the way
  // every lit surface does. It is darkened by this much instead.
  duskLight: 0.6,
  glint: 0.22,
} as const

// A small flock circling over the estate by day. At dusk they head off,
// wider and higher, until they are out of sight.
export const BIRDS = {
  // Two loose groups circling opposite ways: [radius, height, angular speed].
  groups: [
    [11, 7.5, 0.22],
    [15.5, 9.2, -0.17],
  ] as [number, number, number][],
  perGroup: 4,
  // How far a bird strays from its group's circle, across and up.
  spread: 1.6,
  lift: 0.7,
  wingSpan: 0.42,
  flapSpeed: 9,
  flapHeight: 0.16,
  // Banking into the turn, in radians.
  bank: 0.35,
  colour: '#2b2f33',
  // At full dusk the flock is this much further out and higher up.
  leaveRadius: 34,
  leaveHeight: 12,
} as const

// Two species share the estate. Heights are for a tree at scale 1.
export const TREES = {
  // Share of the planting each species takes, in this order. Three
  // silhouettes rather than two: round, conical, and a tall narrow column,
  // which is what stops a stand of trees reading as one tree repeated.
  species: { broadleaf: 0.42, conifer: 0.33, column: 0.25 },
  speciesSeed: 7351,
  broadleaf: {
    trunkHeight: 1.0,
    trunkRadiusTop: 0.075,
    trunkRadiusBottom: 0.12,
    // Canopy clumps as [x, y, z, radius]: a few overlapping blobs read as one
    // irregular crown rather than a lollipop.
    clumps: [
      [0, 1.55, 0, 0.62],
      [0.34, 1.34, 0.12, 0.44],
      [-0.3, 1.4, -0.18, 0.47],
      [0.06, 1.98, -0.06, 0.42],
    ] as [number, number, number, number][],
    // Share of each vertex's distance from its clump centre it may move by.
    lumpiness: 0.14,
  },
  conifer: {
    trunkHeight: 0.75,
    trunkRadiusTop: 0.06,
    trunkRadiusBottom: 0.1,
    // Tiers as [radius, height, centre y], widest at the bottom.
    tiers: [
      [0.72, 0.95, 0.95],
      [0.56, 0.85, 1.45],
      [0.38, 0.75, 1.95],
    ] as [number, number, number][],
    segments: 9,
    lumpiness: 0.07,
  },
  // A tall, narrow crown carried up the trunk in small clumps: the columnar
  // trees that line drives and boundaries.
  column: {
    trunkHeight: 1.1,
    trunkRadiusTop: 0.06,
    trunkRadiusBottom: 0.09,
    clumps: [
      [0, 1.18, 0, 0.36],
      [0.05, 1.56, -0.04, 0.39],
      [-0.04, 1.94, 0.03, 0.34],
      [0.02, 2.26, 0, 0.24],
    ] as [number, number, number, number][],
    lumpiness: 0.16,
  },
  // Crowns are darker underneath and lighter on top: a cheap stand-in for
  // the light a real crown blocks from its own lower branches.
  shadeBottom: 0.7,
  shadeTop: 1.12,
  // Per-tree variation, so a stand of trees never reads as one repeated tree.
  brightnessRange: 0.15,
  warmthRange: 0.09,
  // Wind: how far a crown's top moves, how fast, and where bending starts.
  swayAmplitude: 0.045,
  swaySpeed: 1.1,
  swayBase: 0.7,
  swayHeight: 1.6,
} as const

// The wall and hedge that run the slab's perimeter, and the one gap in them
// where the society is entered.
// Low planting: shrubs tucked under the trees, so the grass between the
// trunks is never bare. One instanced draw call for all of them.
export const BUSHES = {
  count: 56,
  seed: 61207,
  // How far from its tree a shrub sits, and how large it is.
  spread: [1.0, 2.3] as [number, number],
  scale: [0.75, 1.3] as [number, number],
  // Overlapping blobs as [x, y, z, radius], like a crown but close to
  // the ground and small enough that the wind never reaches it.
  clumps: [
    [0, 0.17, 0, 0.3],
    [0.21, 0.13, 0.11, 0.22],
    [-0.17, 0.14, -0.12, 0.24],
  ] as [number, number, number, number][],
  lumpiness: 0.22,
  // Clear of anything a shrub has no business growing through.
  clearance: 0.7,
} as const

export const BOUNDARY = {
  inset: 1.5,
  wallHeight: 0.42,
  wallThickness: 0.26,
  hedgeHeight: 0.55,
  hedgeThickness: 0.44,
  // Sampling resolution around the outline. High enough that the rounded
  // corners read as curves rather than facets.
  divisions: 168,
  // Fraction of the outline left open for the gate. Where the gate goes is
  // derived from the plot layout, not fixed here.
  gateSpan: 0.035,
  gatePillarHeight: 1.55,
  gatePillarSize: 0.5,
  gateArchHeight: 0.24,
} as const

// Plot names marked into the grass beside each building. Kept close to the
// grass tone so they read as terrain marking rather than a label floating in
// the scene, and lifted only when that plot is being looked at.
export const GROUND_LABEL = {
  width: 2.5,
  height: 0.62,
  // Clear of the grass without ever reaching the kerb it sits next to.
  y: 0.02,
  offsetX: 1.15,
  offsetZ: 0.45,
  restOpacity: 0.26,
  activeOpacity: 0.95,
  // Per-second decay for the fade, frame-rate independent via 1 - decay^dt.
  fadeDecay: 0.0001,
  cellWidth: 512,
  cellHeight: 128,
  fontSize: 74,
} as const

// Painted crossings where each plot's spur meets the ring road.
export const CROSSING = {
  stripeCount: 5,
  stripeWidth: 0.2,
  stripeGap: 0.19,
  y: 0.085,
} as const

// The community block on the central green: the one building that belongs to
// the society rather than to a project.
export const COMMUNITY = {
  position: [4.3, 0, -3.4] as [number, number, number],
  rotation: -0.5,
  width: 3.1,
  depth: 1.9,
  height: 1.15,
  roofOverhang: 0.16,
  roofHeight: 0.2,
} as const

// Colours all come from the theme; this is the scene's view of it under the
// names the geometry already speaks. The theme file is the only place a colour
// is ever chosen.
export const COLORS = {
  sky: palette.groundFar,
  grass: palette.slabTop,
  grassDark: palette.grassDark,
  road: palette.road,
  kerb: palette.kerb,
  sand: palette.sand,
  brick: palette.clay,
  slate: palette.indigo,
  moss: palette.sage,
  ink: palette.ink,
  paper: palette.paper,
  windowDark: palette.windowDark,
  windowLight: palette.windowLit,
  slabEdge: palette.slabEdge,
  roadMark: palette.roadMark,
  pad: palette.pad,
  padHighlight: palette.padHighlight,
  water: palette.water,
  path: palette.path,
  trunk: palette.trunk,
  foliage: palette.foliage,
  foliageDark: palette.foliageDark,
  hedge: palette.hedge,
  wood: palette.wood,
  woodDark: palette.woodDark,
  fabric: palette.fabric,
  rug: palette.rug,
  pot: palette.pot,
  leaf: palette.leaf,
  screenFrame: palette.screenFrame,
  screenBg: palette.screenBg,
  shelfBlock: palette.shelfBlock,
  brass: palette.brass,
} as const

// Typography (px)
export const TYPOGRAPHY = {
  scale: [13, 15, 18, 24, 34, 56, 84] as const,
  maxLineLength: 66,
  fontDisplay: "'Bricolage Grotesque', sans-serif",
  fontBody: "'Inter', sans-serif",
  weightLight: 300,
  weightRegular: 400,
  weightMedium: 500,
  weightBold: 700,
} as const

// UI/Animation
export const UI = {
  revealDurationMs: 700,
  // Frames rendered before the scene is revealed, so shaders are compiled
  // and the first visible frame is never a stutter.
  warmupFrames: 3,
  hoverLiftDistance: 0.15,
  // Per-second decay for the lift. Frame-rate independent via
  // 1 - decay^dt, which settles in roughly a third of a second.
  hoverLiftDecay: 0.00002,
  // Pointer travel between down and up beyond which it was a drag, not a click.
  dragThresholdPx: 6,
  // Holding the hover briefly stops it flickering when the pointer crosses a
  // seam or passes between two buildings.
  hoverReleaseMs: 60,
  // The detail panel slides in from the right on desktop, up from the bottom
  // on mobile. Short enough to feel attached to the camera flight it follows.
  panelTransitionMs: 260,
  // Content that arrives staggers in: each piece fades up this long after the
  // one before, starting once the panel has mostly slid into place.
  revealStagger: 0.055,
  revealDelay: 0.14,
  revealRise: 10,
  // Numbers count up from zero over this long when they first appear.
  countUpMs: 1100,
} as const

// The loading screen and the first-run card.
export const LOADING = {
  // How long a font that can't be had is waited for before the scene is drawn
  // in a fallback face.
  fontTimeoutMs: 4000,
  // The counter climbs toward the real percentage, never past it. Per-second
  // decay, frame-rate independent via 1 - decay^dt.
  counterDecay: 0.002,
  // Within this many percent of the real figure, the counter shows it exactly.
  counterSnap: 0.5,
  // The first-run card waits for the reveal to finish before appearing.
  firstRunDelayMs: 900,
} as const

// The budget the scene is held to, and the levers for meeting it on hardware
// slower than the machine it was built on.
export const PERF = {
  // Retina is worth it where there is headroom for it. On a weaker GPU the
  // extra 78% of pixels buys nothing a visitor would ever notice.
  maxPixelRatio: 2,
  maxPixelRatioLowTier: 1.5,
  // At or below these a device is treated as low tier. Read once, at boot.
  lowTierCores: 4,
  lowTierMemoryGb: 4,
} as const

// The cutaway room a building opens into. Designed once at this canonical
// size, then scaled uniformly to fit inside each plot's footprint — so one
// layout serves every plot, and the nameplate and ground label outside the
// footprint keep their places. Origin is the centre of the floor's top face.
// The back wall runs along -z and the side wall along -x; the other two sides
// are open, facing the quarter the camera arrives from.
export const ROOM = {
  width: 4.4,
  depth: 3.6,
  height: 2.1,
  wallThickness: 0.1,
  floorThickness: 0.08,
  // World units the floor's top face stands above the plot pad. Without it the
  // two are coplanar and the pad shows through the boards.
  floorLift: 0.02,
  skirtingHeight: 0.09,
  skirtingDepth: 0.025,
  // Fraction of the footprint the room may fill.
  footprintFill: 0.97,

  deskWidth: 1.8,
  deskDepth: 0.62,
  deskHeight: 0.74,
  deskTopThickness: 0.05,
  deskCentreX: 1.0,
  // Two places on the desk, either side of centre.
  deskSlotOffset: 0.45,
  chairSeat: 0.46,

  // Wall-mounted exhibits hang with their centre at this height.
  wallMountY: 1.3,
  // The back-left zone and the side-wall zone each take one wall or one
  // floor-standing exhibit. Kept apart so neither can reach into the corner
  // the other occupies.
  backZoneX: -0.8,
  sideZoneZ: 0.2,

  doorWidth: 0.62,
  doorHeight: 1.6,
  // Toward the back of the side wall, clear of the side-wall exhibit zone.
  doorCentreZ: -1.2,

  rugWidth: 2.2,
  rugDepth: 1.6,
  stripLightWidth: 3.4,
  // The light the strip actually gives at night: a warm lamp hung just under
  // it and out from the back wall, enough to read the room by without
  // turning it into day. Intensity in candela; its reach is in room units
  // and scales with the room.
  lampIntensity: 2.8,
  lampBelowCeiling: 0.45,
  lampOut: 1.35,
  lampRange: 6,

  // Hover: lift in canonical room units, and how fast it settles.
  exhibitLift: 0.08,
  hoverDecay: 0.0004,
  // On entering, the exhibits drop into place one after another, as the
  // camera arrives: seconds before the first, between each, and per drop,
  // and the height each falls from, in room units.
  entranceDelay: 0.3,
  entranceStagger: 0.16,
  entranceDuration: 0.75,
  entranceDrop: 0.9,
  rimStrength: 0.55,
  rimPower: 1.6,
  hoverReleaseMs: 60,

  // Surfaces for all three exhibits share one atlas per room; the fourth cell
  // is plain white, which is where every untextured face samples.
  atlasCell: 256,
  atlasInset: 8,
} as const

// Character props: the details that stop six boxes reading as six boxes. All
// positions derive from the building they belong to, never from a plot index.
export const BUILDING_PROPS = {
  acWidth: 0.42,
  acHeight: 0.32,
  // How far the unit stands proud of the ground-storey wall it hangs on.
  acProtrusion: 0.24,
  acHeightFactor: 0.62,
  // The hedge rings the side and back garden; the forecourt stays open so it
  // never crowds the door, the nameplate or a parked scooter.
  hedgeHeight: 0.42,
  hedgeThickness: 0.26,
  // Gap between the door step and the scooter parked beside it.
  scooterClearance: 0.3,
  scooterLength: 0.86,
  // A pitched roof has nowhere to put an overhead tank, so it goes up on a
  // stand behind the house — which is what a real one would do.
  tankRadius: 0.3,
  tankHeight: 0.45,
  tankStandBehind: 0.45,
  tankStandInset: 0.5,
  legSize: 0.06,
  dishBracket: 0.2,
} as const

// Building defaults
export const BUILDING = {
  floorHeight: 1.55,
  // The pad gives each building an address. It clears the grass by more than
  // the z-fighting margin rather than sitting on it.
  padMargin: 0.6,
  padBaseY: 0.02,
  padHeight: 0.08,
  // Each storey steps in slightly, so stacked floors read as a building rather
  // than one extruded box.
  setback: 0.13,
  roofHeight: 0.82,
  hipInset: 0.28,
  parapetHeight: 0.26,
  parapetThickness: 0.1,
  railingHeight: 0.34,
  railingThickness: 0.06,
  windowWidth: 0.46,
  windowHeight: 0.6,
  windowRecess: 0.06,
  windowSpacing: 0.92,
  windowSillHeight: 0.62,
  frameThickness: 0.06,
  frameDepth: 0.07,
  doorWidth: 0.6,
  doorHeight: 1.1,
  doorStepHeight: 0.07,
  doorStepDepth: 0.3,
  canopyDepth: 0.4,
  canopyThickness: 0.07,
  nameplateWidth: 0.44,
  nameplateHeight: 0.26,
  nameplatePostHeight: 0.5,
} as const
