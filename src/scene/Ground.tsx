import {
  CanvasTexture,
  Color,
  DoubleSide,
  ExtrudeGeometry,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  type BufferGeometry,
} from 'three'
import { palette } from '@/theme'
import { GROUND, SLAB } from './constants'
import { trackColour, trackTint } from './dusk'
import { slabShape } from './slab'

type GroundResources = {
  slab: BufferGeometry
  topMaterial: MeshLambertMaterial
  edgeMaterial: MeshLambertMaterial
  shadow: PlaneGeometry
  shadowMaterial: MeshBasicMaterial
}

let resources: GroundResources | null = null

// A repeatable number in [0, 1), so the lawn is mottled the same way on
// every load rather than freshly random each time.
function mulberry32(seed: number) {
  let state = seed
  return () => {
    state |= 0
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Grass, painted once: patches of slightly lighter and darker green under a
// soft falloff towards the edges. Without the patches 1400 square units read
// as one dead fill; with them it reads as ground that grew rather than ground
// that was filled in.
function createGrassTexture(): CanvasTexture {
  const size = GROUND.grassTextureSize
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size

  const context = canvas.getContext('2d')!
  context.fillStyle = palette.slabTop
  context.fillRect(0, 0, size, size)

  const random = mulberry32(GROUND.grassSeed)
  const light = new Color(palette.slabTop).lerp(new Color('#ffffff'), GROUND.patchLift).getStyle()
  const dark = palette.grassDark
  for (let index = 0; index < GROUND.patchCount; index += 1) {
    const x = random() * size
    const y = random() * size
    const radius = size * (GROUND.patchRadius[0] + random() * (GROUND.patchRadius[1] - GROUND.patchRadius[0]))
    const colour = random() < 0.5 ? light : dark
    const patch = context.createRadialGradient(x, y, 0, x, y, radius)
    patch.addColorStop(0, colour)
    patch.addColorStop(1, 'rgba(0,0,0,0)')
    context.globalAlpha = GROUND.patchOpacity[0] + random() * (GROUND.patchOpacity[1] - GROUND.patchOpacity[0])
    context.fillStyle = patch
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2)
  }
  context.globalAlpha = 1

  // The estate's middle stays the brightest of it, the lip the deepest.
  const falloff = context.createRadialGradient(size / 2, size / 2, size * 0.1, size / 2, size / 2, size * 0.62)
  falloff.addColorStop(0, 'rgba(0,0,0,0)')
  falloff.addColorStop(0.55, 'rgba(0,0,0,0)')
  falloff.addColorStop(1, dark)
  context.globalAlpha = GROUND.falloffOpacity
  context.fillStyle = falloff
  context.fillRect(0, 0, size, size)
  context.globalAlpha = 1

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  // The slab's own UVs are world units, running -width/2 to width/2, so the
  // texture is scaled onto them rather than tiled once per unit — which, with
  // clamped wrapping, left the whole lawn the colour of the texture's edge.
  texture.repeat.set(1 / SLAB.width, 1 / SLAB.depth)
  texture.offset.set(0.5, 0.5)
  texture.anisotropy = GROUND.anisotropy
  return texture
}

// Radial falloff painted once. A real shadow map has nothing to fall on here,
// because the slab floats over flat background colour.
function createShadowTexture(): CanvasTexture {
  const size = SLAB.shadowTextureSize
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size

  const context = canvas.getContext('2d')!
  const gradient = context.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  )
  gradient.addColorStop(0, 'rgba(0,0,0,1)')
  gradient.addColorStop(0.55, 'rgba(0,0,0,0.72)')
  gradient.addColorStop(1, 'rgba(0,0,0,0)')
  context.fillStyle = gradient
  context.fillRect(0, 0, size, size)

  return new CanvasTexture(canvas)
}

function getResources(): GroundResources {
  if (resources) return resources

  const slab = new ExtrudeGeometry(slabShape(), {
    depth: SLAB.thickness,
    bevelEnabled: true,
    bevelThickness: SLAB.bevel,
    bevelSize: SLAB.bevel,
    bevelOffset: 0,
    bevelSegments: SLAB.bevelSegments,
    curveSegments: SLAB.curveSegments,
  })

  // Extrusion runs along +Z, so the slab is laid flat and then dropped until
  // its top face sits exactly on y = 0 — the height every other prop assumes.
  slab.rotateX(-Math.PI / 2)
  slab.computeBoundingBox()
  slab.translate(0, SLAB.topY - slab.boundingBox!.max.y, 0)
  slab.computeVertexNormals()

  const shadow = new PlaneGeometry(SLAB.width * SLAB.shadowScale, SLAB.depth * SLAB.shadowScale)
  shadow.rotateX(-Math.PI / 2)

  const topMaterial = new MeshLambertMaterial({ map: createGrassTexture() })
  const edgeMaterial = new MeshLambertMaterial({ color: palette.slabEdge })
  trackTint(topMaterial.color, 'slabTop')
  trackColour(edgeMaterial.color, 'slabEdge')

  resources = {
    slab,
    topMaterial,
    edgeMaterial,
    shadow,
    shadowMaterial: new MeshBasicMaterial({
      map: createShadowTexture(),
      transparent: true,
      opacity: SLAB.shadowOpacity,
      // Never occludes anything: it exists only to darken empty background.
      depthWrite: false,
      side: DoubleSide,
    }),
  }

  return resources
}

export function Ground() {
  const { slab, topMaterial, edgeMaterial, shadow, shadowMaterial } = getResources()

  return (
    <group>
      {/* ExtrudeGeometry groups the flat caps as material 0 and the swept sides
          as material 1, which is exactly the grass/soil split the slab wants. */}
      <mesh
        geometry={slab}
        material={[topMaterial, edgeMaterial]}
        receiveShadow
        castShadow={false}
      />
      <mesh
        geometry={shadow}
        material={shadowMaterial}
        position={[0, SLAB.topY - SLAB.thickness - SLAB.shadowDrop, 0]}
        receiveShadow={false}
        castShadow={false}
        raycast={() => null}
      />
    </group>
  )
}
