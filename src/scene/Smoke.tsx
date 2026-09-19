import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { BufferAttribute, BufferGeometry, Color, ShaderMaterial } from 'three'
import { useEstate } from '@/store/useEstate'
import { ambientTime, pointScale, POINT_SIZE_GLSL } from './ambient'
import { chimneyTops } from './Building'
import { SMOKE, WATER } from './constants'
import { duskLevel, trackColour } from './dusk'

const f = (value: number) => value.toFixed(4)

const tint = new Color()
trackColour(tint, 'cloud')
const light = { value: 1 }
// Which chimney's smoke is hidden: the one whose building has given way to
// its room. -1 hides none.
const hidden = { value: -1 }

// Each puff rises, swells and drifts downwind over its life, fading in fast
// and out slowly, then starts again from the chimney. Worked out from the
// clock in the shader; seeds spread the puffs through the cycle.
const material = new ShaderMaterial({
  uniforms: { uTime: ambientTime, pointScale, uTint: { value: tint }, uLight: light, uHidden: hidden },
  vertexShader: /* glsl */ `
    uniform float uTime;
    uniform float pointScale;
    uniform float uHidden;
    attribute float aSeed;
    attribute float aSource;
    varying float vAlpha;
    ${POINT_SIZE_GLSL}
    void main() {
      float t = fract( uTime / ${f(SMOKE.lifetime)} + aSeed );
      vec3 p = position;
      p.y += t * ${f(SMOKE.rise)};
      p.x += t * t * ${f(SMOKE.drift[0])} + sin( uTime * 0.9 + aSeed * 20.0 ) * 0.06 * t;
      p.z += t * t * ${f(SMOKE.drift[1])};
      float shown = 1.0 - step( abs( aSource - uHidden ), 0.5 );
      vAlpha = smoothstep( 0.0, 0.12, t ) * ( 1.0 - t ) * shown;
      vec4 mv = viewMatrix * vec4( p, 1.0 );
      gl_Position = projectionMatrix * mv;
      gl_PointSize = worldPointSize( mix( ${f(SMOKE.size[0])}, ${f(SMOKE.size[1])}, t ), mv ) * shown;
    }`,
  fragmentShader: /* glsl */ `
    uniform vec3 uTint;
    uniform float uLight;
    varying float vAlpha;
    void main() {
      float edge = length( gl_PointCoord - 0.5 ) * 2.0;
      float alpha = ( 1.0 - smoothstep( 0.35, 1.0, edge ) ) * vAlpha * ${f(SMOKE.opacity)};
      if ( alpha < 0.01 ) discard;
      gl_FragColor = vec4( uTint * uLight, alpha );
      #include <colorspace_fragment>
    }`,
  transparent: true,
  depthWrite: false,
})

export function Smoke() {
  const activePlotId = useEstate((state) => state.activePlotId)
  const { geometry, sources } = useMemo(() => {
    const tops = chimneyTops()
    const count = tops.length * SMOKE.puffsPerChimney
    const position = new Float32Array(count * 3)
    const seed = new Float32Array(count)
    const source = new Float32Array(count)
    tops.forEach((top, chimney) => {
      for (let puff = 0; puff < SMOKE.puffsPerChimney; puff += 1) {
        const index = chimney * SMOKE.puffsPerChimney + puff
        position.set([top.position.x, top.position.y, top.position.z], index * 3)
        seed[index] = puff / SMOKE.puffsPerChimney + chimney * 0.37
        source[index] = chimney
      }
    })
    const smoke = new BufferGeometry()
    smoke.setAttribute('position', new BufferAttribute(position, 3))
    smoke.setAttribute('aSeed', new BufferAttribute(seed, 1))
    smoke.setAttribute('aSource', new BufferAttribute(source, 1))
    return { geometry: smoke, sources: tops.map((top) => top.plotId) }
  }, [])

  useFrame(() => {
    // Unlit, so it dims with dusk by hand, as the water does.
    light.value = 1 - (1 - WATER.duskLight) * duskLevel()
    hidden.value = activePlotId ? sources.indexOf(activePlotId) : -1
  })

  if (sources.length === 0) return null

  return <points geometry={geometry} material={material} frustumCulled={false} raycast={() => null} />
}
