import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  LatheGeometry,
  MeshLambertMaterial,
  RingGeometry,
  ShaderMaterial,
  Vector2,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { palette } from '@/theme'
import { ambientTime } from './ambient'
import { AMBIENT, FOUNTAIN, PARK } from './constants'
import { duskLevel, trackColour } from './dusk'

const f = (value: number) => value.toFixed(4)
const [CX, CZ] = PARK.pondCentre

function centred<T extends BufferGeometry>(geometry: T, y = 0): T {
  geometry.translate(CX, y, CZ)
  return geometry
}

// Pedestal, lower bowl, stem, upper bowl and nozzle, stacked in the pond.
function buildStone(): BufferGeometry {
  const { pedestal, lowerBowl, stem, upperBowl, nozzle } = FOUNTAIN
  const stack = (radiusTop: number, radiusBottom: number, bottom: number, top: number, segments: number) =>
    centred(new CylinderGeometry(radiusTop, radiusBottom, top - bottom, segments), (top + bottom) / 2)
  const parts = [
    stack(pedestal.radiusTop, pedestal.radiusBottom, PARK.pondY, pedestal.top, 16),
    stack(lowerBowl.radiusTop, lowerBowl.radiusBottom, lowerBowl.bottom, lowerBowl.top, 32),
    stack(stem.radiusTop, stem.radiusBottom, lowerBowl.top, stem.top, 12),
    stack(upperBowl.radiusTop, upperBowl.radiusBottom, stem.top, upperBowl.top, 24),
    stack(nozzle.radius, nozzle.radius * 1.4, upperBowl.top, nozzle.top, 8),
  ]
  const stone = mergeGeometries(parts, false)
  parts.forEach((part) => part.dispose())
  return stone
}

// The three falls, each a profile spun round the centre. The lathe's v runs
// along the profile from where the water leaves to where it lands, which is
// the direction the streaks flow.
function buildFalls(): BufferGeometry {
  const sheets = [FOUNTAIN.bell, FOUNTAIN.upperFall, FOUNTAIN.lowerFall].map((profile) =>
    centred(new LatheGeometry(profile.map(([r, y]) => new Vector2(r, y)), FOUNTAIN.segments)),
  )
  const falls = mergeGeometries(sheets, false)
  sheets.forEach((sheet) => sheet.dispose())
  return falls
}

// Still water in each bowl, and a foam ring where each fall lands. aFoam
// tells the shader which is which.
function buildSurfaces(): BufferGeometry {
  const flat = (geometry: BufferGeometry, y: number, foam: number) => {
    geometry.rotateX(-Math.PI / 2)
    centred(geometry, y)
    const surface = geometry.index ? geometry.toNonIndexed() : geometry
    surface.deleteAttribute('uv')
    surface.setAttribute('aFoam', new BufferAttribute(new Float32Array(surface.attributes.position.count).fill(foam), 1))
    return surface
  }
  const { lowerBowl, upperBowl } = FOUNTAIN
  const parts = [
    flat(new CircleGeometry(lowerBowl.waterRadius, 32), lowerBowl.water, 0),
    flat(new CircleGeometry(upperBowl.waterRadius, 24), upperBowl.water, 0),
    // Foam sits a hair above the water it churns, and is drawn after it.
    ...FOUNTAIN.foam.map(([inner, outer, y]) => flat(new RingGeometry(inner, outer, FOUNTAIN.segments, 1), y + 0.003, 1)),
  ]
  const surfaces = mergeGeometries(parts, false)
  parts.forEach((part) => part.dispose())
  return surfaces
}

const stoneMaterial = new MeshLambertMaterial({ color: palette.kerb })
trackColour(stoneMaterial.color, 'kerb')

const tint = new Color()
trackColour(tint, 'water')
// Unlit, so it dims with dusk by hand.
const light = { value: 1 }

const NOISE_GLSL = /* glsl */ `
  float hash( vec3 p ) {
    p = fract( p * 0.3183099 + 0.1 );
    p *= 17.0;
    return fract( p.x * p.y * p.z * ( p.x + p.y + p.z ) );
  }
  float noise( vec3 x ) {
    vec3 i = floor( x );
    vec3 f = fract( x );
    f = f * f * ( 3.0 - 2.0 * f );
    return mix(
      mix( mix( hash( i ), hash( i + vec3( 1, 0, 0 ) ), f.x ),
           mix( hash( i + vec3( 0, 1, 0 ) ), hash( i + vec3( 1, 1, 0 ) ), f.x ), f.y ),
      mix( mix( hash( i + vec3( 0, 0, 1 ) ), hash( i + vec3( 1, 0, 1 ) ), f.x ),
           mix( hash( i + vec3( 0, 1, 1 ) ), hash( i + vec3( 1, 1, 1 ) ), f.x ), f.y ),
      f.z );
  }
`

