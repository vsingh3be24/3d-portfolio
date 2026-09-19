import type { WebGLRenderer } from 'three'
import { PERF } from './constants'

// GPUs that cannot spare the pixels retina asks for, matched against the name
// the driver reports. Software rasterisers first: those are the ones that
// genuinely cannot cope. Drivers pad the name ("Adreno (TM) 530"), so the
// series number is matched across whatever sits between.
const LOW_TIER_GPU =
  /swiftshader|llvmpipe|software|mali|adreno\D*[1-5]\d{2}|powervr|intel.*(hd|uhd) graphics/i

export function isLowTier(renderer: WebGLRenderer): boolean {
  if ((navigator.hardwareConcurrency || 8) <= PERF.lowTierCores) return true

  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
  if (memory !== undefined && memory <= PERF.lowTierMemoryGb) return true

  const context = renderer.getContext()
  const debug = context.getExtension('WEBGL_debug_renderer_info')
  if (!debug) return false

  return LOW_TIER_GPU.test(String(context.getParameter(debug.UNMASKED_RENDERER_WEBGL) ?? ''))
}

// Decided once, against the renderer that is actually going to do the work. A
// device does not change class mid-visit, so polling for this would cost more
// than it could ever save.
export function pixelRatioFor(renderer: WebGLRenderer): number {
  const cap = isLowTier(renderer) ? PERF.maxPixelRatioLowTier : PERF.maxPixelRatio
  return Math.min(window.devicePixelRatio || 1, cap)
}
