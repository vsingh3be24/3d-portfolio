import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  Box3,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  MeshLambertMaterial,
  Group,
  Mesh,
  type PointLight,
  SRGBColorSpace,
  type Camera,
  type Scene,
  type WebGLRenderer,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { plots, type Exhibit, type Plot } from '@/data/plots'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { useEstate } from '@/store/useEstate'
import { ACCENT, palette, themes } from '@/theme'
import { AMBIENT, DUSK, ROOM, UI } from './constants'
import { lightStage } from './dusk'
import { kitEntry, paintSurface, UNTEXTURED, type Mount } from './exhibitKit'
import { boxRaycast } from './raycast'
import { PAD_TOP, roomScale } from './room'
import { requestShadowUpdate } from './shadows'

// A three-walled cutaway that stands in for the building while its plot is
// open. Only the active plot's room is ever mounted, and it disposes its own
// geometry on the way out, so visiting every room leaves nothing behind.

const W = ROOM.width
const D = ROOM.depth
const H = ROOM.height
const T = ROOM.wallThickness
// Inner faces of the two walls, which is where wall and floor exhibits sit.
const BACK_Z = -D / 2 + T
const SIDE_X = -W / 2 + T
const DESK_Z = BACK_Z + ROOM.deskDepth / 2 + 0.03
// A room has room for this many exhibits; the atlas keeps one cell spare.
const MAX_EXHIBITS = 3

// The shell's strip light comes on with the windows at dusk. It is a glow
// term in the shader, flagged per vertex, so the shell stays one draw call.
const roomLight = { value: 0 }
const shellMaterial = new MeshLambertMaterial({ vertexColors: true })
shellMaterial.onBeforeCompile = (shader) => {
  shader.uniforms.uRoomLight = roomLight
  shader.uniforms.uRoomLightColour = {
    value: new Color(themes.dusk.windowLit).multiplyScalar(DUSK.windowGlow),
  }
  shader.vertexShader = `attribute float aGlow;\nvarying float vGlow;\n${shader.vertexShader.replace(
    '#include <begin_vertex>',
    '#include <begin_vertex>\nvGlow = aGlow;',
  )}`
  shader.fragmentShader = `uniform float uRoomLight;\nuniform vec3 uRoomLightColour;\nvarying float vGlow;\n${shader.fragmentShader.replace(
    '#include <emissivemap_fragment>',
    `#include <emissivemap_fragment>
    totalEmissiveRadiance += uRoomLightColour * vGlow * uRoomLight;`,
  )}`
}
shellMaterial.customProgramCacheKey = () => 'room-shell'

function glow(geometry: BufferGeometry, value: number): BufferGeometry {
  const count = geometry.attributes.position.count
  geometry.setAttribute('aGlow', new BufferAttribute(new Float32Array(count).fill(value), 1))
  return geometry
}

function box(colour: string, w: number, h: number, d: number, x = 0, y = 0, z = 0): BufferGeometry {
  const geometry = new BoxGeometry(w, h, d)
  geometry.translate(x, y, z)
  return tint(geometry, colour)
}

function tint(geometry: BufferGeometry, colour: string): BufferGeometry {
  const value = new Color(colour)
  const count = geometry.attributes.position.count
  const colours = new Float32Array(count * 3)
  for (let index = 0; index < count; index += 1) {
    colours[index * 3] = value.r
    colours[index * 3 + 1] = value.g
    colours[index * 3 + 2] = value.b
  }
  geometry.setAttribute('color', new BufferAttribute(colours, 3))
  return geometry
}

function merge(parts: BufferGeometry[]): BufferGeometry {
  const merged = mergeGeometries(parts, false)
  parts.forEach((part) => part.dispose())
  return merged
}

