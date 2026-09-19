import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  FramebufferTexture,
  HalfFloatType,
  LinearFilter,
  Mesh,
  OrthographicCamera,
  ShaderMaterial,
  UnsignedByteType,
  Vector2,
  WebGLRenderTarget,
  AdditiveBlending,
  NoBlending,
  type WebGLRenderer,
} from 'three'
import { themes } from '@/theme'
import { ambientTime } from './ambient'
import { DUSK, POSTFX } from './constants'
import { duskLevel, lightStage } from './dusk'
import { postPasses } from './postPasses'

const f = (value: number) => value.toFixed(4)


// One triangle that covers the screen, drawn straight to clip space.
function fullscreenTriangle(): BufferGeometry {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute([-1, 3, 0, -1, -1, 0, 3, -1, 0], 3))
  geometry.setAttribute('uv', new Float32BufferAttribute([0, 2, 0, 0, 2, 0], 2))
  return geometry
}

const VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4( position.xy, 0.0, 1.0 );
  }`

// Halves the picture, each output pixel an average of a small cross of the
// input's (the dual-filter blur). The first level also keeps only what is
// brighter than the threshold, easing in over the knee.
const downMaterial = new ShaderMaterial({
  uniforms: {
    tInput: { value: null },
    uTexel: { value: new Vector2() },
    uPrefilter: { value: 0 },
  },
  vertexShader: VERTEX,
  fragmentShader: /* glsl */ `
    uniform sampler2D tInput;
    uniform vec2 uTexel;
    uniform float uPrefilter;
    varying vec2 vUv;
    vec3 bright( vec3 c ) {
      float peak = max( c.r, max( c.g, c.b ) );
      float soft = clamp( peak - ${f(POSTFX.threshold)} + ${f(POSTFX.knee)}, 0.0, ${f(2 * POSTFX.knee)} );
      soft = soft * soft / ${f(4 * POSTFX.knee)};
      return c * max( soft, peak - ${f(POSTFX.threshold)} ) / max( peak, 1e-4 );
    }
    vec3 take( vec2 uv ) {
      vec3 c = texture2D( tInput, uv ).rgb;
      return uPrefilter > 0.5 ? bright( c ) : c;
    }
    void main() {
      vec2 o = uTexel * ${f(POSTFX.radius)};
      vec3 sum = take( vUv ) * 4.0;
      sum += take( vUv - o );
      sum += take( vUv + o );
      sum += take( vUv + vec2( o.x, -o.y ) );
      sum += take( vUv - vec2( o.x, -o.y ) );
      gl_FragColor = vec4( sum / 8.0, 1.0 );
    }`,
  depthTest: false,
  depthWrite: false,
  blending: NoBlending,
  toneMapped: false,
})

// Doubles it back up with a tent filter, added over the level above, so each
// level ends up holding its own blur plus every wider one beneath it.
const upMaterial = new ShaderMaterial({
  uniforms: {
    tInput: { value: null },
    uTexel: { value: new Vector2() },
  },
  vertexShader: VERTEX,
  fragmentShader: /* glsl */ `
    uniform sampler2D tInput;
    uniform vec2 uTexel;
    varying vec2 vUv;
    void main() {
      vec2 o = uTexel * ${f(POSTFX.radius)};
      vec3 sum = texture2D( tInput, vUv + vec2( -2.0 * o.x, 0.0 ) ).rgb;
      sum += texture2D( tInput, vUv + vec2( -o.x, o.y ) ).rgb * 2.0;
      sum += texture2D( tInput, vUv + vec2( 0.0, 2.0 * o.y ) ).rgb;
      sum += texture2D( tInput, vUv + vec2( o.x, o.y ) ).rgb * 2.0;
      sum += texture2D( tInput, vUv + vec2( 2.0 * o.x, 0.0 ) ).rgb;
      sum += texture2D( tInput, vUv + vec2( o.x, -o.y ) ).rgb * 2.0;
      sum += texture2D( tInput, vUv + vec2( 0.0, -2.0 * o.y ) ).rgb;
      sum += texture2D( tInput, vUv + vec2( -o.x, -o.y ) ).rgb * 2.0;
      gl_FragColor = vec4( sum / 12.0, 1.0 );
    }`,
  depthTest: false,
  depthWrite: false,
  blending: AdditiveBlending,
  toneMapped: false,
})

// Everything together, onto the screen. The copy of the frame is already
// tone mapped and encoded for display, so the grade works on what is seen.
// Its alpha says where the estate is: the sky writes none, so it keeps its
// exact colours while the estate is graded.
const compositeMaterial = new ShaderMaterial({
  uniforms: {
    tScene: { value: null },
    tBloom: { value: null },
    uBloom: { value: 0 },
    uDusk: { value: 0 },
    uAspect: { value: 1 },
    uTime: ambientTime,
    // The pass works in display values, so its colours are given as seen.
    uWarm: { value: new Color(themes.dusk.windowLit).convertLinearToSRGB() },
    uShadowTint: { value: new Color(POSTFX.shadowTint).convertLinearToSRGB() },
  },
  vertexShader: VERTEX,
  fragmentShader: /* glsl */ `
    uniform sampler2D tScene;
    uniform sampler2D tBloom;
    uniform float uBloom;
    uniform float uDusk;
    uniform float uAspect;
    uniform float uTime;
    uniform vec3 uWarm;
    uniform vec3 uShadowTint;
    varying vec2 vUv;

    float hash( vec2 p ) {
      vec3 p3 = fract( vec3( p.xyx ) * 0.1031 );
      p3 += dot( p3, p3.yzx + 33.33 );
      return fract( ( p3.x + p3.y ) * p3.z );
    }

    void main() {
      vec4 scene = texture2D( tScene, vUv );
      vec3 colour = scene.rgb;

      // The grade: contrast about a pivot that suits the time of day, then
      // saturation about the pixel's own brightness, then a cool lift into
      // the shadows at dusk so the warm lights have something to sit against.
      float contrast = mix( ${f(POSTFX.contrastDay)}, ${f(POSTFX.contrastDusk)}, uDusk );
      float pivot = mix( 0.5, 0.26, uDusk );
      float saturation = mix( ${f(POSTFX.saturationDay)}, ${f(POSTFX.saturationDusk)}, uDusk );
      vec3 graded = ( colour - pivot ) * contrast + pivot;
      float luma = dot( graded, vec3( 0.2126, 0.7152, 0.0722 ) );
      graded = mix( vec3( luma ), graded, saturation );
      graded += uShadowTint * ${f(POSTFX.shadowTintAmount)} * uDusk * ( 1.0 - smoothstep( 0.0, 0.45, luma ) );
      colour = mix( colour, clamp( graded, 0.0, 1.0 ), clamp( scene.a, 0.0, 1.0 ) );

      // The glow, pushed a little towards lamplight.
      vec3 glow = texture2D( tBloom, vUv ).rgb;
      glow = mix( glow, uWarm * dot( glow, vec3( 0.3333 ) ), ${f(POSTFX.warmth)} );
      colour += glow * uBloom;

      // Corners fall away, measured on a circle rather than the canvas's shape.
      vec2 centred = ( vUv - 0.5 ) * vec2( uAspect, 1.0 ) / max( uAspect, 1.0 );
      float edge = smoothstep( ${f(POSTFX.vignetteStart)}, 0.85, length( centred ) * 1.4142 );
      colour *= 1.0 - edge * mix( ${f(POSTFX.vignetteDay)}, ${f(POSTFX.vignetteDusk)}, uDusk );

      // Grain, fresh every frame while motion runs and still when it stops.
      colour += ( hash( gl_FragCoord.xy + fract( uTime * 7.31 ) * 311.0 ) - 0.5 ) * ${f(POSTFX.grain)};

      gl_FragColor = vec4( colour, 1.0 );
    }`,
  depthTest: false,
  depthWrite: false,
  blending: NoBlending,
  toneMapped: false,
})

// Half floats keep the glow's long soft tails from banding over the dark sky;
// where a device can't draw into them, bytes still work.
function glowType(gl: WebGLRenderer) {
  return gl.extensions.has('EXT_color_buffer_float') || gl.extensions.has('EXT_color_buffer_half_float')
    ? HalfFloatType
    : UnsignedByteType
}

type Targets = { width: number; height: number; copy: FramebufferTexture; levels: WebGLRenderTarget[] }

function buildTargets(gl: WebGLRenderer, width: number, height: number): Targets {
  const copy = new FramebufferTexture(width, height)
  copy.minFilter = LinearFilter
  copy.magFilter = LinearFilter
  const type = glowType(gl)
  const levels = Array.from({ length: POSTFX.levels }, (_, index) => {
    const scale = Math.pow(2, index + 1)
    const target = new WebGLRenderTarget(Math.max(1, Math.floor(width / scale)), Math.max(1, Math.floor(height / scale)), {
      type,
      depthBuffer: false,
      stencilBuffer: false,
      minFilter: LinearFilter,
      magFilter: LinearFilter,
    })
    return target
  })
  return { width, height, copy, levels }
}

function disposeTargets(targets: Targets) {
  targets.copy.dispose()
  targets.levels.forEach((level) => level.dispose())
}

const size = new Vector2()

// Takes over drawing the frame: the scene to the screen as ever, then a copy
// of it through the glow, the grade, the vignette and the grain, and back.
// Working on the finished frame rather than rendering the scene into a
// buffer of its own leaves its tone mapping, and the sky's exemption from
// it, exactly as they were.
export function PostFX() {
  const gl = useThree((state) => state.gl)
  const quad = useMemo(() => {
    const mesh = new Mesh(fullscreenTriangle(), compositeMaterial)
    mesh.frustumCulled = false
    return mesh
  }, [])
  const camera = useMemo(() => new OrthographicCamera(-1, 1, 1, -1, 0, 1), [])
  const targets = useMemo<{ current: Targets | null }>(() => ({ current: null }), [])

  // The whole frame's draw calls, shadow and mirror passes included, rather
  // than whichever render happened to run last.
  useEffect(() => {
    gl.info.autoReset = false
    return () => {
      gl.info.autoReset = true
      if (targets.current) disposeTargets(targets.current)
      targets.current = null
      quad.geometry.dispose()
    }
  }, [gl, quad, targets])

  useFrame((state) => {
    const { scene, camera: view } = state
    gl.info.reset()
    gl.setRenderTarget(null)
    gl.render(scene, view)

    gl.getDrawingBufferSize(size)
    const width = Math.floor(size.x)
    const height = Math.floor(size.y)
    if (width < 2 || height < 2) return
    let built = targets.current
    if (!built || built.width !== width || built.height !== height) {
      if (built) disposeTargets(built)
      built = buildTargets(gl, width, height)
      targets.current = built
    }

    const callsBefore = gl.info.render.calls
    gl.setRenderTarget(null)
    gl.copyFramebufferToTexture(built.copy)

    const night = duskLevel()
    const glow = POSTFX.strength * lightStage(DUSK.cascadeStart, DUSK.lampEnd) * night
    const { levels } = built

    if (glow > 0.001) {
      // Down: threshold into half size, then halve and blur level by level.
      quad.material = downMaterial
      for (let index = 0; index < levels.length; index += 1) {
        const source = index === 0 ? built.copy : levels[index - 1].texture
        const sourceWidth = index === 0 ? width : levels[index - 1].width
        const sourceHeight = index === 0 ? height : levels[index - 1].height
        downMaterial.uniforms.tInput.value = source
        downMaterial.uniforms.uTexel.value.set(1 / sourceWidth, 1 / sourceHeight)
        downMaterial.uniforms.uPrefilter.value = index === 0 ? 1 : 0
        gl.setRenderTarget(levels[index])
        gl.render(quad, camera)
      }
      // Up: each level's blur added into the one above, keeping what's there.
      quad.material = upMaterial
      const autoClear = gl.autoClear
      gl.autoClear = false
      for (let index = levels.length - 1; index > 0; index -= 1) {
        upMaterial.uniforms.tInput.value = levels[index].texture
        upMaterial.uniforms.uTexel.value.set(1 / levels[index].width, 1 / levels[index].height)
        gl.setRenderTarget(levels[index - 1])
        gl.render(quad, camera)
      }
      gl.autoClear = autoClear
    }

    quad.material = compositeMaterial
    const uniforms = compositeMaterial.uniforms
    uniforms.tScene.value = built.copy
    uniforms.tBloom.value = levels[0].texture
    // Every level has been summed into the first, so it carries their total.
    uniforms.uBloom.value = glow / levels.length
    uniforms.uDusk.value = night
    uniforms.uAspect.value = width / height
    gl.setRenderTarget(null)
    gl.render(quad, camera)
    postPasses.value = gl.info.render.calls - callsBefore
  }, 1)

  return null
}
