import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  MeshLambertMaterial,
  ShaderMaterial,
  Vector3,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { palette } from '@/theme'
import { ambientTime, pointScale, POINT_SIZE_GLSL } from './ambient'
import { AMBIENT, FOUNTAIN, PARK, WATER } from './constants'
import { duskLevel, trackColour } from './dusk'

const f = (value: number) => value.toFixed(4)

// Pedestal, bowl and spout, stacked in the middle of the pond.
function buildStone(): BufferGeometry {
  const [cx, cz] = PARK.pondCentre
  const base = PARK.pondY
  const pedestal = new CylinderGeometry(FOUNTAIN.pedestalRadius * 0.8, FOUNTAIN.pedestalRadius, FOUNTAIN.pedestalHeight, 12)
  pedestal.translate(cx, base + FOUNTAIN.pedestalHeight / 2, cz)
  const bowlY = base + FOUNTAIN.pedestalHeight + FOUNTAIN.bowlHeight / 2
  const bowl = new CylinderGeometry(FOUNTAIN.bowlRadius, FOUNTAIN.bowlRadius * 0.7, FOUNTAIN.bowlHeight, 16)
  bowl.translate(cx, bowlY, cz)
  const spout = new CylinderGeometry(FOUNTAIN.spoutRadius * 0.7, FOUNTAIN.spoutRadius, FOUNTAIN.spoutHeight, 8)
  spout.translate(cx, bowlY + FOUNTAIN.bowlHeight / 2 + FOUNTAIN.spoutHeight / 2, cz)
  const stone = mergeGeometries([pedestal, bowl, spout], false)
  ;[pedestal, bowl, spout].forEach((part) => part.dispose())
  return stone
}

// Where the water leaves the spout.
const ORIGIN = new Vector3(
  PARK.pondCentre[0],
  PARK.pondY + FOUNTAIN.pedestalHeight + FOUNTAIN.bowlHeight + FOUNTAIN.spoutHeight,
  PARK.pondCentre[1],
)

const stoneMaterial = new MeshLambertMaterial({ color: palette.kerb })
trackColour(stoneMaterial.color, 'kerb')

// Each droplet is a point on a ballistic arc: launched from the spout on its
// own heading, pulled down by gravity, gone once it is back under the water.
// All of it is worked out in the shader from the clock, so the CPU does
// nothing per frame. Seeds spread the droplets through the cycle.
function buildSpray(): BufferGeometry {
  const count = FOUNTAIN.droplets
  const seed = new Float32Array(count)
  const heading = new Float32Array(count)
  const lean = new Float32Array(count)
  const speed = new Float32Array(count)
  for (let index = 0; index < count; index += 1) {
    const k = index / count
    seed[index] = (k * 7.31) % 1
    heading[index] = k * Math.PI * 2 * 13.7
    lean[index] = 0.35 + 0.65 * ((k * 3.17) % 1)
    speed[index] = 0.85 + 0.25 * ((k * 5.71) % 1)
  }
  const spray = new BufferGeometry()
  // Positions are unused, but three needs one attribute sized to the count.
  spray.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3))
  spray.setAttribute('aSeed', new BufferAttribute(seed, 1))
  spray.setAttribute('aHeading', new BufferAttribute(heading, 1))
  spray.setAttribute('aLean', new BufferAttribute(lean, 1))
  spray.setAttribute('aSpeed', new BufferAttribute(speed, 1))
  return spray
}

const sprayLight = { value: 1 }

const sprayMaterial = new ShaderMaterial({
  uniforms: {
    uTime: ambientTime,
    pointScale,
    uLight: sprayLight,
    uOrigin: { value: ORIGIN },
    uColour: { value: new Color(FOUNTAIN.dropletColour) },
  },
  vertexShader: /* glsl */ `
    uniform float uTime;
    uniform float pointScale;
    uniform vec3 uOrigin;
    attribute float aSeed;
    attribute float aHeading;
    attribute float aLean;
    attribute float aSpeed;
    varying float vAlpha;
    ${POINT_SIZE_GLSL}
    void main() {
      float t = fract( uTime / ${f(FOUNTAIN.lifetime)} + aSeed ) * ${f(FOUNTAIN.lifetime)};
      float tilt = aLean * ${f(FOUNTAIN.spread)};
      vec3 dir = vec3( sin( tilt ) * cos( aHeading ), cos( tilt ), sin( tilt ) * sin( aHeading ) );
      vec3 p = uOrigin + dir * ${f(FOUNTAIN.launchSpeed)} * aSpeed * t;
      p.y -= 0.5 * ${f(FOUNTAIN.gravity)} * t * t;
      // Back under the surface: gone until it launches again.
      float above = step( ${f(PARK.pondY)}, p.y );
      vAlpha = above;
      vec4 mv = viewMatrix * vec4( p, 1.0 );
      gl_Position = projectionMatrix * mv;
      gl_PointSize = max( worldPointSize( ${f(FOUNTAIN.dropletSize)}, mv ), 1.0 ) * above;
    }`,
  fragmentShader: /* glsl */ `
    uniform vec3 uColour;
    uniform float uLight;
    varying float vAlpha;
    void main() {
      float edge = length( gl_PointCoord - 0.5 );
      float alpha = smoothstep( 0.5, 0.2, edge ) * vAlpha * ${f(FOUNTAIN.dropletOpacity)};
      if ( alpha < 0.01 ) discard;
      gl_FragColor = vec4( uColour * uLight, alpha );
      #include <colorspace_fragment>
    }`,
  transparent: true,
  depthWrite: false,
})

export function Fountain() {
  const stone = useMemo(() => buildStone(), [])
  const spray = useMemo(() => buildSpray(), [])

  // Unlit, so it dims with dusk by hand, the same way the water does.
  useFrame(() => {
    sprayLight.value = 1 - (1 - WATER.duskLight) * duskLevel()
  })

  return (
    <group>
      <mesh
        ref={(mesh) => mesh?.layers.enable(AMBIENT.reflectLayer)}
        geometry={stone}
        material={stoneMaterial}
        castShadow
        receiveShadow
        raycast={() => null}
      />
      <points
        ref={(points) => points?.layers.enable(AMBIENT.reflectLayer)}
        geometry={spray}
        material={sprayMaterial}
        frustumCulled={false}
        raycast={() => null}
      />
    </group>
  )
}