// Floor, two walls with skirting and a doorway, the section-cut caps along the
// wall tops, and the furniture every room shares.
function buildShell(plot: Plot): BufferGeometry {
  const wall = palette[plot.palette.wall]
  const identity = palette[plot.palette.roof]
  const trim = palette[plot.palette.trim]
  const parts: BufferGeometry[] = []

  parts.push(box(palette.wood, W, ROOM.floorThickness, D, 0, -ROOM.floorThickness / 2, 0))

  // The back wall runs the full width; the side wall starts at its inner face
  // and is broken by the doorway.
  parts.push(box(wall, W, H, T, 0, H / 2, -D / 2 + T / 2))
  const sideX = -W / 2 + T / 2
  const doorStart = ROOM.doorCentreZ - ROOM.doorWidth / 2
  const doorEnd = ROOM.doorCentreZ + ROOM.doorWidth / 2
  const sideSegment = (from: number, to: number, bottom: number, top: number) =>
    box(wall, T, top - bottom, to - from, sideX, (bottom + top) / 2, (from + to) / 2)
  parts.push(sideSegment(BACK_Z, doorStart, 0, H))
  parts.push(sideSegment(doorEnd, D / 2, 0, H))
  parts.push(sideSegment(doorStart, doorEnd, ROOM.doorHeight, H))

  // Door frame.
  for (const z of [doorStart, doorEnd]) {
    parts.push(box(palette.woodDark, T + 0.04, ROOM.doorHeight, 0.05, sideX, ROOM.doorHeight / 2, z))
  }
  parts.push(box(palette.woodDark, T + 0.04, 0.05, ROOM.doorWidth + 0.1, sideX, ROOM.doorHeight + 0.025, ROOM.doorCentreZ))

  // A dark cap along the cut wall tops reads as an architectural section, and
  // is what tells the eye these walls were sliced open for it.
  const cap = 0.025
  parts.push(box(trim, W, cap, T + 0.004, 0, H + cap / 2, -D / 2 + T / 2))
  parts.push(box(trim, T + 0.004, cap, D - T, sideX, H + cap / 2, (BACK_Z + D / 2) / 2))

  // Skirting, broken where the doorway is.
  const skirt = ROOM.skirtingHeight
  const skirtDepth = ROOM.skirtingDepth
  parts.push(box(palette.woodDark, W - T, skirt, skirtDepth, T / 2, skirt / 2, BACK_Z + skirtDepth / 2))
  for (const [from, to] of [
    [BACK_Z, doorStart],
    [doorEnd, D / 2],
  ]) {
    parts.push(box(palette.woodDark, skirtDepth, skirt, to - from, SIDE_X + skirtDepth / 2, skirt / 2, (from + to) / 2))
  }

  // Desk against the back wall, so anything on it faces the way the camera
  // arrives.
  const deskX = ROOM.deskCentreX
  const legHeight = ROOM.deskHeight - ROOM.deskTopThickness
  parts.push(
    box(palette.wood, ROOM.deskWidth, ROOM.deskTopThickness, ROOM.deskDepth, deskX, ROOM.deskHeight - ROOM.deskTopThickness / 2, DESK_Z),
  )
  for (const side of [-1, 1]) {
    parts.push(
      box(palette.woodDark, 0.05, legHeight, ROOM.deskDepth - 0.06, deskX + side * (ROOM.deskWidth / 2 - 0.05), legHeight / 2, DESK_Z),
    )
  }
  parts.push(box(palette.woodDark, ROOM.deskWidth - 0.1, 0.34, 0.02, deskX, legHeight - 0.17, DESK_Z - ROOM.deskDepth / 2 + 0.04))

  // Chair pulled up to the desk, its back to the camera.
  const chairZ = DESK_Z + ROOM.deskDepth / 2 + 0.36
  const seat = ROOM.chairSeat
  parts.push(box(palette.fabric, 0.46, 0.06, 0.44, deskX, seat, chairZ))
  parts.push(box(palette.fabric, 0.46, 0.5, 0.06, deskX, seat + 0.28, chairZ + 0.2))
  parts.push(box(palette.charcoal, 0.05, seat - 0.07, 0.05, deskX, 0.04 + (seat - 0.07) / 2, chairZ))
  parts.push(box(palette.charcoal, 0.46, 0.03, 0.06, deskX, 0.03, chairZ))
  parts.push(box(palette.charcoal, 0.06, 0.03, 0.46, deskX, 0.03, chairZ))

  // The rug takes the plot's roof colour: the one thread from outside in.
  parts.push(box(identity, ROOM.rugWidth, 0.012, ROOM.rugDepth, 0.35, 0.006, 0.4))

  // Plant in the open front corner, clear of both wall zones.
  const plantX = -1.75
  const plantZ = 1.35
  const pot = new CylinderGeometry(0.17, 0.13, 0.32, 12)
  pot.translate(plantX, 0.16, plantZ)
  parts.push(tint(pot, palette.pot))
  const soil = new CylinderGeometry(0.155, 0.155, 0.02, 12)
  soil.translate(plantX, 0.325, plantZ)
  parts.push(tint(soil, palette.woodDark))
  for (const [radius, height, y, dx, dz] of [
    [0.24, 0.52, 0.58, 0, 0],
    [0.17, 0.4, 0.84, 0.04, -0.03],
  ]) {
    const leaves = new ConeGeometry(radius, height, 7)
    leaves.translate(plantX + dx, y, plantZ + dz)
    parts.push(tint(leaves, palette.leaf))
  }

  // Strip light along the top of the back wall. It takes the window colour,
  // so it is already the right thing to light up when dusk comes.
  parts.push(glow(box(palette.windowLit, ROOM.stripLightWidth, 0.05, 0.07, 0.1, H - 0.14, BACK_Z + 0.035), 1))
  parts.push(box(palette.charcoal, ROOM.stripLightWidth + 0.06, 0.02, 0.09, 0.1, H - 0.105, BACK_Z + 0.045))

  for (const part of parts) if (!part.attributes.aGlow) glow(part, 0)
  return merge(parts)
}

