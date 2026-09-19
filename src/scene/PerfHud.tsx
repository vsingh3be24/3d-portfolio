import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import type { Camera, Scene, WebGLRenderer } from 'three'
import { postPasses } from './postPasses'

// Dev-only instrumentation. Reads the numbers the budget is written in — draw
// calls, triangles, frame time — straight off the renderer, so what is measured
// is what the GPU was actually asked to do.
export type PerfSample = {
  calls: number
  // Of those, the finishing pass's fullscreen draws.
  post: number
  triangles: number
  medianMs: number
  worstMs: number
  fps: number
  programs: number
  geometries: number
  textures: number
}

type BenchResult = { medianMs: number; p95Ms: number; calls: number; triangles: number }

declare global {
  interface Window {
    __perf?: PerfSample
    __bench?: (frames?: number) => BenchResult
    // Controls are exposed so views can be framed exactly when checking a change,
    // rather than by dragging until the right thing happens to be in shot.
    // advance steps one full frame, useFrame included, for when the pane is
    // in the background and requestAnimationFrame is throttled to 1fps.
    __three?: {
      gl: WebGLRenderer
      scene: Scene
      camera: Camera
      controls: unknown
      advance: (timestamp: number) => void
    }
  }
}

export function PerfHud({ onSample }: { onSample: (sample: PerfSample) => void }) {
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)
  const camera = useThree((state) => state.camera)
  const controls = useThree((state) => state.controls)
  const advance = useThree((state) => state.advance)
  const samples = useRef<number[]>([])
  const last = useRef(performance.now())
  const reported = useRef(performance.now())

  // rAF is throttled whenever the tab is occluded, which makes wall-clock frame
  // deltas useless for judging cost. Exposing the renderer lets a frame be timed
  // synchronously instead, on demand.
  useEffect(() => {
    window.__three = { gl, scene, camera, controls, advance }
    window.__bench = (frames = 60) => {
      const context = gl.getContext()
      gl.render(scene, camera)
      context.finish()

      const times: number[] = []
      for (let index = 0; index < frames; index += 1) {
        const start = performance.now()
        gl.render(scene, camera)
        context.finish()
        times.push(performance.now() - start)
      }
      times.sort((a, b) => a - b)
      return {
        medianMs: times[Math.floor(times.length / 2)],
        p95Ms: times[Math.floor(times.length * 0.95)],
        calls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
      }
    }
    return () => {
      delete window.__bench
      delete window.__three
    }
  }, [gl, scene, camera, controls, advance])

  useFrame(() => {
    const now = performance.now()
    samples.current.push(now - last.current)
    last.current = now
    if (samples.current.length > 180) samples.current.shift()

    // Reported on an interval rather than per frame, so reading the HUD never
    // becomes the thing that costs the frame.
    if (now - reported.current < 500) return
    reported.current = now

    const sorted = [...samples.current].sort((a, b) => a - b)
    const median = sorted[Math.floor(sorted.length / 2)] ?? 0
    // 95th percentile, which is where stutter actually lives.
    const worst = sorted[Math.floor(sorted.length * 0.95)] ?? 0

    const sample: PerfSample = {
      calls: gl.info.render.calls,
      post: postPasses.value,
      triangles: gl.info.render.triangles,
      medianMs: median,
      worstMs: worst,
      fps: median > 0 ? 1000 / median : 0,
      programs: gl.info.programs?.length ?? 0,
      geometries: gl.info.memory.geometries,
      textures: gl.info.memory.textures,
    }

    window.__perf = sample
    onSample(sample)
  })

  return null
}
