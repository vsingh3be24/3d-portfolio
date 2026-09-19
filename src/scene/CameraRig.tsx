import { useEffect, useMemo, useRef, useState, type ComponentRef } from 'react'
import { OrbitControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { Spherical, Vector3, type PerspectiveCamera } from 'three'
import { plots, type Plot } from '@/data/plots'
import { useCoarsePointer, useIsMobile } from '@/hooks/useIsMobile'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { useEstate, type CampusCamera } from '@/store/useEstate'
import { CAMERA, FLIGHT, FOCUS, INTRO, ROOM } from './constants'
import { introPlays, onReveal } from './intro'
import { PAD_TOP, roomScale } from './room'

type Controls = ComponentRef<typeof OrbitControls>

type Pose = { position: Vector3; target: Vector3 }

// A camera placement as the flights think of it: a point looked at, and where
// the camera sits on a sphere round it. Interpolating these keeps the camera
// swinging round the model instead of cutting a straight line through it.
type View = { target: Vector3; radius: number; phi: number; theta: number }

// The five moves between levels, plus reframing the current one.
type Move = 'enter' | 'exit' | 'shift' | 'hop' | 'reset'

type Flight = {
  from: View
  to: View
  deltaTheta: number
  seconds: number
  startedAt: number
  // Speed the flight's progress starts at, in path lengths per flight. Zero
  // from a standstill; an interrupting flight inherits the camera's motion.
  startSpeed: number
  // Whatever part of the camera's motion the new path doesn't carry. It is
  // added as an offset that starts at that velocity and dies away to nothing
  // by arrival, so nothing ever stops dead or kicks off from rest.
  residual: { camera: Vector3; target: Vector3 } | null
  // A hop between rooms rises to this and comes back down.
  peak: { radius: number; phi: number } | null
  // Whether this flight ends on the campus, so leaving again mid-flight keeps
  // the campus view it was heading for rather than wherever it got to.
  toCampus: boolean
  // The intro's arrival eases out rather than in and out: it is already
  // moving as the loading screen fades off it.
  arrival?: boolean
}

type Limits = {
  min: number
  max: number
  azimuth: { center: number; arc: number } | null
}

const UP = new Vector3(0, 1, 0)

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

// Cubic Hermite from 0 to 1 that leaves at the given speed and arrives at
// rest. With a starting speed of zero it is the plain ease used from rest.
function progress(t: number, startSpeed: number): number {
  if (startSpeed === 0) return easeInOutCubic(t)
  const t2 = t * t
  const t3 = t2 * t
  return (t3 - 2 * t2 + t) * startSpeed + (-2 * t3 + 3 * t2)
}

function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, INTRO.easePower)
}

// The Hermite basis that leaves at unit slope and returns to zero at rest:
// the shape a carried-over velocity decays along.
function fade(t: number): number {
  return t * t * t - 2 * t * t + t
}

// Progress can't start faster than this, however fast the camera was going;
// any extra goes into the residual, which dies away instead of overshooting.
const MAX_START_SPEED = 3

// Above floor + cushion a height passes through untouched; below it, it is
// squeezed exponentially toward the floor, meeting the untouched line with the
// same slope so the camera's motion has no corner in it.
function cushion(y: number): number {
  const knee = FLIGHT.floorHeight + FLIGHT.floorCushion
  if (y >= knee) return y
  return FLIGHT.floorHeight + FLIGHT.floorCushion * Math.exp((y - knee) / FLIGHT.floorCushion)
}

// Places the camera and look-at point at progress k along a flight's path.
function place(flight: Flight, k: number, target: Vector3, position: Vector3, spherical: Spherical) {
  const { from, to } = flight
  target.lerpVectors(from.target, to.target, k)
  let radius = from.radius + (to.radius - from.radius) * k
  let phi = from.phi + (to.phi - from.phi) * k
  if (flight.peak) {
    const rise = Math.sin(Math.PI * k)
    radius += (flight.peak.radius - radius) * rise
    phi += (flight.peak.phi - phi) * rise
  }
  spherical.set(radius, phi, from.theta + flight.deltaTheta * k)
  spherical.makeSafe()
  position.setFromSpherical(spherical).add(target)
}

