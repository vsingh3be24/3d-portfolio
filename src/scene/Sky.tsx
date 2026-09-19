import { useMemo } from 'react'
import { BackSide, Color, ShaderMaterial, SphereGeometry, type Mesh } from 'three'
import { themes } from '@/theme'
import { ambientTime } from './ambient'
import { AMBIENT, SKY } from './constants'

// Linear-light colours the dome blends between, set by Lighting as dusk falls.
export const skyColours = {
  zenith: { value: new Color(themes.day.skyZenith) },
  horizon: { value: new Color(themes.day.skyHorizon) },
  nadir: { value: new Color(themes.day.groundFar) },
  cloud: { value: new Color(themes.day.skyCloud) },
  cloudShade: { value: new Color(themes.day.skyCloudShade) },
  cloudOpacity: { value: SKY.cloudOpacity as number },
}

const f = (value: number) => value.toFixed(4)

// Colour comes from the direction each pixel is seen in, not its place on the
// screen, so the horizon stays level while the camera orbits and the pond's
// mirror camera, looking up, sees the sky overhead.
//
// Clouds are painted in rather than modelled: layered noise on the view
// direction, kept to a band round the horizon. At the sky's distance they can
// never pass in front of the estate, and noise on a direction has no seam to
// find however far the camera turns.
const material = new ShaderMaterial({
  uniforms: {
    uZenith: skyColours.zenith,
    uHorizon: skyColours.horizon,
    uNadir: skyColours.nadir,
    uCloud: skyColours.cloud,
    uCloudShade: skyColours.cloudShade,
    uCloudOpacity: skyColours.cloudOpacity,
    uTime: ambientTime,
  },
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
    uniform vec3 uCloud;
    uniform vec3 uCloudShade;
    uniform float uCloudOpacity;
    uniform float uTime;
    varying vec3 vWorld;

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

    float fbm( vec3 p ) {
      float value = 0.0;
      float amplitude = 0.5;
      for ( int octave = 0; octave < 4; octave++ ) {
        value += amplitude * noise( p );
        p = p * 2.03 + vec3( 1.7, 9.2, 3.1 );
        amplitude *= 0.5;
      }
      return value;
    }

    void main() {
      vec3 dir = normalize( vWorld - cameraPosition );
      float h = dir.y;
      vec3 sky = h > 0.0
        ? mix( uHorizon, uZenith, pow( h, ${f(SKY.upCurve)} ) )
        : mix( uHorizon, uNadir, pow( -h, ${f(SKY.downCurve)} ) );

      // The cloud layer turns slowly round the estate.
      float turn = uTime * ${f(SKY.cloudDrift)};
      float c = cos( turn );
      float s = sin( turn );
      vec3 spun = vec3( c * dir.x - s * dir.z, dir.y, s * dir.x + c * dir.z );
      vec3 p = spun * vec3( ${f(SKY.cloudStretch[0])}, ${f(SKY.cloudStretch[1])}, ${f(SKY.cloudStretch[0])} );

      float band = smoothstep( ${f(SKY.cloudBand[0])}, ${f(SKY.cloudBand[1])}, h )
        * ( 1.0 - smoothstep( ${f(SKY.cloudBand[1])}, ${f(SKY.cloudBand[2])}, h ) );
      float shape = fbm( p );
      float cover = smoothstep( ${f(SKY.cloudCover)}, ${f(SKY.cloudCover + SKY.cloudSoftness)}, shape ) * band;
      // Thicker cloud is brighter at its core; thin edges take the shade.
      float body = smoothstep( ${f(SKY.cloudCover)}, ${f(SKY.cloudCover + SKY.cloudSoftness * 2.5)}, shape );
      vec3 cloud = mix( uCloudShade, uCloud, body );

      gl_FragColor = vec4( mix( sky, cloud, cover * uCloudOpacity ), 1.0 );
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
