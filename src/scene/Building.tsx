import {
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react'
import { useFrame } from '@react-three/fiber'
import {
  Box3,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CylinderGeometry,
  Euler,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Color,
  MeshLambertMaterial,
  Object3D,
  PlaneGeometry,
  Quaternion,
  SRGBColorSpace,
  Vector3,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { plots, type Plot } from '@/data/plots'
import { useCoarsePointer } from '@/hooks/useIsMobile'
import { useEstate } from '@/store/useEstate'
import { palette, themes } from '@/theme'
import { BUILDING, BUILDING_PROPS, CAMERA, COLORS, DUSK, UI } from './constants'
import { cascadeDelay, dusk, smooth, trackColour } from './dusk'
import { boxRaycast } from './raycast'
import { requestShadowUpdate } from './shadows'
import { PAD_TOP } from './room'

// One material per colour, shared by every building that uses it.
const materialCache = new Map<string, MeshLambertMaterial>()

function material(colour: string): MeshLambertMaterial {
  let found = materialCache.get(colour)
  if (!found) {
    found = new MeshLambertMaterial({ color: colour })
    materialCache.set(colour, found)
  }
  return found
}

export const padMaterial = material(COLORS.pad)
export const padHighlightMaterial = material(COLORS.padHighlight)
trackColour(padMaterial.color, 'pad')
trackColour(padHighlightMaterial.color, 'padHighlight')

function box(w: number, h: number, d: number, x = 0, y = 0, z = 0): BufferGeometry {
  const geometry = new BoxGeometry(w, h, d)
  geometry.translate(x, y, z)
  return geometry
}

function cylinder(radius: number, height: number, x: number, y: number, z: number, segments = 12) {
  const geometry = new CylinderGeometry(radius, radius, height, segments)
  geometry.translate(x, y, z)
  return geometry
}

// Sources are disposed after merging: they exist only to be folded in.
function mergeParts(parts: BufferGeometry[]): BufferGeometry {
  const merged = mergeGeometries(parts, false)
  parts.forEach((part) => part.dispose())
  return merged
}

// Baking the colour into vertices lets one building's walls, roof and trim
// merge into a single mesh, which is what keeps the estate inside its draw-call
// budget. Color converts sRGB to working space on construction, so these values
// are already linear.
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

const shellMaterial = new MeshLambertMaterial({ vertexColors: true })

// A pitched roof built from its own vertices so the slopes stay flat-shaded.
// The ridge inset is what separates a gable (zero) from a hip (positive).
function pitchedRoof(w: number, d: number, height: number, inset: number): BufferGeometry {
  const hw = w / 2
  const hd = d / 2
  const ridgeLeft: [number, number, number] = [-hw + inset * w, height, 0]
  const ridgeRight: [number, number, number] = [hw - inset * w, height, 0]

  const positions: number[] = []
  const triangle = (
    a: [number, number, number],
    b: [number, number, number],
    c: [number, number, number],
  ) => positions.push(...a, ...b, ...c)
  const quad = (
    a: [number, number, number],
    b: [number, number, number],
    c: [number, number, number],
    e: [number, number, number],
  ) => {
    triangle(a, b, c)
    triangle(a, c, e)
  }

  quad([-hw, 0, hd], [hw, 0, hd], ridgeRight, ridgeLeft)
  quad([hw, 0, -hd], [-hw, 0, -hd], ridgeLeft, ridgeRight)
  triangle([-hw, 0, -hd], [-hw, 0, hd], ridgeLeft)
  triangle([hw, 0, hd], [hw, 0, -hd], ridgeRight)

  const vertexCount = positions.length / 3
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
  // Nothing here is textured, but merging refuses to combine geometries whose
  // attributes differ, and box and cylinder parts both carry UVs and an index.
  // The index stays sequential so vertices remain unshared and shading flat.
  geometry.setAttribute('uv', new BufferAttribute(new Float32Array(vertexCount * 2), 2))
  geometry.setIndex(Array.from({ length: vertexCount }, (_, index) => index))
  geometry.computeVertexNormals()
  return geometry
}

function parapetRing(w: number, d: number, y: number): BufferGeometry[] {
  const t = BUILDING.parapetThickness
  const h = BUILDING.parapetHeight
  return [
    box(w, h, t, 0, y + h / 2, d / 2 - t / 2),
    box(w, h, t, 0, y + h / 2, -d / 2 + t / 2),
    box(t, h, d - t * 2, w / 2 - t / 2, y + h / 2, 0),
    box(t, h, d - t * 2, -w / 2 + t / 2, y + h / 2, 0),
  ]
}

type BuildingParts = {
  pad: BufferGeometry
  shell: BufferGeometry
  windows: Matrix4[]
}

// Plots name their colours; the theme decides what those names are.
function colours(plot: Plot) {
  return {
    wall: palette[plot.palette.wall],
    roof: palette[plot.palette.roof],
    trim: palette[plot.palette.trim],
  }
}

// Only flat and terrace roofs give a prop somewhere level to stand.
function hasDeck(plot: Plot): boolean {
  return plot.roofStyle === 'flat' || plot.roofStyle === 'terrace'
}

function storeySize(plot: Plot, storey: number) {
  return {
    w: plot.footprint.w - storey * 2 * BUILDING.setback,
    d: plot.footprint.d - storey * 2 * BUILDING.setback,
  }
}

const CHIMNEY_SIZE = 0.34

// Where a chimney stands on its building, in the building's own frame: x and
// z of its centre, and the height of its top. Shared by the geometry and by
// the smoke that rises from it, so the two can never drift apart.
function chimneyLocal(plot: Plot): [number, number, number] {
  const top = storeySize(plot, plot.floors - 1)
  const wallTop = PAD_TOP + plot.floors * BUILDING.floorHeight
  return [top.w / 2 - 0.6, wallTop + BUILDING.roofHeight + 0.5, -top.d / 4]
}

// The top of every chimney on the estate, in world space.
export function chimneyTops(): { plotId: string; position: Vector3 }[] {
  return plots
    .filter((plot) => plot.kind !== 'contact' && plot.props.includes('chimney'))
    .map((plot) => {
      const [x, y, z] = chimneyLocal(plot)
      const position = new Vector3(x, y, z).applyAxisAngle(new Vector3(0, 1, 0), plot.rotation)
      return { plotId: plot.id, position: position.add(new Vector3(...plot.position)) }
    })
}

// Everything that sits on or passes through the roof, merged into one piece so
// it can lift away as a unit when a building opens.
function roofAssembly(plot: Plot): BufferGeometry {
  const accent: BufferGeometry[] = []
  const trim: BufferGeometry[] = []

  const top = storeySize(plot, plot.floors - 1)
  const wallTop = PAD_TOP + plot.floors * BUILDING.floorHeight
  const overhang = 0.18

  if (plot.roofStyle === 'gable' || plot.roofStyle === 'hip') {
    const inset = plot.roofStyle === 'hip' ? BUILDING.hipInset : 0
    const roof = pitchedRoof(top.w + overhang * 2, top.d + overhang * 2, BUILDING.roofHeight, inset)
    roof.translate(0, wallTop, 0)
    accent.push(roof)
  } else {
    const slabHeight = 0.12
    accent.push(box(top.w + overhang, slabHeight, top.d + overhang, 0, wallTop + slabHeight / 2, 0))
    const deckY = wallTop + slabHeight

    if (plot.roofStyle === 'flat') {
      accent.push(...parapetRing(top.w + overhang, top.d + overhang, deckY))
    } else {
      // Terrace: railing on three sides leaves the front open, and a small
      // stair housing explains how anyone gets up there.
      const t = BUILDING.railingThickness
      const h = BUILDING.railingHeight
      const rw = top.w + overhang
      const rd = top.d + overhang
      trim.push(box(rw, h, t, 0, deckY + h / 2, -rd / 2 + t / 2))
      trim.push(box(t, h, rd - t * 2, rw / 2 - t / 2, deckY + h / 2, 0))
      trim.push(box(t, h, rd - t * 2, -rw / 2 + t / 2, deckY + h / 2, 0))
      accent.push(box(0.7, 0.62, 0.7, -rw / 2 + 0.55, deckY + 0.31, -rd / 2 + 0.55))
    }
  }

  // Flat and terrace roofs have a deck to stand things on. On a pitched roof the
  // tank and dish are built by bodyParts instead, so any data is valid.
  const deckY = wallTop + 0.12
  const deck = hasDeck(plot)

  for (const prop of plot.props) {
    if (prop === 'waterTank' && deck) {
      trim.push(cylinder(0.28, 0.42, top.w / 2 - 0.5, deckY + 0.35, -top.d / 2 + 0.5))
      for (const [lx, lz] of [
        [-0.16, -0.16],
        [0.16, -0.16],
        [-0.16, 0.16],
        [0.16, 0.16],
      ]) {
        trim.push(box(0.05, 0.3, 0.05, top.w / 2 - 0.5 + lx, deckY + 0.15, -top.d / 2 + 0.5 + lz))
      }
    }
    if (prop === 'dish' && deck) {
      const dishY = deckY + 0.17
      trim.push(cylinder(0.05, 0.34, -top.w / 2 + 0.45, dishY, top.d / 2 - 0.5))
      const bowl = new CylinderGeometry(0.22, 0.06, 0.14, 12)
      bowl.rotateX(-0.7)
      bowl.translate(-top.w / 2 + 0.45, dishY + 0.24, top.d / 2 - 0.5)
      trim.push(bowl)
    }
    if (prop === 'chimney') {
      const [x, height, z] = chimneyLocal(plot)
      const tall = height - wallTop
      trim.push(box(CHIMNEY_SIZE, tall, CHIMNEY_SIZE, x, wallTop + tall / 2, z))
    }
  }

  const colour = colours(plot)
  return mergeParts([
    ...accent.map((part) => tint(part, colour.roof)),
    ...trim.map((part) => tint(part, colour.trim)),
  ])
}

// A scooter parked side-on across the forecourt, clear of the door step. Its
// body takes the roof colour, so it reads as belonging to that house.
function scooter(front: number): { accent: BufferGeometry[]; trim: BufferGeometry[] } {
  const accent = [
    box(0.2, 0.06, 0.46, 0, 0.17, 0.02),
    box(0.26, 0.24, 0.34, 0, 0.3, -0.2),
    box(0.2, 0.36, 0.08, 0, 0.35, 0.25),
  ]
  const trim = [box(0.2, 0.06, 0.3, 0, 0.45, -0.18), box(0.4, 0.05, 0.06, 0, 0.56, 0.27)]

  for (const z of [-0.32, 0.32]) {
    const wheel = new CylinderGeometry(0.11, 0.11, 0.07, 12)
    wheel.rotateZ(Math.PI / 2)
    wheel.translate(0, 0.11, z)
    trim.push(wheel)
  }

  const x =
    BUILDING.doorWidth / 2 + BUILDING_PROPS.scooterClearance + BUILDING_PROPS.scooterLength / 2
  const z = front + BUILDING.doorStepDepth / 2 + BUILDING.padMargin / 2
  for (const part of [...accent, ...trim]) {
    part.rotateY(Math.PI / 2)
    part.translate(x, PAD_TOP, z)
  }

  return { accent, trim }
}

// An overhead tank on a four-legged stand behind the house, for roofs that
// have no deck to carry one.
function tankStand(plot: Plot): BufferGeometry[] {
  const { w, d } = plot.footprint
  const top = PAD_TOP + plot.floors * BUILDING.floorHeight
  const x = -(w / 2 - BUILDING_PROPS.tankStandInset)
  const z = -(d / 2 + BUILDING.padMargin + BUILDING_PROPS.tankStandBehind)
  const r = BUILDING_PROPS.tankRadius
  const leg = BUILDING_PROPS.legSize

  const parts: BufferGeometry[] = [
    cylinder(r, BUILDING_PROPS.tankHeight, x, top + BUILDING_PROPS.tankHeight / 2, z),
  ]
  for (const [lx, lz] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ]) {
    parts.push(box(leg, top, leg, x + lx * r * 0.7, top / 2, z + lz * r * 0.7))
  }
  return parts
}

// A dish bracketed to the top storey's side wall, below the eaves, facing out.
function wallDish(plot: Plot): BufferGeometry[] {
  const top = storeySize(plot, plot.floors - 1)
  const y = PAD_TOP + plot.floors * BUILDING.floorHeight - 0.35
  const x = -(top.w / 2 + BUILDING_PROPS.dishBracket / 2)
  const z = top.d / 4

  const bowl = new CylinderGeometry(0.22, 0.06, 0.14, 12)
  bowl.rotateZ(Math.PI / 2 - 0.4)
  bowl.translate(x - BUILDING_PROPS.dishBracket / 2, y, z)
  return [box(BUILDING_PROPS.dishBracket, 0.05, 0.05, x, y, z), bowl]
}

// Low hedge along the sides and back of the pad. It stops level with the front
// wall, leaving the forecourt open for the door, nameplate and scooter.
function hedge(plot: Plot): BufferGeometry[] {
  const { w, d } = plot.footprint
  const t = BUILDING_PROPS.hedgeThickness
  const h = BUILDING_PROPS.hedgeHeight
  const halfW = w / 2 + BUILDING.padMargin - t / 2
  const back = d / 2 + BUILDING.padMargin
  const y = PAD_TOP + h / 2
  const sideLength = back + d / 2
  const sideCentre = (d / 2 - back) / 2

  return [
    box(t, h, sideLength, halfW, y, sideCentre),
    box(t, h, sideLength, -halfW, y, sideCentre),
    box(halfW * 2 + t, h, t, 0, y, -back + t / 2),
  ]
}

// Storeys, door, and every prop that is not on the roof.
function bodyParts(plot: Plot): BufferGeometry[] {
  const walls: BufferGeometry[] = []
  const accent: BufferGeometry[] = []
  const trim: BufferGeometry[] = []

  const { d } = plot.footprint
  for (let storey = 0; storey < plot.floors; storey += 1) {
    const size = storeySize(plot, storey)
    const centreY = PAD_TOP + storey * BUILDING.floorHeight + BUILDING.floorHeight / 2
    walls.push(box(size.w, BUILDING.floorHeight, size.d, 0, centreY, 0))
  }

  // Door, step and canopy on the face that looks back at the estate centre.
  const front = d / 2
  trim.push(
    box(BUILDING.doorWidth, BUILDING.doorHeight, 0.08, 0, PAD_TOP + BUILDING.doorHeight / 2, front - 0.02),
  )
  trim.push(
    box(
      BUILDING.doorWidth + 0.26,
      BUILDING.doorStepHeight,
      BUILDING.doorStepDepth,
      0,
      PAD_TOP + BUILDING.doorStepHeight / 2,
      front + BUILDING.doorStepDepth / 2,
    ),
  )
  trim.push(
    box(
      BUILDING.doorWidth + 0.5,
      BUILDING.canopyThickness,
      BUILDING.canopyDepth,
      0,
      PAD_TOP + BUILDING.doorHeight + 0.14,
      front + BUILDING.canopyDepth / 2 - 0.06,
    ),
  )

  const planting: BufferGeometry[] = []
  const deck = hasDeck(plot)

  for (const prop of plot.props) {
    if (prop === 'acUnit') {
      // Sized off the ground storey it hangs on. Using the top storey's width
      // buried the unit in the wall of anything taller than one floor.
      const ground = storeySize(plot, 0)
      trim.push(
        box(
          BUILDING_PROPS.acProtrusion,
          BUILDING_PROPS.acHeight,
          BUILDING_PROPS.acWidth,
          ground.w / 2 + BUILDING_PROPS.acProtrusion / 2,
          PAD_TOP + BUILDING.floorHeight * BUILDING_PROPS.acHeightFactor,
          -d / 4,
        ),
      )
    }
    if (prop === 'scooter') {
      const parked = scooter(front)
      accent.push(...parked.accent)
      trim.push(...parked.trim)
    }
    if (prop === 'hedge') planting.push(...hedge(plot))
    if (prop === 'waterTank' && !deck) trim.push(...tankStand(plot))
    if (prop === 'dish' && !deck) trim.push(...wallDish(plot))
    if (prop === 'balcony' && plot.floors > 1) {
      const size = storeySize(plot, 1)
      const y = PAD_TOP + BUILDING.floorHeight
      const depth = 0.5
      accent.push(box(size.w * 0.62, 0.08, depth, 0, y + 0.04, size.d / 2 + depth / 2))
      const t = BUILDING.railingThickness
      const h = 0.3
      trim.push(box(size.w * 0.62, h, t, 0, y + 0.08 + h / 2, size.d / 2 + depth - t / 2))
      trim.push(box(t, h, depth, size.w * 0.31 - t / 2, y + 0.08 + h / 2, size.d / 2 + depth / 2))
      trim.push(box(t, h, depth, -size.w * 0.31 + t / 2, y + 0.08 + h / 2, size.d / 2 + depth / 2))
    }
  }

  const colour = colours(plot)
  return [
    ...walls.map((part) => tint(part, colour.wall)),
    ...accent.map((part) => tint(part, colour.roof)),
    ...trim.map((part) => tint(part, colour.trim)),
    ...planting.map((part) => tint(part, palette.hedge)),
  ]
}

function composeBuilding(plot: Plot): BuildingParts {
  const windows: Matrix4[] = []
  const { w, d } = plot.footprint

  // Window grid, derived from each storey's own face widths.
  const rotation = new Euler()
  const quaternion = new Quaternion()
  const offset = new Vector3()
  const scale = new Vector3(1, 1, 1)

  for (let storey = 0; storey < plot.floors; storey += 1) {
    const size = storeySize(plot, storey)
    const centreY =
      PAD_TOP + storey * BUILDING.floorHeight + BUILDING.windowSillHeight + BUILDING.windowHeight / 2

    const faces = [
      { span: size.w, depth: size.d / 2, rotY: 0, isFront: true },
      { span: size.w, depth: size.d / 2, rotY: Math.PI, isFront: false },
      { span: size.d, depth: size.w / 2, rotY: Math.PI / 2, isFront: false },
      { span: size.d, depth: size.w / 2, rotY: -Math.PI / 2, isFront: false },
    ]

    for (const face of faces) {
      const count = Math.max(1, Math.floor((face.span - 0.55) / BUILDING.windowSpacing))
      const spacing = face.span / (count + 1)

      for (let index = 0; index < count; index += 1) {
        const along = -face.span / 2 + spacing * (index + 1)
        // The door owns the middle of the front face on the ground storey.
        if (face.isFront && storey === 0 && Math.abs(along) < BUILDING.doorWidth / 2 + 0.4) continue

        rotation.set(0, face.rotY, 0)
        quaternion.setFromEuler(rotation)
        offset.set(along, 0, face.depth).applyQuaternion(quaternion)
        offset.y = centreY

        windows.push(new Matrix4().compose(offset.clone(), quaternion.clone(), scale))
      }
    }
  }

  return {
    pad: box(
      w + BUILDING.padMargin * 2,
      BUILDING.padHeight,
      d + BUILDING.padMargin * 2,
      0,
      BUILDING.padBaseY + BUILDING.padHeight / 2,
      0,
    ),
    shell: mergeParts([...bodyParts(plot), roofAssembly(plot)]),
    windows,
  }
}

// Composed once per plot: the geometry is reused by both the building group and
// the shared window mesh, which would otherwise each build their own copy.
const buildingCache = new Map<string, BuildingParts>()

function getBuilding(plot: Plot): BuildingParts {
  let parts = buildingCache.get(plot.id)
  if (!parts) {
    parts = composeBuilding(plot)
    buildingCache.set(plot.id, parts)
  }
  return parts
}

// Pane and frame share one instanced geometry through material groups, so every
// window in the estate costs two draw calls in total rather than two per house.
let windowGeometry: BufferGeometry | null = null

function getWindowGeometry(): BufferGeometry {
  if (windowGeometry) return windowGeometry

  const w = BUILDING.windowWidth
  const h = BUILDING.windowHeight
  const t = BUILDING.frameThickness

  // The origin sits on the wall surface. The pane clears it by a hair so it is
  // never buried in the wall, and the frame stands proud of the pane, which is
  // what reads as a recess without cutting an opening through the wall.
  const paneZ = 0.012
  const frameZ = paneZ + BUILDING.frameDepth / 2
  const pane = box(w, h, 0.02, 0, 0, paneZ)
  const frame = mergeGeometries(
    [
      box(w + t * 2, t, BUILDING.frameDepth, 0, h / 2 + t / 2, frameZ),
      box(w + t * 2, t, BUILDING.frameDepth, 0, -h / 2 - t / 2, frameZ),
      box(t, h, BUILDING.frameDepth, w / 2 + t / 2, 0, frameZ),
      box(t, h, BUILDING.frameDepth, -w / 2 - t / 2, 0, frameZ),
    ],
    false,
  )

  windowGeometry = mergeGeometries([pane, frame], true)
  return windowGeometry
}

// Glass is its own material, never the shared cache entry for its colour,
// because at dusk it glows: each window carries a lit level from 0 to 1 that
// turns the pane from dark glazing into the warm emissive of a lit room.
const litUniform = { value: new Color(themes.dusk.windowLit).multiplyScalar(DUSK.windowGlow) }
const glassMaterial = new MeshLambertMaterial({ color: COLORS.windowDark })
glassMaterial.onBeforeCompile = (shader) => {
  shader.uniforms.uLitColour = litUniform
  shader.vertexShader = `attribute float aLit;\nvarying float vLit;\n${shader.vertexShader.replace(
    '#include <begin_vertex>',
    '#include <begin_vertex>\nvLit = aLit;',
  )}`
  shader.fragmentShader = `uniform vec3 uLitColour;\nvarying float vLit;\n${shader.fragmentShader.replace(
    '#include <emissivemap_fragment>',
    `#include <emissivemap_fragment>
    diffuseColor.rgb *= 1.0 - vLit;
    totalEmissiveRadiance += uLitColour * vLit;`,
  )}`
}
glassMaterial.customProgramCacheKey = () => 'window-glass'

const windowMaterials = [glassMaterial, material(COLORS.kerb)]

// Stands in for a raycast when a shell must not catch the pointer at all.
function noRaycast() {}

function colliderBox(plot: Plot): Box3 {
  const height = PAD_TOP + plot.floors * BUILDING.floorHeight + BUILDING.roofHeight
  return new Box3(
    new Vector3(-plot.footprint.w / 2, 0, -plot.footprint.d / 2),
    new Vector3(plot.footprint.w / 2, height, plot.footprint.d / 2),
  )
}

function BuildingGroup({
  plot,
  onRegister,
}: {
  plot: Plot
  onRegister: (id: string, group: Object3D | null) => void
}) {
  const parts = getBuilding(plot)
  const raycast = useMemo(() => boxRaycast(colliderBox(plot)), [plot])

  const setHovered = useEstate((state) => state.setHovered)
  const goToPlot = useEstate((state) => state.goToPlot)
  // The lift is only a few percent of a building's height, so at overview
  // distance the brightened pad is what actually reads as the hover cue.
  const isHighlighted = useEstate(
    (state) => state.activePlotId === plot.id || state.hoveredPlotId === plot.id,
  )
  // While its plot is open, the room in Interior.tsx stands in for this
  // building, so the shell neither draws nor catches the pointer.
  const isActive = useEstate((state) => state.activePlotId === plot.id)

  const releaseTimer = useRef<number | null>(null)

  const cancelRelease = () => {
    if (releaseTimer.current !== null) {
      window.clearTimeout(releaseTimer.current)
      releaseTimer.current = null
    }
  }

  useEffect(() => cancelRelease, [])

  return (
    <group position={plot.position} rotation={[0, plot.rotation, 0]}>
      <mesh
        geometry={parts.pad}
        material={isHighlighted ? padHighlightMaterial : padMaterial}
        receiveShadow
        castShadow={false}
        raycast={() => null}
      />
      {/* Only the building rises on hover; its plot stays put. */}
      <group ref={(group) => onRegister(plot.id, group)}>
      <mesh
        visible={!isActive}
        geometry={parts.shell}
        material={shellMaterial}
        castShadow
        receiveShadow
        raycast={isActive ? noRaycast : raycast}
        onPointerOver={(event) => {
          event.stopPropagation()
          cancelRelease()
          setHovered(plot.id)
        }}
        onPointerOut={() => {
          cancelRelease()
          releaseTimer.current = window.setTimeout(() => {
            releaseTimer.current = null
            // Only clears if this building is still the hovered one, so moving
            // straight onto a neighbour never blanks the new hover.
            if (useEstate.getState().hoveredPlotId === plot.id) setHovered(null)
          }, UI.hoverReleaseMs)
        }}
        onClick={(event) => {
          // r3f tracks pointer travel since the press but still fires the click
          // regardless; anything past the threshold was an orbit drag.
          if (event.delta > UI.dragThresholdPx) return
          event.stopPropagation()
          goToPlot(plot.id)
        }}
      />
      </group>
    </group>
  )
}

const Windows = forwardRef<InstancedMesh, { matrices: Matrix4[] }>(function Windows(
  { matrices },
  ref,
) {
  const meshRef = useRef<InstancedMesh | null>(null)
  // Forwards the live mesh every time it is attached. A handle fixed at first
  // mount goes stale when the instance is recreated, and every write through
  // it then lands on a mesh no longer in the scene.
  const attach = useCallback(
    (mesh: InstancedMesh | null) => {
      meshRef.current = mesh
      if (typeof ref === 'function') ref(mesh)
      else if (ref) ref.current = mesh
    },
    [ref],
  )
  const geometry = getWindowGeometry()

  const lit = useMemo(() => new InstancedBufferAttribute(new Float32Array(matrices.length), 1), [matrices])
  // Attached in an effect rather than inside the memo: a memo may run twice,
  // and the attribute on the geometry must be the one this frame loop writes.
  useLayoutEffect(() => {
    geometry.setAttribute('aLit', lit)
  }, [geometry, lit])
  const delays = useMemo(() => new Float32Array(matrices.length), [matrices])
  const cascade = useRef({ epoch: -1, time: -1 })
  useLayoutEffect(() => {
    cascade.current.time = -1
  }, [lit])

  useFrame(() => {
    const state = cascade.current
    if (state.epoch !== dusk.epoch) {
      // Ordered from where the camera stood at the toggle, nearest first.
      const distances = matrices.map((matrix) =>
        Math.hypot(
          matrix.elements[12] - dusk.origin.x,
          matrix.elements[13] - dusk.origin.y,
          matrix.elements[14] - dusk.origin.z,
        ),
      )
      const nearest = Math.min(...distances)
      const farthest = Math.max(...distances)
      distances.forEach((distance, index) => {
        delays[index] = cascadeDelay(distance, nearest, farthest)
      })
      state.epoch = dusk.epoch
      state.time = -1
    }
    if (state.time === dusk.time) return
    state.time = dusk.time

    const start = DUSK.cascadeStart
    for (let index = 0; index < delays.length; index += 1) {
      lit.setX(index, smooth((dusk.time - start - delays[index]) / DUSK.windowFade))
    }
    lit.needsUpdate = true
  })

  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix))
    mesh.instanceMatrix.needsUpdate = true
  }, [matrices])

  return (
    <instancedMesh
      ref={attach}
      args={[geometry, windowMaterials, matrices.length]}
      castShadow={false}
      receiveShadow={false}
      raycast={() => null}
    />
  )
})

