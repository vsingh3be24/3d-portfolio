import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  ExtrudeGeometry,
  MeshLambertMaterial,
  Shape,
  Vector2,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { TRAFFIC, type VehicleBody } from './constants'

// Which kind of lamp a vertex belongs to, if any.
const LIGHT_NONE = 0
const LIGHT_HEAD = 1
const LIGHT_TAIL = 2

// Every part carries the same attributes, so the parts merge into one mesh:
// its colour, whether it takes the car's paint, and whether it is a lamp.
function part(geometry: BufferGeometry, colour: string, paint: number, light = LIGHT_NONE): BufferGeometry {
  const flat = geometry.index ? geometry.toNonIndexed() : geometry
  if (flat !== geometry) geometry.dispose()
  flat.deleteAttribute('uv')
  const count = flat.attributes.position.count
  const value = new Color(colour)
  const colours = new Float32Array(count * 3)
  for (let index = 0; index < count; index += 1) {
    colours[index * 3] = value.r
    colours[index * 3 + 1] = value.g
    colours[index * 3 + 2] = value.b
  }
  flat.setAttribute('color', new BufferAttribute(colours, 3))
  flat.setAttribute('aPaint', new BufferAttribute(new Float32Array(count).fill(paint), 1))
  flat.setAttribute('aLight', new BufferAttribute(new Float32Array(count).fill(light), 1))
  return flat
}

function box(w: number, h: number, d: number, x: number, y: number, z: number): BufferGeometry {
  const geometry = new BoxGeometry(w, h, d)
  geometry.translate(x, y, z)
  return geometry
}

// A side profile pushed out across the car's width. The profile's first axis
// runs along the car, so it is turned to face forward along +z.
function sideProfile(points: [number, number][], width: number, bevel: number): BufferGeometry {
  const shape = new Shape(points.map(([along, up]) => new Vector2(along, up)))
  const depth = width - bevel * 2
  const geometry = new ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 1,
    curveSegments: 1,
  })
  geometry.rotateY(-Math.PI / 2)
  geometry.translate(depth / 2, 0, 0)
  return geometry
}

function buildBody(kind: VehicleBody): BufferGeometry {
  const spec = TRAFFIC[kind]
  const width = TRAFFIC.bodyWidth
  const bevel = TRAFFIC.bodyBevel
  const front = Math.max(...spec.lower.map(([along]) => along)) + bevel
  const rear = Math.min(...spec.lower.map(([along]) => along)) - bevel
  const belt = Math.max(...spec.lower.map(([, up]) => up))
  const cabinFront = Math.max(...spec.cabin.map(([along]) => along))
  const roofLength = spec.roof.to - spec.roof.from

  const parts = [
    part(sideProfile(spec.lower, width, bevel), '#ffffff', 1),
    part(sideProfile(spec.cabin, TRAFFIC.cabinWidth, 0), TRAFFIC.glass, 0),
    part(
      box(TRAFFIC.cabinWidth + 0.02, TRAFFIC.roofThickness, roofLength, 0, spec.roof.top + TRAFFIC.roofThickness / 2, (spec.roof.from + spec.roof.to) / 2),
      '#ffffff',
      1,
    ),
    // Bumpers and grille, in dark trim.
    part(box(width + 0.02, 0.07, 0.06, 0, 0.15, front - 0.02), TRAFFIC.trim, 0),
    part(box(width + 0.02, 0.07, 0.06, 0, 0.15, rear + 0.02), TRAFFIC.trim, 0),
    part(box(0.28, 0.06, 0.015, 0, spec.lightY - 0.01, front + 0.004), TRAFFIC.trim, 0),
    // Mirrors, in the car's paint.
    part(box(0.05, 0.04, 0.07, width / 2 + 0.03, belt + 0.06, cabinFront - 0.08), '#ffffff', 1),
    part(box(0.05, 0.04, 0.07, -width / 2 - 0.03, belt + 0.06, cabinFront - 0.08), '#ffffff', 1),
  ]
  for (const side of [-1, 1]) {
    parts.push(part(box(0.17, 0.065, 0.02, side * 0.26, spec.lightY, front + 0.005), TRAFFIC.headlight, 0, LIGHT_HEAD))
    parts.push(part(box(0.16, 0.06, 0.02, side * 0.27, spec.lightY + 0.02, rear - 0.005), TRAFFIC.taillight, 0, LIGHT_TAIL))
  }

  const merged = mergeGeometries(parts, false)
  parts.forEach((piece) => piece.dispose())
  merged.computeBoundingSphere()
  return merged
}