function shortestAngle(from: number, to: number): number {
  let delta = (to - from) % (Math.PI * 2)
  if (delta > Math.PI) delta -= Math.PI * 2
  if (delta < -Math.PI) delta += Math.PI * 2
  return delta
}

const scratch = new Spherical()

function viewOf(position: Vector3, target: Vector3): View {
  scratch.setFromVector3(position.clone().sub(target))
  return { target: target.clone(), radius: scratch.radius, phi: scratch.phi, theta: scratch.theta }
}

// The scene fills the whole first screen, so on a touch screen a vertical
// swipe must always stay the page's, or a visitor who has tapped the estate
// can never scroll past it. Horizontal drags still orbit, and pinch still
// zooms, because pan-y leaves both to the page's own handlers.
function touchActionFor(hasInteracted: boolean, coarsePointer: boolean): string {
  if (coarsePointer || !hasInteracted) return 'pan-y'
  return 'none'
}

function campusCameraOf(view: View): CampusCamera {
  return { theta: view.theta, phi: view.phi, radius: view.radius }
}

function poseOf(view: View): Pose {
  scratch.set(view.radius, view.phi, view.theta)
  return { position: new Vector3().setFromSpherical(scratch).add(view.target), target: view.target.clone() }
}

function moveSeconds(move: Move, atCampus: boolean): number {
  if (move === 'enter') return FLIGHT.enterSeconds
  if (move === 'exit') return FLIGHT.exitSeconds
  if (move === 'hop') return FLIGHT.hopSeconds
  if (move === 'reset') return atCampus ? FLIGHT.exitSeconds : FLIGHT.shiftSeconds
  return FLIGHT.shiftSeconds
}

function overviewPoseParts(): [Vector3, Vector3] {
  return [new Vector3(...CAMERA.homePosition), new Vector3(...CAMERA.homeTarget)]
}

// Frames the plot's room from the quarter its two missing walls face. Every
// value derives from the room's own scaled size, so no plot needs a
// hand-placed camera.
// The camera's view as the framing needs it: vertical field of view and the
// canvas's width over height.
type Lens = { fov: number; aspect: number }

// Frames the plot's room from the quarter its two missing walls face. Every
// value derives from the room's own scaled size, so no plot needs a
// hand-placed camera.
function plotPose(plot: Plot, exhibitOpen: boolean, isMobile: boolean, lens: Lens): Pose {
  const base = new Vector3(...plot.position)
  const scale = roomScale(plot)
  const shifted = exhibitOpen && !isMobile
  const halfTan = Math.tan((lens.fov * Math.PI) / 360)

  let distance = Math.max(ROOM.width, ROOM.depth) * scale * FOCUS.roomDistanceScale
  // Beside an open panel: pull back until the room — seen corner-on, so about
  // (width + depth) / sqrt 2 across — spans exhibitFill of the strip the panel
  // leaves, and never come closer than the ordinary framing.
  if (shifted) {
    const across = ((ROOM.width + ROOM.depth) / Math.SQRT2) * scale
    const strip = FOCUS.exhibitFill * (1 - FOCUS.panelFraction)
    distance = Math.max(distance, across / (strip * 2 * halfTan * lens.aspect))
  }

  // Buildings face the estate centre and the room's open sides face the same
  // way, swung by the azimuth offset. Taken from position rather than stored
  // rotation so it stays right if plots move.
  const outward = base.clone().setY(0)
  if (outward.lengthSq() === 0) outward.set(0, 0, 1)
  outward.normalize()
  const azimuth = Math.atan2(-outward.x, -outward.z) + FOCUS.azimuthOffset

  const target = new Vector3(base.x, PAD_TOP + ROOM.height * scale * FOCUS.targetHeightFactor, base.z)
  const horizontal = Math.cos(FOCUS.elevation) * distance
  const position = new Vector3(
    target.x + Math.sin(azimuth) * horizontal,
    target.y + Math.sin(FOCUS.elevation) * distance,
    target.z + Math.cos(azimuth) * horizontal,
  )

  // With an exhibit's panel open on the right, move the look-at point right so
  // the room sits clear of it. On mobile the panel is a bottom sheet instead.
  // Then slide the look-at point right until the room sits in the middle of
  // that strip: half the panel's share of the canvas's half-width.
  if (shifted) {
    const view = target.clone().sub(position).setY(0).normalize()
    const halfWidth = distance * halfTan * lens.aspect
    target.addScaledVector(new Vector3(-view.z, 0, view.x), halfWidth * FOCUS.panelFraction)
  }

  return { position, target }
}