// ---------------------------------------------------------------------------
// Placing exhibits. Two wall zones each take one wall or floor object; the
// desk takes two desk objects. An exhibit that finds its kind of slot full
// takes whatever is free, so no data can leave one out.
// ---------------------------------------------------------------------------

type Slot = (geometry: BufferGeometry, mount: Mount) => void

const mountHeight = (mount: Mount) => (mount === 'wall' ? ROOM.wallMountY : 0)

const zoneSlots: Slot[] = [
  (geometry, mount) => {
    geometry.translate(ROOM.backZoneX, mountHeight(mount), BACK_Z)
  },
  (geometry, mount) => {
    // Turned to face into the room from the side wall.
    geometry.rotateY(Math.PI / 2)
    geometry.translate(SIDE_X, mountHeight(mount), ROOM.sideZoneZ)
  },
]

const deskSlots: Slot[] = [-1, 1].map((side) => (geometry) => {
  geometry.translate(ROOM.deskCentreX + side * ROOM.deskSlotOffset, ROOM.deskHeight, DESK_Z)
})

function assignSlots(mounts: Mount[]): Slot[] {
  const zones = [...zoneSlots]
  const desk = [...deskSlots]
  return mounts.map((mount) => {
    const [preferred, other] = mount === 'desk' ? [desk, zones] : [zones, desk]
    return (preferred.shift() ?? other.shift())!
  })
}

// ---------------------------------------------------------------------------
// The atlas. One texture per room holds every exhibit's surface, which is what
// lets each exhibit be a single mesh: its plain faces all sample the white
// fourth cell, so the vertex colour shows through untouched.
// ---------------------------------------------------------------------------

const ATLAS_CELLS = 2
const atlasCache = new Map<string, CanvasTexture>()

function cellRect(index: number) {
  const cell = ROOM.atlasCell
  const size = cell * ATLAS_CELLS
  const inset = ROOM.atlasInset
  const column = index % ATLAS_CELLS
  const row = Math.floor(index / ATLAS_CELLS)
  return {
    u0: (column * cell + inset) / size,
    u1: ((column + 1) * cell - inset) / size,
    // Canvas rows run down while V runs up.
    v0: 1 - ((row + 1) * cell - inset) / size,
    v1: 1 - (row * cell + inset) / size,
  }
}

// Centre of the last cell, which is left plain white.
const WHITE = cellRect(ATLAS_CELLS * ATLAS_CELLS - 1)
const WHITE_U = (WHITE.u0 + WHITE.u1) / 2
const WHITE_V = (WHITE.v0 + WHITE.v1) / 2