// Both wheels of an axle in one geometry, so spinning the pair is a single
// rotation. A spoke on each hub is what lets the spin be seen at all.
function buildAxle(): BufferGeometry {
  const wheels: BufferGeometry[] = []
  for (const side of [-1, 1]) {
    const tyre = new CylinderGeometry(TRAFFIC.wheelRadius, TRAFFIC.wheelRadius, TRAFFIC.wheelWidth, 14)
    const hub = new CylinderGeometry(TRAFFIC.hubRadius, TRAFFIC.hubRadius, TRAFFIC.wheelWidth + 0.012, 10)
    const spoke = new BoxGeometry(0.022, TRAFFIC.hubRadius * 1.6, TRAFFIC.wheelWidth + 0.016)
    spoke.rotateX(Math.PI / 2)
    for (const [geometry, colour] of [
      [tyre, TRAFFIC.trim],
      [hub, TRAFFIC.hub],
      [spoke, TRAFFIC.trim],
    ] as [BufferGeometry, string][]) {
      geometry.rotateZ(Math.PI / 2)
      geometry.translate((side * TRAFFIC.track) / 2, 0, 0)
      wheels.push(part(geometry, colour, 0))
    }
  }
  const merged = mergeGeometries(wheels, false)
  wheels.forEach((piece) => piece.dispose())
  return merged
}

let bodies: Record<VehicleBody, BufferGeometry> | null = null
let axle: BufferGeometry | null = null

export function bodyGeometry(kind: VehicleBody): BufferGeometry {
  if (!bodies) bodies = { sedan: buildBody('sedan'), suv: buildBody('suv') }
  return bodies[kind]
}

export function axleGeometry(): BufferGeometry {
  if (!axle) axle = buildAxle()
  return axle
}

// How far into dusk the lamps are: 0 by day, 1 once they are fully on.
export const carLights = { value: 0 }

// The body shader: each instance's colour lands only on painted parts, so the
// glass, trim and lamps keep their own colours on every car. Headlights glow
// once the lamps come on; tail lights glow dimly at night and fully under
// braking, whatever the time of day. aBrake is per car, set every frame.
export const bodyMaterial = new MeshLambertMaterial({ vertexColors: true })
bodyMaterial.onBeforeCompile = (shader) => {
  shader.uniforms.uLights = carLights
  shader.uniforms.uHeadColour = { value: new Color(TRAFFIC.headlightGlow).multiplyScalar(TRAFFIC.headlightStrength) }
  shader.uniforms.uTailColour = { value: new Color(TRAFFIC.taillightGlow).multiplyScalar(TRAFFIC.taillightStrength) }
  shader.vertexShader = `attribute float aPaint;
attribute float aLight;
attribute float aBrake;
varying float vHead;
varying float vTail;
varying float vBrake;
${shader.vertexShader.replace(
  '#include <color_vertex>',
  `vColor = vec4( 1.0 );
  vColor.rgb *= color;
  #ifdef USE_INSTANCING_COLOR
    vColor.rgb *= mix( vec3( 1.0 ), instanceColor.rgb, aPaint );
  #endif
  vHead = 1.0 - step( 0.5, abs( aLight - ${LIGHT_HEAD}.0 ) );
  vTail = 1.0 - step( 0.5, abs( aLight - ${LIGHT_TAIL}.0 ) );
  vBrake = aBrake;`,
)}`
  shader.fragmentShader = `uniform float uLights;
uniform vec3 uHeadColour;
uniform vec3 uTailColour;
varying float vHead;
varying float vTail;
varying float vBrake;
${shader.fragmentShader.replace(
  '#include <emissivemap_fragment>',
  `#include <emissivemap_fragment>
  totalEmissiveRadiance += uHeadColour * vHead * uLights;
  totalEmissiveRadiance += uTailColour * vTail * max( uLights * ${TRAFFIC.taillightNight.toFixed(3)}, vBrake );`,
)}`
}
bodyMaterial.customProgramCacheKey = () => 'car-body'

export const wheelMaterial = new MeshLambertMaterial({ vertexColors: true })

// A soft wash of light, brightest just ahead of the car and fading forward
// and to the sides: what headlights throw on the road at night.
export function createBeamTexture(): CanvasTexture {
  const size = TRAFFIC.beamTextureSize
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')!
  const image = context.createImageData(size, size)
  for (let y = 0; y < size; y += 1) {
    // Canvas rows run down; row 0 is the far end of the beam.
    const along = 1 - y / (size - 1)
    const spread = 0.35 + along * 0.65
    for (let x = 0; x < size; x += 1) {
      const across = Math.abs(x / (size - 1) - 0.5) * 2
      const side = Math.max(0, 1 - (across / spread) ** 2)
      const reach = Math.sin(Math.min(along * 1.3, 1) * Math.PI) * (1 - along * 0.55)
      const alpha = Math.max(0, side * reach)
      const index = (y * size + x) * 4
      image.data[index] = 255
      image.data[index + 1] = 255
      image.data[index + 2] = 255
      image.data[index + 3] = Math.round(alpha * 255)
    }
  }
  context.putImageData(image, 0, 0)
  return new CanvasTexture(canvas)
}