// Falling water: pale and glassy, with bright streaks running down it. The
// streak pattern is noise on a circle around the fall, so it has no seam
// where the lathe closes. Seen edge-on a sheet is thicker, so the edges
// are more opaque than the face.
const fallMaterial = new ShaderMaterial({
  uniforms: { uTime: ambientTime, uTint: { value: tint }, uLight: light },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    varying vec3 vWorld;
    varying vec3 vNormal;
    void main() {
      vUv = uv;
      vec4 world = modelMatrix * vec4( position, 1.0 );
      vWorld = world.xyz;
      vNormal = normalize( mat3( modelMatrix ) * normal );
      gl_Position = projectionMatrix * viewMatrix * world;
    }`,
  fragmentShader: /* glsl */ `
    uniform float uTime;
    uniform vec3 uTint;
    uniform float uLight;
    varying vec2 vUv;
    varying vec3 vWorld;
    varying vec3 vNormal;
    ${NOISE_GLSL}
    void main() {
      float angle = vUv.x * 6.2831853;
      float flow = vUv.y * ${f(FOUNTAIN.flowLength)} - uTime * ${f(FOUNTAIN.flowSpeed)} * ${f(FOUNTAIN.flowLength)} * 0.35;
      vec3 p = vec3( cos( angle ) * ${f(FOUNTAIN.streaks)}, sin( angle ) * ${f(FOUNTAIN.streaks)}, flow );
      float streak = smoothstep( 0.5, 0.9, noise( p ) * 0.65 + noise( p * 2.3 ) * 0.35 );
      vec3 toEye = normalize( cameraPosition - vWorld );
      float edgeOn = 1.0 - abs( dot( normalize( vNormal ), toEye ) );
      vec3 water = mix( uTint * 1.6, vec3( 0.93, 0.97, 1.0 ), 0.45 );
      vec3 colour = mix( water, vec3( 1.0 ), streak * 0.65 );
      float alpha = ${f(FOUNTAIN.sheetOpacity)} + streak * 0.3 + edgeOn * 0.35;
      gl_FragColor = vec4( colour * uLight, clamp( alpha, 0.0, 0.92 ) );
      #include <colorspace_fragment>
    }`,
  transparent: true,
  depthWrite: false,
  side: DoubleSide,
})

// Bowl water shimmers with small moving ripples; foam is a churning white
// that never sits still.
const surfaceMaterial = new ShaderMaterial({
  uniforms: { uTime: ambientTime, uTint: { value: tint }, uLight: light },
  vertexShader: /* glsl */ `
    attribute float aFoam;
    varying float vFoam;
    varying vec3 vWorld;
    void main() {
      vFoam = aFoam;
      vec4 world = modelMatrix * vec4( position, 1.0 );
      vWorld = world.xyz;
      gl_Position = projectionMatrix * viewMatrix * world;
    }`,
  fragmentShader: /* glsl */ `
    uniform float uTime;
    uniform vec3 uTint;
    uniform float uLight;
    varying float vFoam;
    varying vec3 vWorld;
    ${NOISE_GLSL}
    void main() {
      vec3 p = vec3( vWorld.xz * 9.0, uTime * 1.6 );
      float n = noise( p ) * 0.6 + noise( p * 2.1 + 3.7 ) * 0.4;
      if ( vFoam > 0.5 ) {
        float foam = smoothstep( 0.35, 0.75, n );
        float alpha = foam * ${f(FOUNTAIN.foamOpacity)};
        if ( alpha < 0.02 ) discard;
        gl_FragColor = vec4( vec3( 0.96, 0.98, 1.0 ) * uLight, alpha );
      } else {
        vec3 water = uTint * ( 0.85 + n * 0.35 ) + smoothstep( 0.7, 0.9, n ) * 0.12;
        gl_FragColor = vec4( water * uLight, 0.9 );
      }
      #include <colorspace_fragment>
    }`,
  transparent: true,
  depthWrite: false,
})

function reflected(object: { layers: { enable: (layer: number) => void } } | null) {
  object?.layers.enable(AMBIENT.reflectLayer)
}

export function Fountain() {
  const stone = useMemo(() => buildStone(), [])
  const falls = useMemo(() => buildFalls(), [])
  const surfaces = useMemo(() => buildSurfaces(), [])

  useFrame(() => {
    light.value = 1 - (1 - FOUNTAIN.duskLight) * duskLevel()
  })

  return (
    <group>
      <mesh ref={reflected} geometry={stone} material={stoneMaterial} castShadow receiveShadow raycast={() => null} />
      {/* Surfaces first, then the falls over them. */}
      {/* Flat bowl water is invisible in a mirror below it, so it is not reflected. */}
      <mesh geometry={surfaces} material={surfaceMaterial} renderOrder={1} raycast={() => null} />
      <mesh ref={reflected} geometry={falls} material={fallMaterial} renderOrder={2} raycast={() => null} />
    </group>
  )
}
