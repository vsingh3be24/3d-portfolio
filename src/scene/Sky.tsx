import { useMemo } from 'react'
import { BackSide, Color, ShaderMaterial, SphereGeometry, type Mesh } from 'three'
import { themes } from '@/theme'
import { AMBIENT, SKY } from './constants'

// Linear-light colours the dome blends between, set by Lighting as dusk falls.
export const skyColours = {
  zenith: { value: new Color(themes.day.skyZenith) },
  horizon: { value: new Color(themes.day.skyHorizon) },
  nadir: { value: new Color(themes.day.groundFar) },
}

const f = (value: number) => value.toFixed(4)

// Colour comes from the direction each pixel is seen in, not its place on the
// screen, so the horizon stays level while the camera orbits and the pond's
// mirror camera, looking up, sees the sky overhead.
const material = new ShaderMaterial({
  uniforms: { uZenith: skyColours.zenith, uHorizon: skyColours.horizon, uNadir: skyColours.nadir },
  vertexShader: /* glsl */ `
    varying vec3 vWorld;
    void main() {
      vec4 world = modelMatrix * vec4( position, 1.0 );
      vWorld = world.xyz;
      gl_Position = projectionMatrix * viewMatrix * world;
    }`,
  fragmentShader: /* glsl */ `
    uniform vec3 uZenith;
    uniform vec3 uHorizon;
    uniform vec3 uNadir;
    varying vec3 vWorld;
    void main() {
      float h = normalize( vWorld - cameraPosition ).y;
      vec3 colour = h > 0.0
        ? mix( uHorizon, uZenith, pow( h, ${f(SKY.upCurve)} ) )
        : mix( uHorizon, uNadir, pow( -h, ${f(SKY.downCurve)} ) );
      gl_FragColor = vec4( colour, 1.0 );
      #include <colorspace_fragment>
    }`,
  side: BackSide,
  depthWrite: false,
  // The backdrop shows the palette exactly. Tone mapping, right for the lit
  // model, would pull these pale blues towards grey.
  toneMapped: false,
})

// Follows whichever camera is about to draw it — the view, or the pond's
// mirror — so it always surrounds that camera at the same distance. Centred
// on the estate instead, its far side would lie beyond the far plane.
function followCamera(mesh: Mesh | null) {
  if (!mesh) return
  mesh.layers.enable(AMBIENT.reflectLayer)
  mesh.onBeforeRender = (_renderer, _scene, camera) => {
    mesh.position.setFromMatrixPosition(camera.matrixWorld)
    mesh.updateMatrixWorld()
  }
}

export function Sky() {
  const geometry = useMemo(() => new SphereGeometry(SKY.radius, 32, 16), [])

  return (
    <mesh
      ref={followCamera}
      geometry={geometry}
      material={material}
      // Drawn before everything, behind everything.
      renderOrder={-1}
      frustumCulled={false}
      castShadow={false}
      receiveShadow={false}
      raycast={() => null}
    />
  )
}
