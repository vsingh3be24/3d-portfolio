import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Color, type DirectionalLight, type HemisphereLight } from 'three'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { useEstate } from '@/store/useEstate'
import { themes } from '@/theme'
import { AMBIENT, DUSK, LIGHTING } from './constants'
import { applyColours, dusk, stage } from './dusk'
import { skyColours } from './Sky'
import { requestShadowUpdate, takeShadowRequest } from './shadows'

// The sun moves on a sphere round the estate: same bearing, same distance, only
// its height changes. Keeping the distance is what keeps the shadow frustum's
// near and far planes valid at dusk.
const [sunX, sunY, sunZ] = LIGHTING.directionalPosition
const SUN_RADIUS = Math.hypot(sunX, sunY, sunZ)
const SUN_BEARING = Math.atan2(sunX, sunZ)
const SUN_ELEVATION_DAY = Math.asin(sunY / SUN_RADIUS)

const SKY_DAY = new Color(themes.day.groundFar)
const SKY_DUSK = new Color(themes.dusk.groundFar)
const ZENITH_DAY = new Color(themes.day.skyZenith)
const ZENITH_DUSK = new Color(themes.dusk.skyZenith)
const HORIZON_DAY = new Color(themes.day.skyHorizon)
const HORIZON_DUSK = new Color(themes.dusk.skyHorizon)
const SUN_DAY = new Color(LIGHTING.directionalColor)
const SUN_DUSK = new Color(DUSK.sunColourDusk)
const HEMI_SKY_DAY = new Color(LIGHTING.hemiSky)
const HEMI_SKY_DUSK = new Color(DUSK.hemiSkyDusk)
const HEMI_GROUND_DAY = new Color(LIGHTING.hemiGround)
const HEMI_GROUND_DUSK = new Color(DUSK.hemiGroundDusk)

const lerp = (from: number, to: number, k: number) => from + (to - from) * k

export function Lighting() {
  const sunRef = useRef<DirectionalLight>(null!)
  const hemiRef = useRef<HemisphereLight>(null!)
  const scene = useThree((state) => state.scene)
  const gl = useThree((state) => state.gl)
  const camera = useThree((state) => state.camera)
  const theme = useEstate((state) => state.theme)
  const prefersReducedMotion = usePrefersReducedMotion()
  const sky = useMemo(() => SKY_DAY.clone(), [])
  const firstRun = useRef(true)
  // The time last written to the scene, so a settled sequence costs nothing.
  const applied = useRef<number | null>(null)

  useLayoutEffect(() => {
    const shadow = sunRef.current.shadow.camera
    const e = LIGHTING.shadowExtent
    shadow.left = -e
    shadow.right = e
    shadow.top = e
    shadow.bottom = -e
    shadow.near = LIGHTING.shadowNear
    shadow.far = LIGHTING.shadowFar
    // three does not rebuild the shadow projection when these change.
    shadow.updateProjectionMatrix()
  }, [])

  // The shadow map is redrawn only on request. The check runs in the scene's
  // pre-render hook, which three calls before the shadow pass, so a request
  // made anywhere in a frame is honoured in that same frame.
  useLayoutEffect(() => {
    gl.shadowMap.autoUpdate = false
    requestShadowUpdate()
    scene.onBeforeRender = () => {
      if (takeShadowRequest()) gl.shadowMap.needsUpdate = true
    }
    return () => {
      scene.onBeforeRender = () => {}
      gl.shadowMap.autoUpdate = true
    }
  }, [gl, scene])

  // three filters lights by layer as well as meshes: without this the
  // pond's mirror camera would see its reflection completely unlit.
  useLayoutEffect(() => {
    sunRef.current.layers.enable(AMBIENT.reflectLayer)
    hemiRef.current.layers.enable(AMBIENT.reflectLayer)
  }, [])

  useLayoutEffect(() => {
    scene.background = sky
    return () => {
      scene.background = null
    }
  }, [scene, sky])

  // A toggle from rest records where the camera stands, which the window
  // cascade orders itself by. A toggle that reverses one still running keeps
  // the order it had, so the same windows go out in the reverse order they
  // came on. Arriving already at dusk, or asking for no motion, jumps.
  useEffect(() => {
    const atRest = dusk.time === 0 || dusk.time === DUSK.duration
    if (atRest || firstRun.current) {
      dusk.origin.copy(camera.position)
      dusk.epoch += 1
    }
    if (firstRun.current || prefersReducedMotion) dusk.time = theme === 'dusk' ? DUSK.duration : 0
    firstRun.current = false
  }, [theme, prefersReducedMotion, camera])

  useFrame((_, delta) => {
    const goal = theme === 'dusk' ? DUSK.duration : 0
    // Real elapsed time, unclamped: the sequence has a fixed length, so slow
    // or dropped frames skip ahead rather than stretching it out.
    if (dusk.time !== goal) {
      dusk.time = goal > dusk.time ? Math.min(dusk.time + delta, goal) : Math.max(dusk.time - delta, goal)
    }
    if (applied.current === dusk.time) return
    applied.current = dusk.time

    const colour = stage(0, DUSK.colourEnd)
    sky.lerpColors(SKY_DAY, SKY_DUSK, colour)
    skyColours.nadir.value.copy(sky)
    skyColours.zenith.value.lerpColors(ZENITH_DAY, ZENITH_DUSK, colour)
    skyColours.horizon.value.lerpColors(HORIZON_DAY, HORIZON_DUSK, colour)
    applyColours(colour * DUSK.surfaceFade)

    const light = stage(0, DUSK.lightEnd)
    // The sun is moving, so every shadow moves with it.
    requestShadowUpdate()
    const sun = sunRef.current
    const elevation = lerp(SUN_ELEVATION_DAY, DUSK.sunElevationDusk, light)
    sun.position.set(
      Math.cos(elevation) * Math.sin(SUN_BEARING) * SUN_RADIUS,
      Math.sin(elevation) * SUN_RADIUS,
      Math.cos(elevation) * Math.cos(SUN_BEARING) * SUN_RADIUS,
    )
    sun.color.lerpColors(SUN_DAY, SUN_DUSK, light)
    sun.intensity = lerp(LIGHTING.directionalIntensity, DUSK.sunIntensityDusk, light)

    const hemi = hemiRef.current
    hemi.color.lerpColors(HEMI_SKY_DAY, HEMI_SKY_DUSK, light)
    hemi.groundColor.lerpColors(HEMI_GROUND_DAY, HEMI_GROUND_DUSK, light)
    hemi.intensity = lerp(LIGHTING.hemiIntensity, DUSK.hemiIntensityDusk, light)
  })

  return (
    <>
      <hemisphereLight
        ref={hemiRef}
        args={[LIGHTING.hemiSky, LIGHTING.hemiGround, LIGHTING.hemiIntensity]}
      />
      <directionalLight
        ref={sunRef}
        castShadow
        position={LIGHTING.directionalPosition}
        color={LIGHTING.directionalColor}
        intensity={LIGHTING.directionalIntensity}
        shadow-mapSize-width={LIGHTING.shadowMapSize}
        shadow-mapSize-height={LIGHTING.shadowMapSize}
        shadow-bias={LIGHTING.shadowBias}
        shadow-normalBias={LIGHTING.shadowNormalBias}
        shadow-radius={LIGHTING.shadowRadius}
      />
    </>
  )
}
