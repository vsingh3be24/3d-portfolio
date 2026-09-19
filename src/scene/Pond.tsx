import { useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import { CircleGeometry, Color, Vector2, type Camera, type ShaderMaterial, type WebGLRenderer, type Scene } from 'three'
import { Reflector } from 'three/examples/jsm/objects/Reflector.js'
import { ambientTime } from './ambient'
import { AMBIENT, PARK, WATER } from './constants'
import { isLowTier } from './deviceTier'
import { duskLevel, trackColour } from './dusk'

const f = (value: number) => value.toFixed(4)

// A planar mirror, broken up by ripples. The reflection is sampled through
// the mirror's projection, shifted by a few overlapping sine waves; how much
// of it shows depends on the viewing angle, as it does on real water. What
// isn't reflection is the water's own colour, darker towards the rim.
const waterShader = {
  name: 'PondWater',
  uniforms: {
    color: { value: null },
    tDiffuse: { value: null },
    textureMatrix: { value: null },
    uTint: { value: new Color() },
    uLight: { value: 1 },
    uTime: { value: 0 },
    uCentre: { value: new Vector2(PARK.pondCentre[0], PARK.pondCentre[1]) },
  },
  vertexShader: /* glsl */ `
    uniform mat4 textureMatrix;
    varying vec4 vUv;
    varying vec3 vWorld;
    #include <common>
    #include <logdepthbuf_pars_vertex>
    void main() {
      vUv = textureMatrix * vec4( position, 1.0 );
      vec4 world = modelMatrix * vec4( position, 1.0 );
      vWorld = world.xyz;
      gl_Position = projectionMatrix * viewMatrix * world;
      #include <logdepthbuf_vertex>
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec3 uTint;
    uniform float uLight;
    uniform float uTime;
    uniform vec2 uCentre;
    varying vec4 vUv;
    varying vec3 vWorld;
    #include <logdepthbuf_pars_fragment>
    void main() {
      #include <logdepthbuf_fragment>
      vec2 p = vWorld.xz * ${f(WATER.rippleScale)};
      float t = uTime * ${f(WATER.rippleSpeed)};
      vec2 ripple = vec2(
        sin( p.x * 1.3 + t ) + 0.6 * sin( p.y * 1.7 - t * 1.2 ) + 0.35 * sin( ( p.x + p.y ) * 2.1 + t * 1.6 ),
        cos( p.y * 1.1 - t * 0.9 ) + 0.6 * cos( p.x * 1.9 + t * 1.3 ) + 0.35 * cos( ( p.x - p.y ) * 2.3 - t * 1.4 )
      );
      vec4 uv = vUv;
      uv.xy += ripple * ${f(WATER.rippleStrength)} * uv.w;
      vec3 reflection = texture2DProj( tDiffuse, uv ).rgb;
      reflection *= mix( vec3( 1.0 ), uTint / max( max( max( uTint.r, uTint.g ), uTint.b ), 0.001 ), ${f(WATER.reflectionTint)} );

      vec3 toEye = normalize( cameraPosition - vWorld );
      float fresnel = pow( 1.0 - clamp( toEye.y, 0.0, 1.0 ), ${f(WATER.fresnelPower)} );
      float mirror = mix( ${f(WATER.reflectNear)}, ${f(WATER.reflectFar)}, fresnel );

      float rim = length( vWorld.xz - uCentre ) / ${f(PARK.pondRadius)};
      vec3 water = uTint * uLight * ${f(WATER.depth)} * ( 1.0 - ${f(WATER.edgeDarkening)} * smoothstep( 0.65, 1.0, rim ) );
      float crest = smoothstep( 1.3, 1.9, ripple.x + ripple.y ) * ${f(WATER.glint)};

      gl_FragColor = vec4( mix( water, reflection, mirror ) + crest * reflection, 1.0 );
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
}

export function Pond() {
  const gl = useThree((state) => state.gl)

  const pond = useMemo(() => {
    const size = isLowTier(gl) ? WATER.textureSizeLowTier : WATER.textureSize
    const mirror = new Reflector(new CircleGeometry(PARK.pondRadius, WATER.segments), {
      textureWidth: size,
      textureHeight: size,
      clipBias: WATER.clipBias,
      multisample: 0,
      shader: waterShader,
    })
    mirror.rotation.x = -Math.PI / 2
    mirror.position.set(PARK.pondCentre[0], PARK.pondY, PARK.pondCentre[1])

    // The mirror clones its uniforms, so the shared clock and the tracked
    // colour are attached to its own copies.
    const uniforms = (mirror.material as ShaderMaterial).uniforms
    uniforms.uTime = ambientTime
    trackColour(uniforms.uTint.value as Color, 'water')

    // The mirror camera draws only what is marked to be reflected: trees,
    // lamps, cars and the park's own dressing. The sky comes for free as the
    // background. Buildings are left out: from any height the camera uses
    // they sit beyond what the pond can mirror, and they are most of the cost.
    const render = mirror.onBeforeRender
    mirror.onBeforeRender = (renderer: WebGLRenderer, scene: Scene, camera: Camera, ...rest) => {
      uniforms.uLight.value = 1 - (1 - WATER.duskLight) * duskLevel()
      mirror.getReflectionCamera(camera).layers.set(AMBIENT.reflectLayer)
      render.call(mirror, renderer, scene, camera, ...rest)
    }
    return mirror
  }, [gl])

  useEffect(() => () => pond.dispose(), [pond])

  return <primitive object={pond} />
}