function bindToCell(geometry: BufferGeometry, index: number) {
  const rect = cellRect(index)
  const uv = geometry.attributes.uv as BufferAttribute
  for (let vertex = 0; vertex < uv.count; vertex += 1) {
    const u = uv.getX(vertex)
    if (u === UNTEXTURED) {
      uv.setXY(vertex, WHITE_U, WHITE_V)
    } else {
      uv.setXY(vertex, rect.u0 + u * (rect.u1 - rect.u0), rect.v0 + uv.getY(vertex) * (rect.v1 - rect.v0))
    }
  }
  uv.needsUpdate = true
}

// Painted once per plot and kept for the visit: never per visit, never per
// frame.
function roomAtlas(plot: Plot): CanvasTexture {
  const cached = atlasCache.get(plot.id)
  if (cached) return cached

  const cell = ROOM.atlasCell
  const inset = ROOM.atlasInset
  const canvas = document.createElement('canvas')
  canvas.width = cell * ATLAS_CELLS
  canvas.height = cell * ATLAS_CELLS
  const context = canvas.getContext('2d')!
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)

  plot.exhibits.slice(0, MAX_EXHIBITS).forEach((exhibit, index) => {
    const surface = kitEntry(exhibit.object).surface
    if (!surface) return
    context.save()
    context.translate((index % ATLAS_CELLS) * cell + inset, Math.floor(index / ATLAS_CELLS) * cell + inset)
    paintSurface(context, surface.kind, cell - inset * 2, surface.aspect, exhibit.labels ?? [])
    context.restore()
  })

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  // Papers on the desk are seen at a grazing angle; without this they smear.
  texture.anisotropy = 4
  atlasCache.set(plot.id, texture)
  return texture
}

// ---------------------------------------------------------------------------
// Exhibits and their hover response.
// ---------------------------------------------------------------------------

type Rim = { value: number }

