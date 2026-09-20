import {
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  IcosahedronGeometry,
  MeshLambertMaterial,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { palette } from '@/theme'
import { ambientTime } from './ambient'
import { BUSHES, TREES } from './constants'
import { trackTint } from './dusk'

export type TreeSpecies = 'broadleaf' | 'conifer' | 'column'

// A repeatable number in [-1, 1] for a point in space. Keyed on position, so
// the copies of a vertex shared between faces all move together and the
// crown stays closed when it is roughened.
function hash(x: number, y: number, z: number): number {
  const value = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453
  return (value - Math.floor(value)) * 2 - 1
}

// Pushes each vertex in or out from a centre by up to `amount` of its
// distance, so a perfect sphere or cone reads as foliage.
function roughen(geometry: BufferGeometry, cx: number, cy: number, cz: number, amount: number) {
  const position = geometry.attributes.position as BufferAttribute
  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index)
    const y = position.getY(index)
    const z = position.getZ(index)
    const k = 1 + hash(x, y, z) * amount
    position.setXYZ(index, cx + (x - cx) * k, cy + (y - cy) * k, cz + (z - cz) * k)
  }
}

// Colour on the vertices, darker at the bottom of the tree than the top.
function shade(geometry: BufferGeometry, base: string, bottom: number, top: number, low: number, high: number) {
  const colour = new Color(base)
  const position = geometry.attributes.position as BufferAttribute
  const colours = new Float32Array(position.count * 3)
  for (let index = 0; index < position.count; index += 1) {
    const t = Math.min(Math.max((position.getY(index) - low) / (high - low), 0), 1)
    const k = bottom + (top - bottom) * t
    colours[index * 3] = colour.r * k
    colours[index * 3 + 1] = colour.g * k
    colours[index * 3 + 2] = colour.b * k
  }
  geometry.setAttribute('color', new BufferAttribute(colours, 3))
}

// Faceted, like the rest of the estate: every face keeps its own normal.
function faceted(geometry: BufferGeometry): BufferGeometry {
  const flat = geometry.index ? geometry.toNonIndexed() : geometry
  if (flat !== geometry) geometry.dispose()
  flat.deleteAttribute('uv')
  flat.deleteAttribute('normal')
  return flat
}

function trunk(height: number, top: number, bottom: number): BufferGeometry {
  const geometry = faceted(new CylinderGeometry(top, bottom, height, 6))
  geometry.translate(0, height / 2, 0)
  shade(geometry, palette.trunk, 0.8, 1, 0, height)
  return geometry
}

function finish(parts: BufferGeometry[]): BufferGeometry {
  const merged = mergeGeometries(parts, false)
  parts.forEach((part) => part.dispose())
  merged.computeVertexNormals()
  merged.computeBoundingSphere()
  return merged
}

// A trunk under a crown of overlapping blobs. Both the round tree and the
// tall narrow one are this shape with different clumps.
function clumped(spec: {
  trunkHeight: number
  trunkRadiusTop: number
  trunkRadiusBottom: number
  clumps: readonly (readonly [number, number, number, number])[]
  lumpiness: number
}): BufferGeometry {
  const top = Math.max(...spec.clumps.map(([, y, , r]) => y + r))
  const parts = [trunk(spec.trunkHeight, spec.trunkRadiusTop, spec.trunkRadiusBottom)]
  for (const [x, y, z, radius] of spec.clumps) {
    const clump = faceted(new IcosahedronGeometry(radius, 1))
    clump.translate(x, y, z)
    roughen(clump, x, y, z, spec.lumpiness)
    shade(clump, palette.foliage, TREES.shadeBottom, TREES.shadeTop, spec.trunkHeight * 0.8, top)
    parts.push(clump)
  }
  return finish(parts)
}

function conifer(): BufferGeometry {
  const spec = TREES.conifer
  const [, topHeight, topY] = spec.tiers[spec.tiers.length - 1]
  const top = topY + topHeight / 2
  const parts = [trunk(spec.trunkHeight, spec.trunkRadiusTop, spec.trunkRadiusBottom)]
  spec.tiers.forEach(([radius, height, y], index) => {
    const tier = faceted(new ConeGeometry(radius, height, spec.segments))
    // Each tier turned a little, so their facets don't line up in columns.
    tier.rotateY(index * 0.7)
    tier.translate(0, y, 0)
    roughen(tier, 0, y, 0, spec.lumpiness)
    shade(tier, palette.foliageDark, TREES.shadeBottom, TREES.shadeTop, spec.trunkHeight * 0.6, top)
    parts.push(tier)
  })
  return finish(parts)
}

// A shrub: the same crown, lower and smaller, in the hedge's colour.
function bush(): BufferGeometry {
  const parts: BufferGeometry[] = []
  const top = Math.max(...BUSHES.clumps.map(([, y, , r]) => y + r))
  for (const [x, y, z, radius] of BUSHES.clumps) {
    const clump = faceted(new IcosahedronGeometry(radius, 1))
    clump.translate(x, y, z)
    roughen(clump, x, y, z, BUSHES.lumpiness)
    shade(clump, palette.hedge, TREES.shadeBottom, TREES.shadeTop, 0, top)
    parts.push(clump)
  }
  return finish(parts)
}

let geometries: Record<TreeSpecies, BufferGeometry> | null = null
let bushGeometry: BufferGeometry | null = null

export function treeGeometry(species: TreeSpecies): BufferGeometry {
  if (!geometries) {
    geometries = {
      broadleaf: clumped(TREES.broadleaf),
      conifer: conifer(),
      column: clumped(TREES.column),
    }
  }
  return geometries[species]
}

export function shrubGeometry(): BufferGeometry {
  if (!bushGeometry) bushGeometry = bush()
  return bushGeometry
}

// One material for both species. Colour is on the vertices (the day palette)
// and on each instance (its variation); the material colour carries only the
// day-to-dusk tint. The vertex shader bends each crown in the wind, harder
// towards the top, each tree on its own phase so a stand never moves in step.
export const treeMaterial = new MeshLambertMaterial({ vertexColors: true, flatShading: true })
trackTint(treeMaterial.color, 'foliage')

treeMaterial.onBeforeCompile = (shader) => {
  shader.uniforms.uTime = ambientTime
  shader.vertexShader = `uniform float uTime;\n${shader.vertexShader.replace(
    '#include <begin_vertex>',
    `#include <begin_vertex>
    #ifdef USE_INSTANCING
      vec3 treeRoot = instanceMatrix[3].xyz;
    #else
      vec3 treeRoot = vec3(0.0);
    #endif
    float bend = max(transformed.y - ${TREES.swayBase.toFixed(3)}, 0.0) / ${TREES.swayHeight.toFixed(3)};
    bend *= bend;
    float phase = treeRoot.x * 0.37 + treeRoot.z * 0.29;
    float t = uTime * ${TREES.swaySpeed.toFixed(3)};
    float gust = sin(t + phase) + 0.35 * sin(t * 2.3 + phase * 1.7);
    transformed.x += gust * ${TREES.swayAmplitude.toFixed(3)} * bend;
    transformed.z += cos(t * 0.8 + phase) * ${(TREES.swayAmplitude * 0.6).toFixed(3)} * bend;`,
  )}`
}
treeMaterial.customProgramCacheKey = () => 'tree-sway'