export const buildingPlots = plots.filter((plot) => plot.kind !== 'contact')

// Every plot number is drawn into one texture and every plate into one merged
// geometry, so the whole set of nameplates costs a single draw call.
const NAMEPLATE_COLUMNS = 3

function createNameplateAtlas(): CanvasTexture {
  const cell = 256
  const rows = Math.ceil(buildingPlots.length / NAMEPLATE_COLUMNS)
  const canvas = document.createElement('canvas')
  canvas.width = NAMEPLATE_COLUMNS * cell
  canvas.height = rows * cell

  const context = canvas.getContext('2d')!
  context.fillStyle = COLORS.paper
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = COLORS.ink
  context.font = 'bold 52px sans-serif'
  context.textAlign = 'center'
  context.textBaseline = 'middle'

  buildingPlots.forEach((plot, index) => {
    const column = index % NAMEPLATE_COLUMNS
    const row = Math.floor(index / NAMEPLATE_COLUMNS)
    context.fillText(plot.plotNumber, column * cell + cell / 2, row * cell + cell / 2)
  })

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

function nameplateOffset(plot: Plot) {
  return {
    x: plot.footprint.w / 2 + 0.16,
    z: plot.footprint.d / 2 + BUILDING.padMargin - 0.18,
  }
}

function buildNameplates() {
  const posts: BufferGeometry[] = []
  const faces: BufferGeometry[] = []
  const rows = Math.ceil(buildingPlots.length / NAMEPLATE_COLUMNS)
  const plateY = BUILDING.nameplatePostHeight + BUILDING.nameplateHeight / 2

  buildingPlots.forEach((plot, index) => {
    const local = nameplateOffset(plot)

    const post = mergeGeometries(
      [
        box(0.07, BUILDING.nameplatePostHeight, 0.07, local.x, BUILDING.nameplatePostHeight / 2, local.z),
        box(
          BUILDING.nameplateWidth + 0.06,
          BUILDING.nameplateHeight + 0.06,
          0.05,
          local.x,
          plateY,
          local.z,
        ),
      ],
      false,
    )
    post.rotateY(plot.rotation)
    post.translate(plot.position[0], 0, plot.position[2])
    posts.push(post)

    const face = new PlaneGeometry(BUILDING.nameplateWidth, BUILDING.nameplateHeight)
    const uv = face.attributes.uv as BufferAttribute
    const column = index % NAMEPLATE_COLUMNS
    const row = Math.floor(index / NAMEPLATE_COLUMNS)
    for (let vertex = 0; vertex < uv.count; vertex += 1) {
      // Canvas rows run top-down while V runs bottom-up, so the row flips.
      uv.setXY(
        vertex,
        (column + uv.getX(vertex)) / NAMEPLATE_COLUMNS,
        (rows - 1 - row + uv.getY(vertex)) / rows,
      )
    }
    uv.needsUpdate = true
    face.translate(local.x, plateY, local.z + 0.031)
    face.rotateY(plot.rotation)
    face.translate(plot.position[0], 0, plot.position[2])
    faces.push(face)
  })

  return { posts: mergeParts(posts), faces: mergeParts(faces) }
}

let nameplates: { posts: BufferGeometry; faces: BufferGeometry; texture: CanvasTexture } | null = null

function Nameplates() {
  if (!nameplates) {
    const built = buildNameplates()
    nameplates = { ...built, texture: createNameplateAtlas() }
  }

  return (
    <>
      <mesh geometry={nameplates.posts} material={material(COLORS.ink)} castShadow receiveShadow />
      <mesh geometry={nameplates.faces} castShadow={false} receiveShadow={false}>
        <meshBasicMaterial map={nameplates.texture} />
      </mesh>
    </>
  )
}

const liftedMatrix = new Matrix4()
const HIDDEN_MATRIX = new Matrix4().makeScale(0, 0, 0)

export function Buildings() {
  // Window transforms are baked into world space once, since the instanced mesh
  // lives outside each building's group. The ranges let a lifted building take
  // its own windows with it without touching anyone else's.
  const { matrices, ranges } = useMemo(() => {
    const all: Matrix4[] = []
    const byPlot = new Map<string, [number, number]>()
    const buildingMatrix = new Matrix4()
    const quaternion = new Quaternion()
    const scale = new Vector3(1, 1, 1)

    for (const plot of buildingPlots) {
      const start = all.length
      const parts = getBuilding(plot)
      quaternion.setFromEuler(new Euler(0, plot.rotation, 0))
      buildingMatrix.compose(new Vector3(...plot.position), quaternion, scale)
      for (const local of parts.windows) {
        all.push(new Matrix4().multiplyMatrices(buildingMatrix, local))
      }
      byPlot.set(plot.id, [start, all.length - start])
    }

    return { matrices: all, ranges: byPlot }
  }, [])

  const windowsRef = useRef<InstancedMesh>(null)
  const groups = useRef(new Map<string, Object3D>())
  const lifts = useRef(new Map<string, number>())
  // Whose windows are currently hidden, so a change of room restores the old
  // building's windows as well as hiding the new one's. Undefined means not
  // known, which forces the next frame to apply visibility afresh.
  const hiddenFor = useRef<string | null | undefined>(undefined)
  const lastWindows = useRef<InstancedMesh | null>(null)

  // The window mesh writes every instance as visible whenever the matrices are
  // set, so whatever was hidden before has to be hidden again. Runs after the
  // mesh's own layout effect, because a parent's effects follow its children's.
  useLayoutEffect(() => {
    hiddenFor.current = undefined
  }, [matrices])

  const hoveredPlotId = useEstate((state) => state.hoveredPlotId)
  const activePlotId = useEstate((state) => state.activePlotId)
  const coarsePointer = useCoarsePointer()

  const register = useCallback((id: string, group: Object3D | null) => {
    if (group) groups.current.set(id, group)
    else groups.current.delete(id)
  }, [])

  useFrame((_, delta) => {
    const windows = windowsRef.current
    // A new mesh starts with every window showing: apply visibility afresh.
    if (windows !== lastWindows.current) {
      lastWindows.current = windows
      hiddenFor.current = undefined
    }
    const smoothing = 1 - Math.pow(UI.hoverLiftDecay, Math.min(delta, CAMERA.maxFrameDelta))
    const roomChanged = activePlotId !== hiddenFor.current
    let windowsMoved = false

    for (const plot of buildingPlots) {
      // The open plot's room stands in for its building, so it neither lifts
      // nor shows windows. Touch has no hover, so nothing else lifts there.
      const active = plot.id === activePlotId
      const raised = !active && !coarsePointer && plot.id === hoveredPlotId
      const target = raised ? UI.hoverLiftDistance : 0
      const current = lifts.current.get(plot.id) ?? 0
      const settled = Math.abs(target - current) < 0.0002
      const visibilityChanged = roomChanged && (active || plot.id === hiddenFor.current)
      if (settled && !visibilityChanged) continue

      const next = settled ? current : current + (target - current) * smoothing
      lifts.current.set(plot.id, next)
      // A lifting building, or one giving way to its room, moves its shadow.
      requestShadowUpdate()

      const group = groups.current.get(plot.id)
      if (group) group.position.y = next

      // Visibility is decided here, in the same write as the lift. Hiding in a
      // separate pass let a settling lift write the windows straight back.
      const range = ranges.get(plot.id)
      if (windows && range) {
        const [start, count] = range
        for (let index = start; index < start + count; index += 1) {
          if (active) {
            windows.setMatrixAt(index, HIDDEN_MATRIX)
          } else {
            liftedMatrix.copy(matrices[index])
            liftedMatrix.elements[13] += next
            windows.setMatrixAt(index, liftedMatrix)
          }
        }
        windowsMoved = true
      }
    }

    hiddenFor.current = activePlotId
    if (windowsMoved && windows) windows.instanceMatrix.needsUpdate = true
  })

  return (
    <group>
      {buildingPlots.map((plot) => (
        <BuildingGroup key={plot.id} plot={plot} onRegister={register} />
      ))}
      <Windows ref={windowsRef} matrices={matrices} />
      <Nameplates />
    </group>
  )
}