// Lambert plus a fresnel term in the accent colour, faint across a face and
// stronger toward its edges. Every exhibit gets its own material so each can
// glow alone, but they share one compiled program.
function exhibitMaterial(map: CanvasTexture): { material: MeshLambertMaterial; rim: Rim } {
  const rim: Rim = { value: 0 }
  const rimColour = new Color(ACCENT)
  const material = new MeshLambertMaterial({ vertexColors: true, map })

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uRim = rim
    shader.uniforms.uRimColor = { value: rimColour }
    shader.fragmentShader = `uniform float uRim;\nuniform vec3 uRimColor;\n${shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      `float fresnel = pow( 1.0 - saturate( dot( geometryNormal, geometryViewDir ) ), ${ROOM.rimPower.toFixed(2)} );
      outgoingLight += uRimColor * mix( 0.22, 1.0, fresnel ) * uRim;
      #include <opaque_fragment>`,
    )}`
  }
  material.customProgramCacheKey = () => 'exhibit-rim'

  return { material, rim }
}

type BuiltExhibit = {
  exhibit: Exhibit
  geometry: BufferGeometry
  material: MeshLambertMaterial
  rim: Rim
  bounds: Box3
}

function buildExhibits(plot: Plot): BuiltExhibit[] {
  const atlas = roomAtlas(plot)
  const exhibits = plot.exhibits.slice(0, MAX_EXHIBITS)
  const slots = assignSlots(exhibits.map((exhibit) => kitEntry(exhibit.object).mount))

  return exhibits.map((exhibit, index) => {
    const entry = kitEntry(exhibit.object)
    const geometry = merge(entry.build())
    slots[index](geometry, entry.mount)
    bindToCell(geometry, index)
    geometry.computeBoundingBox()
    const { material, rim } = exhibitMaterial(atlas)
    return { exhibit, geometry, material, rim, bounds: geometry.boundingBox!.clone() }
  })
}

// Lands, bounces twice, settles: the drop an exhibit makes into its room.
function bounce(t: number): number {
  const n = 7.5625
  const d = 2.75
  if (t < 1 / d) return n * t * t
  if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75
  if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375
  return n * (t -= 2.625 / d) * t + 0.984375
}

function ExhibitMesh({ built, order }: { built: BuiltExhibit; order: number }) {
  const groupRef = useRef<Group>(null)
  const level = useRef(0)
  // Seconds since the room appeared, and whether this exhibit has landed.
  const born = useRef<number | null>(null)
  const landed = useRef(false)
  const releaseTimer = useRef<number | null>(null)
  const prefersReducedMotion = usePrefersReducedMotion()
  const setHoveredExhibit = useEstate((state) => state.setHoveredExhibit)
  const goToExhibit = useEstate((state) => state.goToExhibit)
  const raycast = useMemo(() => boxRaycast(built.bounds), [built])
  const id = built.exhibit.id

  const cancelRelease = () => {
    if (releaseTimer.current !== null) {
      window.clearTimeout(releaseTimer.current)
      releaseTimer.current = null
    }
  }

  useEffect(() => cancelRelease, [])

  // Read from the store directly rather than subscribing, so hover never
  // re-renders the room — the response is entirely per-frame.
  useFrame((state, delta) => {
    const group = groupRef.current
    if (!group) return

    // The drop in: real time rather than the ambient clock, since it answers
    // the visitor stepping inside and runs even while motion is paused.
    let drop = 0
    if (!landed.current) {
      if (born.current === null) born.current = state.clock.elapsedTime
      const start = ROOM.entranceDelay + order * ROOM.entranceStagger
      const t = prefersReducedMotion ? 1 : (state.clock.elapsedTime - born.current - start) / ROOM.entranceDuration
      if (t >= 1) {
        landed.current = true
        // Its shadow was drawn with it in the air; redraw it where it stands.
        requestShadowUpdate()
      } else {
        drop = ROOM.entranceDrop * (1 - bounce(Math.max(t, 0)))
      }
    }

    const { hoveredExhibitId, activeExhibitId } = useEstate.getState()
    const target = hoveredExhibitId === id || activeExhibitId === id ? 1 : 0
    if (landed.current && Math.abs(target - level.current) < 0.0005 && group.position.y === ROOM.exhibitLift * level.current) return

    const blend = prefersReducedMotion ? 1 : 1 - Math.pow(ROOM.hoverDecay, Math.min(delta, 0.05))
    level.current += (target - level.current) * blend
    // No shadow redraw for this: a lift this small moves no shadow anyone can
    // see, and redrawing the map would put the room over its draw budget.
    group.position.y = ROOM.exhibitLift * level.current + drop
    built.rim.value = ROOM.rimStrength * level.current
  })

  return (
    <group ref={groupRef}>
      <mesh
        geometry={built.geometry}
        material={built.material}
        castShadow
        receiveShadow
        raycast={raycast}
        onPointerOver={(event) => {
          event.stopPropagation()
          cancelRelease()
          setHoveredExhibit(id)
        }}
        onPointerOut={() => {
          cancelRelease()
          releaseTimer.current = window.setTimeout(() => {
            releaseTimer.current = null
            if (useEstate.getState().hoveredExhibitId === id) setHoveredExhibit(null)
          }, ROOM.hoverReleaseMs)
        }}
        onClick={(event) => {
          if (event.delta > UI.dragThresholdPx) return
          event.stopPropagation()
          goToExhibit(id)
        }}
      />
    </group>
  )
}

function Room({ plot }: { plot: Plot }) {
  const built = useMemo(() => ({ shell: buildShell(plot), exhibits: buildExhibits(plot) }), [plot])
  const backToInterior = useEstate((state) => state.backToInterior)

  // The room arriving and leaving both change what casts shadows.
  useEffect(() => {
    requestShadowUpdate()
    return requestShadowUpdate
  }, [])

  // The atlas is kept for the next visit; everything else goes.
  useEffect(
    () => () => {
      built.shell.dispose()
      for (const exhibit of built.exhibits) {
        exhibit.geometry.dispose()
        exhibit.material.dispose()
      }
    },
    [built],
  )

  return (
    <group position={[0, PAD_TOP + ROOM.floorLift, 0]} scale={roomScale(plot)}>
      <mesh
        geometry={built.shell}
        material={shellMaterial}
        castShadow
        receiveShadow
        // The shell blocks the pointer, so nothing behind the room reacts to
        // it; a click on anything that isn't an exhibit steps back out of one.
        onPointerOver={(event) => event.stopPropagation()}
        onClick={(event) => {
          if (event.delta > UI.dragThresholdPx) return
          event.stopPropagation()
          if (useEstate.getState().activeExhibitId) backToInterior()
        }}
      />
      {built.exhibits.map((exhibit, order) => (
        <ExhibitMesh key={exhibit.exhibit.id} built={exhibit} order={order} />
      ))}
    </group>
  )
}

// Rooms are only mounted when entered, so their shader programs would
// otherwise be compiled on the first frame of the flight into one — a hitch on
// a phone. Both are compiled behind the loading screen instead.
//
// three releases a program as soon as the last material using it is disposed,
// and a room disposes its exhibit materials on the way out. So one exhibit
// material is kept for the whole visit: it holds the program in the cache, and
// no room after the first ever compiles it again.
let programKeeper: MeshLambertMaterial | null = null

export function precompileRoomMaterials(gl: WebGLRenderer, camera: Camera, scene: Scene): void {
  if (!programKeeper) {
    const blank = new CanvasTexture(document.createElement('canvas'))
    blank.colorSpace = SRGBColorSpace
    programKeeper = exhibitMaterial(blank).material
  }
  const stand = glow(tint(new BoxGeometry(1, 1, 1), '#ffffff'), 0)
  const group = new Group()
  // Receiving shadows is part of a program's identity, so the stand-ins must
  // receive them just as the room's own meshes do.
  for (const standIn of [new Mesh(stand, shellMaterial), new Mesh(stand, programKeeper)]) {
    standIn.receiveShadow = true
    group.add(standIn)
  }
  gl.compile(group, camera, scene)
  stand.dispose()

  // Every room's atlas is painted and uploaded now too, so no flight into a
  // room pays for a texture upload on its first frame. Six small textures.
  for (const plot of plots) {
    if (plot.exhibits.length > 0) gl.initTexture(roomAtlas(plot))
  }
}

// The strip light's real light, so a room at night is lit from inside rather
// than left to the moon. Always in the scene, dark when no room is open or by
// day: adding a light changes every material's program, so one that came
// and went with the rooms would recompile the whole estate on the way in.
// It is on the mirror's layer too, so the pond's pass sees the same lights
// and draws with the same programs.
function RoomLamp({ plot }: { plot: Plot | null }) {
  const lampRef = useRef<PointLight>(null)
  const scale = plot ? roomScale(plot) : 1

  useLayoutEffect(() => {
    lampRef.current?.layers.enable(AMBIENT.reflectLayer)
  }, [])

  useFrame(() => {
    const lamp = lampRef.current
    roomLight.value = lightStage(DUSK.cascadeStart, DUSK.cascadeStart + DUSK.cascadeSpan + DUSK.windowFade)
    if (!lamp) return
    lamp.intensity = plot ? ROOM.lampIntensity * roomLight.value : 0
  })

  return (
    <group position={plot?.position ?? [0, 0, 0]} rotation={[0, plot?.rotation ?? 0, 0]}>
      <group position={[0, PAD_TOP + ROOM.floorLift, 0]} scale={scale}>
        <pointLight
          ref={lampRef}
          position={[0.1, H - ROOM.lampBelowCeiling, BACK_Z + ROOM.lampOut]}
          color={themes.dusk.windowLit}
          intensity={0}
          distance={ROOM.lampRange * scale}
          decay={2}
          castShadow={false}
        />
      </group>
    </group>
  )
}

export function Interiors() {
  const activePlotId = useEstate((state) => state.activePlotId)
  const found = activePlotId ? plots.find((entry) => entry.id === activePlotId) : null
  const plot = found && found.exhibits.length > 0 ? found : null

  // Keyed by plot, so moving between rooms tears the old one down completely.
  return (
    <>
      <RoomLamp plot={plot} />
      {plot && (
        <group position={plot.position} rotation={[0, plot.rotation, 0]}>
          <Room key={plot.id} plot={plot} />
        </group>
      )}
    </>
  )
}