export function CameraRig() {
  const controlsRef = useRef<Controls>(null)
  const camera = useThree((state) => state.camera)
  const gl = useThree((state) => state.gl)
  // The framing beside an open panel depends on the canvas's shape.
  const size = useThree((state) => state.size)

  const level = useEstate((state) => state.level)
  const atCampus = level === 'campus'
  const setCampusCamera = useEstate((state) => state.setCampusCamera)
  const activePlotId = useEstate((state) => state.activePlotId)
  const activeExhibitId = useEstate((state) => state.activeExhibitId)
  const resetRequest = useEstate((state) => state.resetRequest)
  const paused = useEstate((state) => state.paused)
  const hasInteracted = useEstate((state) => state.hasInteracted)
  const engage = useEstate((state) => state.markInteracted)

  const prefersReducedMotion = usePrefersReducedMotion()
  const isMobile = useIsMobile()
  const coarsePointer = useCoarsePointer()

  // Drives the control gating as a prop rather than a per-frame write, so the
  // gate is correct from the moment React renders, not from the first frame.
  const [flying, setFlying] = useState(false)
  const flight = useRef<Flight | null>(null)
  // Where the visitor left the campus, restored when they come back to it.
  const previous = useRef<{ atCampus: boolean; plotId: string | null; reset: number } | null>(null)
  const limits = useRef<Limits>({
    min: CAMERA.minDistance,
    max: CAMERA.maxDistance,
    azimuth: null,
  })
  const lastInputAt = useRef(performance.now() / 1000)
  const lastFrameAt = useRef(performance.now() / 1000)

  const offset = useMemo(() => new Vector3(), [])
  const spherical = useMemo(() => new Spherical(), [])

  // The camera's motion as of the last frame, which an interrupting flight
  // picks up from so that it never starts from rest in mid-air.
  const velocity = useMemo(() => ({ camera: new Vector3(), target: new Vector3() }), [])
  const lastSeen = useMemo(() => ({ camera: new Vector3(), target: new Vector3(), at: -1 }), [])
  // Measured over a minimum span of real time: two frames that land almost
  // together would otherwise read as the camera standing still.
  const recordMotion = () => {
    const controls = controlsRef.current
    if (!controls) return
    const now = performance.now() / 1000
    const span = now - lastSeen.at
    if (lastSeen.at >= 0 && span < FLIGHT.velocitySampleSeconds) return
    if (lastSeen.at >= 0 && span < FLIGHT.velocityStaleSeconds) {
      velocity.camera.subVectors(camera.position, lastSeen.camera).divideScalar(span)
      velocity.target.subVectors(controls.target, lastSeen.target).divideScalar(span)
    } else {
      // After a long gap nothing is known about how the camera was moving.
      velocity.camera.set(0, 0, 0)
      velocity.target.set(0, 0, 0)
    }
    lastSeen.camera.copy(camera.position)
    lastSeen.target.copy(controls.target)
    lastSeen.at = now
  }

  // A pointer press counts as engaging on desktop, where dragging can never be
  // a page scroll. Touch has to engage through the affordance instead.
  useEffect(() => {
    const element = gl.domElement
    const markInput = () => {
      lastInputAt.current = performance.now() / 1000
    }
    const onPointerDown = () => {
      markInput()
      if (!coarsePointer) engage()
    }
    const onPointerMove = (event: PointerEvent) => {
      if (event.buttons > 0) markInput()
    }

    element.addEventListener('pointerdown', onPointerDown)
    element.addEventListener('pointermove', onPointerMove)
    element.addEventListener('wheel', markInput, { passive: true })
    element.addEventListener('touchstart', markInput, { passive: true })
    element.addEventListener('touchmove', markInput, { passive: true })
    window.addEventListener('keydown', markInput)
    return () => {
      window.removeEventListener('keydown', markInput)
      element.removeEventListener('pointerdown', onPointerDown)
      element.removeEventListener('pointermove', onPointerMove)
      element.removeEventListener('wheel', markInput)
      element.removeEventListener('touchstart', markInput)
      element.removeEventListener('touchmove', markInput)
    }
  }, [gl, engage, coarsePointer])

  // Child effects run first, so this overrides the touchAction OrbitControls
  // sets on connect. The per-frame guard below re-asserts it after a reconnect.
  useEffect(() => {
    gl.domElement.style.touchAction = touchActionFor(hasInteracted, coarsePointer)
  }, [gl, hasInteracted, coarsePointer])

  useEffect(() => {
    const controls = controlsRef.current
    if (!controls) return

    const before = previous.current
    previous.current = { atCampus, plotId: activePlotId, reset: resetRequest }

    let move: Move = 'shift'
    if (before && before.reset !== resetRequest) move = 'reset'
    else if (before?.atCampus && !atCampus) move = 'enter'
    else if (before && !before.atCampus && atCampus) move = 'exit'
    else if (before && !atCampus && before.plotId !== activePlotId) move = 'hop'

    const inFlight = flight.current

    // Leaving the campus: remember the view, unless the camera is still on its
    // way back to one, in which case that destination is the view to keep.
    if (move === 'enter' && !inFlight?.toCampus) {
      setCampusCamera(campusCameraOf(viewOf(camera.position, controls.target)))
    }

    const plot = activePlotId ? (plots.find((p) => p.id === activePlotId) ?? null) : null
    let pose: Pose
    if (atCampus || !plot) {
      let saved = useEstate.getState().campusCamera
      if (move === 'reset' || !saved) {
        saved = campusCameraOf(viewOf(...overviewPoseParts()))
        setCampusCamera(saved)
      }
      pose = poseOf({ target: new Vector3(...CAMERA.homeTarget), ...saved })
    } else {
      const fov = (camera as PerspectiveCamera).fov
      pose = plotPose(plot, activeExhibitId !== null, isMobile, { fov, aspect: size.width / size.height })
    }
    const radius = pose.position.distanceTo(pose.target)

    // Applied before the next frame, so update() never clamps the new pose to
    // the previous level's distance range and snaps.
    limits.current = {
      min: atCampus ? CAMERA.minDistance : radius * FOCUS.minDistanceFactor,
      max: atCampus ? CAMERA.maxDistance : radius * FOCUS.maxDistanceFactor,
      // A cutaway only reads from the side its missing walls face, so inside a
      // room the orbit is held to an arc around that side.
      azimuth:
        !atCampus
          ? {
              center: Math.atan2(pose.position.x - pose.target.x, pose.position.z - pose.target.z),
              arc: FOCUS.roomAzimuthArc,
            }
          : null,
    }
    controls.minDistance = limits.current.min
    controls.maxDistance = limits.current.max
    controls.minAzimuthAngle = limits.current.azimuth
      ? limits.current.azimuth.center - limits.current.azimuth.arc
      : -Infinity
    controls.maxAzimuthAngle = limits.current.azimuth
      ? limits.current.azimuth.center + limits.current.azimuth.arc
      : Infinity

    const settle = () => {
      flight.current = null
      camera.position.copy(pose.position)
      controls.target.copy(pose.target)
      camera.lookAt(pose.target)
      controls.update()
      setFlying(false)
      // Arriving is not the visitor walking away: the idle drift waits its
      // full delay from here, rather than pulling off the view straight away.
      lastInputAt.current = performance.now() / 1000
    }

    // Crossing the panel breakpoint re-runs this while already parked, so a
    // pose that matches settles instead of flying nowhere.
    const alreadyThere =
      camera.position.distanceToSquared(pose.position) < 1e-4 &&
      controls.target.distanceToSquared(pose.target) < 1e-4

    // The first sight of the campus: parked high and round to one side,
    // behind the loading screen, then swept down into the view as it lifts.
    // Re-running without a real move (strict mode's second pass, a resize)
    // picks the same arrival up where it is rather than replacing it.
    const arriving = flight.current?.arrival && atCampus && move === 'shift' ? flight.current : null
    if (arriving || (!before && atCampus && introPlays())) {
      let arrival = arriving
      if (!arrival) {
        const to = viewOf(pose.position, pose.target)
        arrival = {
          from: { target: to.target.clone(), radius: to.radius * INTRO.radiusScale, phi: INTRO.phi, theta: to.theta + INTRO.swing },
          to,
          deltaTheta: -INTRO.swing,
          seconds: INTRO.seconds,
          startedAt: Infinity,
          startSpeed: 0,
          residual: null,
          peak: null,
          toCampus: true,
          arrival: true,
        }
        place(arrival, 0, controls.target, camera.position, new Spherical())
        camera.lookAt(controls.target)
        flight.current = arrival
        setFlying(true)
      }
      const planned = arrival
      let timer = 0
      const stop = onReveal(() => {
        const now = performance.now() / 1000
        if (!Number.isFinite(planned.startedAt)) planned.startedAt = now
        const remaining = Math.max(planned.startedAt + planned.seconds - now, 0)
        timer = window.setTimeout(settle, (remaining + FLIGHT.settleGraceSeconds) * 1000)
      })
      return () => {
        stop()
        window.clearTimeout(timer)
      }
    }

    if (!before || prefersReducedMotion || alreadyThere) {
      settle()
      return
    }

    // Starting from where the camera actually is means a flight interrupted
    // mid-air carries on from that point rather than snapping anywhere.
    const from = viewOf(camera.position, controls.target)
    const to = viewOf(pose.position, pose.target)
    const seconds = moveSeconds(move, atCampus)
    const next: Flight = {
      from,
      to,
      deltaTheta: shortestAngle(from.theta, to.theta),
      seconds,
      // The flight starts from where the camera was drawn last, so its clock
      // starts then too. Otherwise the first frame of an interrupting flight
      // covers only the sliver since this effect ran, and the camera hitches.
      startedAt: Math.max(lastFrameAt.current, performance.now() / 1000 - CAMERA.maxFrameDelta),
      startSpeed: 0,
      residual: null,
      peak:
        move === 'hop' ? { radius: CAMERA.defaultDistance * FLIGHT.hopRadiusFactor, phi: FLIGHT.hopPhi } : null,
      toCampus: atCampus,
    }

    // Interrupting a flight: carry on at the speed the camera already has.
    // The part of its velocity that lies along the new path becomes the new
    // path's starting speed; the rest fades out over the flight.
    if (inFlight) {
      const epsilon = 1e-3
      const startTarget = new Vector3()
      const startPosition = new Vector3()
      const aheadTarget = new Vector3()
      const aheadPosition = new Vector3()
      const probe = new Spherical()
      place(next, 0, startTarget, startPosition, probe)
      place(next, epsilon, aheadTarget, aheadPosition, probe)
      // How the path moves per unit of progress, at its start.
      const pathSlope = aheadPosition.sub(startPosition).divideScalar(epsilon)
      const targetSlope = aheadTarget.sub(startTarget).divideScalar(epsilon)

      const lengthSq = pathSlope.lengthSq()
      const along = lengthSq > 1e-8 ? (velocity.camera.dot(pathSlope) / lengthSq) * seconds : 0
      next.startSpeed = Math.min(Math.max(along, 0), MAX_START_SPEED)
      const carried = next.startSpeed / seconds
      next.residual = {
        camera: velocity.camera.clone().addScaledVector(pathSlope, -carried),
        target: velocity.target.clone().addScaledVector(targetSlope, -carried),
      }
    }
    flight.current = next
    setFlying(true)

    // Guarantees arrival even if frames stop being delivered mid-flight, so
    // switching away mid-transition can never strand the camera part-way.
    const timer = window.setTimeout(settle, (seconds + FLIGHT.settleGraceSeconds) * 1000)
    return () => window.clearTimeout(timer)
  }, [atCampus, activePlotId, activeExhibitId, isMobile, prefersReducedMotion, resetRequest, camera, velocity, setCampusCamera, size])

  // OrbitControls damps per update, not per second: each frame moves the
  // camera the same share of the remaining drag however long the frame took,
  // so a slow glide judders when frames arrive unevenly. Setting the share
  // from this frame's delta, just before drei's update at priority -1, makes
  // it frame-rate independent.
  useFrame((_, delta) => {
    const controls = controlsRef.current
    if (controls) {
      controls.dampingFactor = 1 - Math.pow(CAMERA.dampingDecay, Math.min(delta, CAMERA.maxFrameDelta))
    }
  }, -2)

  useFrame((_, delta) => {
    const controls = controlsRef.current
    if (!controls) return

    // OrbitControls rewrites touchAction whenever it connects or disposes, so
    // owning it per frame is the only way to keep the pre-engagement scroll.
    const touchAction = touchActionFor(hasInteracted, coarsePointer)
    if (gl.domElement.style.touchAction !== touchAction) {
      gl.domElement.style.touchAction = touchAction
    }

    const current = flight.current
    if (current) {
      // Before its start (the intro, waiting for the reveal) a flight holds
      // at the beginning of its path.
      const t = Math.min(Math.max((performance.now() / 1000 - current.startedAt) / current.seconds, 0), 1)
      const k = current.arrival ? easeOut(t) : progress(t, current.startSpeed)
      place(current, k, controls.target, camera.position, spherical)
      if (current.residual) {
        const pathY = camera.position.y
        const carry = fade(t) * current.seconds
        camera.position.addScaledVector(current.residual.camera, carry)
        controls.target.addScaledVector(current.residual.target, carry)
        // A carried-over dive is cushioned so it can't take the camera into
        // the ground; the planned path itself is never altered.
        if (camera.position.y < pathY) camera.position.y = Math.min(pathY, cushion(camera.position.y))
      }
      camera.lookAt(controls.target)
      recordMotion()
      lastFrameAt.current = performance.now() / 1000
      return
    }

    const idle = performance.now() / 1000 - lastInputAt.current >= CAMERA.idleDelay
    if (atCampus && !prefersReducedMotion && !paused && idle) {
      const step = Math.min(delta, CAMERA.maxFrameDelta) * CAMERA.idleDriftSpeed
      offset.copy(camera.position).sub(controls.target).applyAxisAngle(UP, step)
      camera.position.copy(controls.target).add(offset)
      camera.lookAt(controls.target)
    }
    recordMotion()
    lastFrameAt.current = performance.now() / 1000
  })

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enablePan={false}
      enableDamping
      // Input is off during a flight, but controls keep updating so leftover
      // drag momentum decays instead of kicking in on arrival.
      enableZoom={hasInteracted && !flying}
      enableRotate={(coarsePointer ? hasInteracted : true) && !flying}
      rotateSpeed={CAMERA.rotateSpeed}
      zoomSpeed={CAMERA.zoomSpeed}
      minPolarAngle={CAMERA.minPolarAngle}
      maxPolarAngle={CAMERA.maxPolarAngle}
    />
  )
}
