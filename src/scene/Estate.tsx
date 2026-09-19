import { Suspense, useEffect, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useProgress } from '@react-three/drei'
import { DefaultLoadingManager } from 'three'
import { HoverLabel } from '@/components/ui/HoverLabel'
import { FirstRunCard } from '@/components/ui/FirstRunCard'
import { LoadingScreen } from '@/components/ui/LoadingScreen'
import { PerfHud, type PerfSample } from './PerfHud'
import { site } from '@/data/site'
import { useCoarsePointer } from '@/hooks/useIsMobile'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { useRenderGate } from '@/hooks/useRenderGate'
import { useEstate } from '@/store/useEstate'
import { CameraRig } from './CameraRig'
import { CAMERA, PERF, UI } from './constants'
import { pixelRatioFor } from './deviceTier'
import { attachLoadingManager, finishStage } from './loading'
import { Buildings } from './Building'
import { Ground } from './Ground'
import { GroundLabels } from './GroundLabels'
import { Interiors, precompileRoomMaterials } from './Interior'
import { Lighting } from './Lighting'
import { Props } from './Props'
import { Road } from './Road'
import { Traffic } from './Traffic'
import { AmbientClock } from './ambient'
import { Pond } from './Pond'
import { Birds } from './Birds'
import { Sky } from './Sky'
import { Fountain } from './Fountain'
import { Walkers } from './Walkers'
import { Smoke } from './Smoke'
import { Fireflies } from './Fireflies'

// Holds the reveal back until a few frames have actually rendered, so shaders
// are compiled and the first frame the visitor sees is never a stutter.
function WarmUp({ onReady }: { onReady: () => void }) {
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)
  const camera = useThree((state) => state.camera)
  const frames = useRef(0)
  const fired = useRef(false)

  useFrame(() => {
    if (fired.current) return
    // Compiling up front means the frames the visitor actually sees are never
    // the ones paying for shader compilation.
    if (frames.current === 0) {
      gl.compile(scene, camera)
      precompileRoomMaterials(gl, camera, scene)
    }
    frames.current += 1
    if (frames.current >= UI.warmupFrames) {
      fired.current = true
      onReady()
    }
  })

  return null
}

// On touch, rotating waits for a deliberate tap, so that until then a swipe
// over the canvas is always a page scroll. With a mouse, dragging can never
// be mistaken for scrolling, and the controls hint under the tab bar says how.
function EngagementHint() {
  const markInteracted = useEstate((state) => state.markInteracted)
  const coarsePointer = useCoarsePointer()
  if (!coarsePointer) return null

  return (
    <button
      type="button"
      onClick={markInteracted}
      style={{ touchAction: 'pan-y' }}
      className="absolute inset-0 flex items-center justify-center"
    >
      <span className="rounded-full border border-ink/15 bg-paper/90 px-4 py-2 font-body text-step-0 text-ink/80">
        {site.tapToExplore}
      </span>
    </button>
  )
}

// The scene's code has arrived, so the stages can now be counted by the
// loading manager that useProgress reads.
attachLoadingManager(DefaultLoadingManager)

// Only ever true in dev, and only when asked for, so the HUD can never cost a
// visitor a frame.
const showPerf = import.meta.env.DEV && new URLSearchParams(window.location.search).has('perf')

export function Estate() {
  const [ready, setReady] = useState(false)
  // The loading screen stays mounted through its fade-out, then goes.
  const [loaderGone, setLoaderGone] = useState(false)
  const { progress } = useProgress()
  const [perf, setPerf] = useState<PerfSample | null>(null)
  const [container, setContainer] = useState<HTMLDivElement | null>(null)
  const prefersReducedMotion = usePrefersReducedMotion()
  const hasInteracted = useEstate((state) => state.hasInteracted)
  const hoveredPlotId = useEstate((state) => state.hoveredPlotId)
  const hoveredExhibitId = useEstate((state) => state.hoveredExhibitId)
  const back = useEstate((state) => state.back)
  const backToInterior = useEstate((state) => state.backToInterior)
  const rendering = useRenderGate(container)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // One level at a time: an exhibit closes to its room, a room to the campus.
      if (event.key === 'Escape') back()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [back])

  return (
    <div
      ref={setContainer}
      className="relative h-full w-full bg-sky"
      style={{ cursor: hoveredPlotId || hoveredExhibitId ? 'pointer' : 'default' }}
    >
      <div
        className="h-full w-full transition-opacity ease-out"
        style={{
          opacity: ready ? 1 : 0,
          transitionDuration: prefersReducedMotion ? '0ms' : `${UI.revealDurationMs}ms`,
        }}
      >
        <Canvas
          shadows="percentage"
          dpr={[1, PERF.maxPixelRatio]}
          frameloop={rendering ? 'always' : 'never'}
          onCreated={(state) => state.setDpr(pixelRatioFor(state.gl))}
          // A click that lands on nothing interactive closes an open exhibit.
          // r3f only reports a miss for a click, never for the end of a drag.
          onPointerMissed={() => {
            if (useEstate.getState().activeExhibitId) backToInterior()
          }}
          gl={{ antialias: true, powerPreference: 'high-performance' }}
          camera={{
            fov: CAMERA.fov,
            near: CAMERA.near,
            far: CAMERA.far,
            position: CAMERA.homePosition,
          }}
        >
          <Suspense fallback={null}>
            <AmbientClock />
            <Lighting />
            <Sky />
            <Ground />
            <Road />
            <Props />
            <Pond />
            <Fountain />
            <Walkers />
            <Fireflies />
            <Buildings />
            <GroundLabels />
            <Interiors />
            <Traffic />
            <Birds />
            <Smoke />
            <CameraRig />
            <WarmUp
              onReady={() => {
                // The last stage: every other one finished before the scene
                // could render at all, so this is the counter reaching 100.
                finishStage('frame')
                setReady(true)
                window.setTimeout(() => setLoaderGone(true), prefersReducedMotion ? 0 : UI.revealDurationMs)
              }}
            />
            {showPerf && <PerfHud onSample={setPerf} />}
          </Suspense>
        </Canvas>
      </div>

      {!loaderGone && <LoadingScreen progress={progress} leaving={ready} />}

      {ready && !hasInteracted && <EngagementHint />}
      {ready && <HoverLabel container={container} />}
      {loaderGone && <FirstRunCard />}

      {showPerf && perf && (
        <div className="pointer-events-none absolute bottom-3 right-3 z-40 border border-ink/20 bg-paper/95 px-3 py-2 font-mono text-[11px] leading-tight text-ink/80">
          <div>calls {perf.calls} / 60</div>
          <div>tris {(perf.triangles / 1000).toFixed(1)}k / 150k</div>
          <div>
            med {perf.medianMs.toFixed(1)}ms p95 {perf.worstMs.toFixed(1)}ms
          </div>
          <div>
            {perf.fps.toFixed(0)}fps · {perf.programs} prog · {perf.geometries} geo ·{' '}
            {perf.textures} tex
          </div>
        </div>
      )}
    </div>
  )
}
