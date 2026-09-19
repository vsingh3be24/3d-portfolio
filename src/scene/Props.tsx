import { forwardRef, useCallback, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  AdditiveBlending,
  BoxGeometry,
  CanvasTexture,
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  InstancedMesh,
  type Material,
  MeshBasicMaterial,
  MeshLambertMaterial,
  Object3D,
  PlaneGeometry,
  RingGeometry,
  SRGBColorSpace,
  TorusGeometry,
  Vector2,
  Vector3,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { plots } from '@/data/plots'
import { palette, themes } from '@/theme'
import { AMBIENT, BOUNDARY, COLORS, COMMUNITY, DUSK, ESTATE, PARK, ROAD, SLAB, TREES } from './constants'
import { getLanePoint, getPointAt, roadJunctions, roadLength, wrapU } from './curves'
import { gateAnchor, gateT, isOnSlab, slabOutline } from './slab'
import { stage, trackColour } from './dusk'
import { treeGeometry, treeMaterial, type TreeSpecies } from './trees'

// One material for every piece of static dressing. Colour rides on the vertices
// instead, so nine separate props collapse into a single draw call.
const dressingMaterial = new MeshLambertMaterial({ vertexColors: true })

const materials = {
  trunk: new MeshLambertMaterial({ color: COLORS.trunk }),
}
trackColour(materials.trunk.color, 'trunk')

// Seen in the pond as well as directly.
function reflected(object: Object3D | null) {
  object?.layers.enable(AMBIENT.reflectLayer)
}

function box(w: number, h: number, d: number, x = 0, y = 0, z = 0): BufferGeometry {
  const geometry = new BoxGeometry(w, h, d)
  geometry.translate(x, y, z)
  return geometry
}

// Bakes a flat colour into a geometry so it can be merged with differently
// coloured neighbours and still be drawn by one shared material.
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

function glowFlag(geometry: BufferGeometry, value: number) {
  const count = geometry.attributes.position.count
  geometry.setAttribute('aGlow', new BufferAttribute(new Float32Array(count).fill(value), 1))
}

// Streetlights are ink by day. At dusk their heads glow warm, which is a term
// added in the shader, so the lamps stay one instanced draw call.
const lampUniform = { value: 0 }
const lampMaterial = new MeshLambertMaterial({ color: COLORS.ink })
lampMaterial.onBeforeCompile = (shader) => {
  shader.uniforms.uLamp = lampUniform
  shader.uniforms.uLampColour = {
    value: new Color(themes.dusk.windowLit).multiplyScalar(DUSK.lampGlow),
  }
  shader.vertexShader = `attribute float aGlow;\nvarying float vGlow;\n${shader.vertexShader.replace(
    '#include <begin_vertex>',
    '#include <begin_vertex>\nvGlow = aGlow;',
  )}`
  shader.fragmentShader = `uniform float uLamp;\nuniform vec3 uLampColour;\nvarying float vGlow;\n${shader.fragmentShader.replace(
    '#include <emissivemap_fragment>',
    `#include <emissivemap_fragment>
    totalEmissiveRadiance += uLampColour * vGlow * uLamp;`,
  )}`
}
lampMaterial.customProgramCacheKey = () => 'street-lamp'

// The pool each lamp throws on the ground: a soft warm disc, added over what
// is below it. Stands in for bloom, which the frame budget can't afford.
function createPoolTexture(): CanvasTexture {
  const size = DUSK.poolTextureSize
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')!
  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(0.35, 'rgba(255,255,255,0.55)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  context.fillStyle = gradient
  context.fillRect(0, 0, size, size)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

const poolMaterial = new MeshBasicMaterial({
  color: themes.dusk.windowLit,
  map: createPoolTexture(),
  transparent: true,
  opacity: 0,
  blending: AdditiveBlending,
  depthWrite: false,
})

const poolGeometry = new PlaneGeometry(DUSK.poolRadius * 2, DUSK.poolRadius * 2)
poolGeometry.rotateX(-Math.PI / 2)

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

type TreePlacement = { x: number; z: number; scale: number; rotation: number; species: TreeSpecies; tint: Color }

// Sampled across the whole slab rather than in an annulus, because the rounded
// corners of the slab are exactly where an annulus leaves bald patches.
function placeTrees(): TreePlacement[] {
  const random = mulberry32(ESTATE.treeSeed)
  const placements: TreePlacement[] = []

  const roadSamples: Vector2[] = []
  const point = new Vector3()
  for (let index = 0; index < 260; index += 1) {
    getPointAt(index / 260, point)
    roadSamples.push(new Vector2(point.x, point.z))
  }

  // The approach from the gate is road too, so it needs the same clearance.
  const gate = gateAnchor()
  getPointAt(roadJunctions().gate.u, point)
  for (let index = 0; index <= 24; index += 1) {
    const t = index / 24
    roadSamples.push(new Vector2(gate.x + (point.x - gate.x) * t, gate.z + (point.z - gate.z) * t))
  }

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
    if (roadSamples.some((sample) => sample.distanceTo(candidate) < roadClearance)) continue
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
    tree.species = look() < TREES.broadleafShare ? 'broadleaf' : 'conifer'
    const brightness = 1 + (look() * 2 - 1) * TREES.brightnessRange
    const warmth = (look() * 2 - 1) * TREES.warmthRange
    tree.tint.setRGB(brightness * (1 + warmth), brightness, brightness * (1 - warmth))
  }

  return placements
}

// Streetlights spaced evenly round the ring, except that any lamp landing in a
// junction is slid along the kerb until it clears it. Even spacing alone put a
// lamp in the mouth of four of the six driveways.
function placeLamps(): number[] {
  const { plots: spurs, gate } = roadJunctions()
  const junctions = [...spurs, gate]

  return Array.from({ length: ESTATE.lampCount }, (_, index) => {
    let u = index / ESTATE.lampCount
    for (const junction of junctions) {
      const clear = (junction.halfWidth + ESTATE.lampJunctionClearance) / roadLength
      let delta = u - junction.u
      delta -= Math.round(delta)
      if (Math.abs(delta) < clear) u = junction.u + (delta >= 0 ? clear : -clear)
    }
    return wrapU(u)
  })
}

// Wrapped distance around the outline, used to leave a gap for the gate.
function outlineDistance(t: number, from: number): number {
  const delta = Math.abs(t - from)
  return Math.min(delta, 1 - delta)
}

// The wall and hedge are swept as segments along the slab's own outline, so
// they follow its rounded corners instead of approximating them with a circle.
function sweepBoundary(inset: number, width: number, height: number, colour: string) {
  const points = slabOutline(inset, BOUNDARY.divisions)
  const parts: BufferGeometry[] = []

  for (let index = 0; index < BOUNDARY.divisions; index += 1) {
    const t = (index + 0.5) / BOUNDARY.divisions
    if (outlineDistance(t, gateT()) < BOUNDARY.gateSpan / 2) continue

    const a = points[index]
    const b = points[index + 1]
    const dx = b.x - a.x
    const dz = b.y - a.y
    const length = Math.hypot(dx, dz)
    if (length < 1e-5) continue

    // Overlapped slightly so the outside of each corner never opens a seam.
    const segment = box(width, height, length * 1.4, 0, height / 2, 0)
    segment.rotateY(Math.atan2(dx, dz))
    segment.translate((a.x + b.x) / 2, 0, (a.y + b.y) / 2)
    parts.push(segment)
  }

  const merged = mergeGeometries(parts, false)
  parts.forEach((part) => part.dispose())
  return tint(merged, colour)
}

function buildGate(): BufferGeometry[] {
  const gate = gateAnchor()

  // Along the wall line, so the pillars land on the two cut ends of the gap.
  const alongX = Math.sin(gate.angle)
  const alongZ = Math.cos(gate.angle)
  // Half the gap, plus half a pillar, so each pillar closes one cut end of it.
  const reach = gate.gap / 2 + BOUNDARY.gatePillarSize / 2

  const parts: BufferGeometry[] = []

  for (const side of [1, -1]) {
    const pillar = box(
      BOUNDARY.gatePillarSize,
      BOUNDARY.gatePillarHeight,
      BOUNDARY.gatePillarSize,
      0,
      BOUNDARY.gatePillarHeight / 2,
      0,
    )
    pillar.rotateY(gate.angle)
    pillar.translate(gate.x + alongX * reach * side, 0, gate.z + alongZ * reach * side)
    parts.push(tint(pillar, palette.kerb))
  }

  const arch = box(
    BOUNDARY.gatePillarSize * 0.6,
    BOUNDARY.gateArchHeight,
    reach * 2,
    0,
    BOUNDARY.gatePillarHeight + BOUNDARY.gateArchHeight / 2,
    0,
  )
  arch.rotateY(gate.angle)
  arch.translate(gate.x, 0, gate.z)
  // Timber rather than ink: the gate sits at the front of the default view, and
  // a black beam there reads as a monolith. Never a roof colour, since each of
  // those belongs to a plot.
  parts.push(tint(arch, palette.woodDark))

  return parts
}

function buildCommunityBlock(): BufferGeometry[] {
  const walls = box(COMMUNITY.width, COMMUNITY.height, COMMUNITY.depth, 0, COMMUNITY.height / 2, 0)
  const roof = box(
    COMMUNITY.width + COMMUNITY.roofOverhang * 2,
    COMMUNITY.roofHeight,
    COMMUNITY.depth + COMMUNITY.roofOverhang * 2,
    0,
    COMMUNITY.height + COMMUNITY.roofHeight / 2,
    0,
  )

  // Neutral roof: every accent colour is a plot's identity, and this block
  // belongs to the society, not to any one plot.
  return [tint(walls, palette.sand), tint(roof, palette.kerb)].map((part) => {
    part.rotateY(COMMUNITY.rotation)
    part.translate(COMMUNITY.position[0], 0, COMMUNITY.position[2])
    return part
  })
}

type EstateResources = {
  lamp: BufferGeometry
  bench: BufferGeometry
  // Flat on the ground: receives shadow, casts none, so it never shadow-acnes
  // against the surface it is lying on.
  flat: BufferGeometry
  // Everything with height, merged into one shadow-casting mesh.
  standing: BufferGeometry
  trees: TreePlacement[]
  lamps: number[]
}

let resources: EstateResources | null = null

function getResources(): EstateResources {
  if (resources) return resources

  const pole = new CylinderGeometry(0.045, 0.055, ESTATE.lampHeight, 8)
  pole.translate(0, ESTATE.lampHeight / 2, 0)
  const head = box(0.26, 0.12, 0.26, 0, ESTATE.lampHeight + 0.06, 0)
  // Which vertices glow at dusk: the head does, the pole never does.
  glowFlag(pole, 0)
  glowFlag(head, 1)
  const lamp = mergeGeometries([pole, head], false)
  pole.dispose()
  head.dispose()

  const bench = mergeGeometries(
    [
      box(1.0, 0.07, 0.34, 0, 0.34, 0),
      box(1.0, 0.28, 0.07, 0, 0.5, -0.14),
      box(0.08, 0.34, 0.3, -0.42, 0.17, 0),
      box(0.08, 0.34, 0.3, 0.42, 0.17, 0),
    ],
    false,
  )

  const pondRim = new TorusGeometry(PARK.pondRadius, 0.11, 6, 40)
  pondRim.rotateX(-Math.PI / 2)
  pondRim.translate(PARK.pondCentre[0], PARK.pondY, PARK.pondCentre[1])

  const path = new RingGeometry(PARK.pathInnerRadius, PARK.pathOuterRadius, 56)
  path.rotateX(-Math.PI / 2)
  path.translate(0, PARK.pathY, 0)

  const contact = plots.find((plot) => plot.kind === 'contact')!
  const boardY = ESTATE.noticeBoardPostHeight + ESTATE.noticeBoardHeight / 2
  const noticeParts = [
    box(0.1, ESTATE.noticeBoardPostHeight, 0.1, -ESTATE.noticeBoardWidth / 2 + 0.15, ESTATE.noticeBoardPostHeight / 2, 0),
    box(0.1, ESTATE.noticeBoardPostHeight, 0.1, ESTATE.noticeBoardWidth / 2 - 0.15, ESTATE.noticeBoardPostHeight / 2, 0),
    box(ESTATE.noticeBoardWidth + 0.12, ESTATE.noticeBoardHeight + 0.12, 0.08, 0, boardY, 0),
  ]
  const noticeBoard = mergeGeometries(noticeParts, false)
  noticeParts.forEach((part) => part.dispose())
  noticeBoard.rotateY(contact.rotation)
  noticeBoard.translate(contact.position[0], 0, contact.position[2])

  const noticePanel = box(ESTATE.noticeBoardWidth, ESTATE.noticeBoardHeight, 0.03, 0, boardY, 0.06)
  noticePanel.rotateY(contact.rotation)
  noticePanel.translate(contact.position[0], 0, contact.position[2])

  resources = {
    lamp,
    bench,
    flat: mergeGeometries(
      [tint(pondRim, palette.kerb), tint(path, palette.path)],
      false,
    ),
    standing: mergeGeometries(
      [
        sweepBoundary(BOUNDARY.inset, BOUNDARY.wallThickness, BOUNDARY.wallHeight, palette.kerb),
        sweepBoundary(
          BOUNDARY.inset + (BOUNDARY.wallThickness + BOUNDARY.hedgeThickness) / 2,
          BOUNDARY.hedgeThickness,
          BOUNDARY.hedgeHeight,
          palette.hedge,
        ),
        ...buildGate(),
        ...buildCommunityBlock(),
        tint(noticeBoard, palette.ink),
        tint(noticePanel, palette.paper),
      ],
      false,
    ),
    trees: placeTrees(),
    lamps: placeLamps(),
  }

  return resources
}

export function Props() {
  const parts = getResources()

  const lampTransform = useMemo(
    () => (dummy: Object3D, index: number) => {
      const point = getLanePoint(parts.lamps[index], ROAD.width / 2 + ROAD.kerbWidth + 0.28, new Vector3())
      dummy.position.set(point.x, ROAD.kerbY, point.z)
      dummy.rotation.set(0, 0, 0)
      dummy.scale.setScalar(1)
    },
    [parts.lamps],
  )

  const poolTransform = useMemo(
    () => (dummy: Object3D, index: number) => {
      lampTransform(dummy, index)
      dummy.position.y = DUSK.poolY
    },
    [lampTransform],
  )

  const poolsRef = useRef<InstancedMesh>(null)
  const lampLevel = useRef(-1)

  // Lamps come on last in the dusk sequence. By day the pools are not drawn
  // at all, so they cost the daytime scene nothing.
  useFrame(() => {
    const level = stage(DUSK.lampStart, DUSK.lampEnd)
    if (level === lampLevel.current) return
    lampLevel.current = level
    lampUniform.value = level
    poolMaterial.opacity = DUSK.poolOpacity * level
    if (poolsRef.current) poolsRef.current.visible = level > 0
  })

  const benchTransform = useMemo(
    () => (dummy: Object3D, index: number) => {
      const angle = (index / PARK.benchCount) * Math.PI * 2 + 0.4
      const x = PARK.pondCentre[0] + Math.sin(angle) * PARK.benchRadius
      const z = PARK.pondCentre[1] + Math.cos(angle) * PARK.benchRadius
      dummy.position.set(x, 0, z)
      // Benches turn to look back at the water.
      dummy.rotation.set(0, angle + Math.PI, 0)
      dummy.scale.setScalar(1)
    },
    [],
  )

  return (
    <group>
      <mesh geometry={parts.flat} material={dressingMaterial} receiveShadow castShadow={false} />
      {/* Not reflected: the wall and gate stand at the slab's edge, beyond
          anything the pond can mirror from the camera's heights. */}
      <mesh geometry={parts.standing} material={dressingMaterial} castShadow receiveShadow />

      <TreeInstances trees={parts.trees} species="broadleaf" />
      <TreeInstances trees={parts.trees} species="conifer" />
      <CountedInstances
        ref={reflected}
        geometry={parts.lamp}
        material={lampMaterial}
        count={ESTATE.lampCount}
        transform={lampTransform}
      />
      <CountedInstances
        ref={poolsRef}
        geometry={poolGeometry}
        material={poolMaterial}
        count={ESTATE.lampCount}
        transform={poolTransform}
        castShadow={false}
      />
      <CountedInstances
        geometry={parts.bench}
        material={materials.trunk}
        count={PARK.benchCount}
        transform={benchTransform}
      />
    </group>
  )
}

type CountedInstancesProps = {
  geometry: BufferGeometry
  material: Material
  count: number
  transform: (dummy: Object3D, index: number) => void
  castShadow?: boolean
}

const CountedInstances = forwardRef<InstancedMesh, CountedInstancesProps>(function CountedInstances(
  { geometry, material, count, transform, castShadow = true },
  ref,
) {
  const meshRef = useRef<InstancedMesh | null>(null)
  // Forwards the live mesh whenever it is attached, never a handle captured
  // once at mount that goes stale if the instance is recreated.
  const attach = useCallback(
    (mesh: InstancedMesh | null) => {
      meshRef.current = mesh
      if (typeof ref === 'function') ref(mesh)
      else if (ref) ref.current = mesh
    },
    [ref],
  )

  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh || count === 0) return
    const dummy = new Object3D()
    for (let index = 0; index < count; index += 1) {
      transform(dummy, index)
      dummy.updateMatrix()
      mesh.setMatrixAt(index, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [count, transform])

  if (count === 0) return null

  return (
    <instancedMesh
      ref={attach}
      args={[geometry, material, count]}
      castShadow={castShadow}
      receiveShadow={false}
    />
  )
})

// One instanced mesh per species, each tree carrying its own colour variation.
function TreeInstances({ trees, species }: { trees: TreePlacement[]; species: TreeSpecies }) {
  const own = useMemo(() => trees.filter((tree) => tree.species === species), [trees, species])
  const meshRef = useRef<InstancedMesh>(null)

  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    const dummy = new Object3D()
    own.forEach((tree, index) => {
      dummy.position.set(tree.x, 0, tree.z)
      dummy.rotation.set(0, tree.rotation, 0)
      dummy.scale.setScalar(tree.scale)
      dummy.updateMatrix()
      mesh.setMatrixAt(index, dummy.matrix)
      mesh.setColorAt(index, tree.tint)
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [own])

  if (own.length === 0) return null

  return (
    <instancedMesh
      ref={(mesh) => {
        meshRef.current = mesh
        reflected(mesh)
      }}
      args={[treeGeometry(species), treeMaterial, own.length]}
      castShadow
      receiveShadow={false}
    />
  )
}
