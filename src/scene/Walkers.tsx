import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  IcosahedronGeometry,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshLambertMaterial,
  Quaternion,
  Vector3,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { plots } from '@/data/plots'
import { ambientTime } from './ambient'
import { ESTATE, PARK, WALKERS } from './constants'

const f = (value: number) => value.toFixed(4)

// Each part says which way it swings: legs and arms opposite on each side,
// so a stride puts the left leg forward with the right arm.
function part(geometry: BufferGeometry, colour: string, paint: number, leg: number, arm: number): BufferGeometry {
  const flat = geometry.index ? geometry.toNonIndexed() : geometry
  if (flat !== geometry) geometry.dispose()
  flat.deleteAttribute('uv')
  const count = flat.attributes.position.count
  const value = new Color(colour)
  const colours = new Float32Array(count * 3)
  for (let index = 0; index < count; index += 1) colours.set([value.r, value.g, value.b], index * 3)
  flat.setAttribute('color', new BufferAttribute(colours, 3))
  flat.setAttribute('aPaint', new BufferAttribute(new Float32Array(count).fill(paint), 1))
  flat.setAttribute('aLeg', new BufferAttribute(new Float32Array(count).fill(leg), 1))
  flat.setAttribute('aArm', new BufferAttribute(new Float32Array(count).fill(arm), 1))
  return flat
}

function box(w: number, h: number, d: number, x: number, y: number, z: number): BoxGeometry {
  const geometry = new BoxGeometry(w, h, d)
  geometry.translate(x, y, z)
  return geometry
}

// A person about half a unit tall, facing +z.
function buildPerson(): BufferGeometry {
  const head = new IcosahedronGeometry(0.068, 1)
  head.translate(0, 0.52, 0)
  const parts = [
    part(box(0.07, WALKERS.hipY, 0.08, -0.045, WALKERS.hipY / 2, 0), WALKERS.trousers, 0, 1, 0),
    part(box(0.07, WALKERS.hipY, 0.08, 0.045, WALKERS.hipY / 2, 0), WALKERS.trousers, 0, -1, 0),
    part(box(0.18, 0.22, 0.11, 0, WALKERS.hipY + 0.11, 0), '#ffffff', 1, 0, 0),
    part(box(0.05, 0.19, 0.05, -0.12, WALKERS.shoulderY - 0.095, 0), '#ffffff', 1, 0, -1),
    part(box(0.05, 0.19, 0.05, 0.12, WALKERS.shoulderY - 0.095, 0), '#ffffff', 1, 0, 1),
    part(head, WALKERS.skin, 0, 0, 0),
  ]
  const person = mergeGeometries(parts, false)
  parts.forEach((piece) => piece.dispose())
  person.computeVertexNormals()
  return person
}

// Legs swing from the hip and arms from the shoulder, in step with how fast
// the person walks, with a small rise on each step. The shirt takes the
// person's colour; trousers and skin keep their own.
const material = new MeshLambertMaterial({ vertexColors: true, flatShading: true })
material.onBeforeCompile = (shader) => {
  shader.uniforms.uTime = ambientTime
  shader.vertexShader = `uniform float uTime;
attribute float aPaint;
attribute float aLeg;
attribute float aArm;
attribute float aStep;
attribute float aPhase;
${shader.vertexShader
  .replace(
    '#include <begin_vertex>',
    `#include <begin_vertex>
    float swing = sin( uTime * aStep + aPhase );
    transformed.z += swing * ${f(WALKERS.legSwing)} * aLeg * max( ${f(WALKERS.hipY)} - transformed.y, 0.0 );
    transformed.z -= swing * ${f(WALKERS.armSwing)} * aArm * max( ${f(WALKERS.shoulderY)} - transformed.y, 0.0 );
    transformed.y += abs( swing ) * ${f(WALKERS.bob)};`,
  )
  .replace(
    '#include <color_vertex>',
    `vColor = vec4( 1.0 );
    vColor.rgb *= color;
    #ifdef USE_INSTANCING_COLOR
      vColor.rgb *= mix( vec3( 1.0 ), instanceColor.rgb, aPaint );
    #endif`,
  )}`
}
material.customProgramCacheKey = () => 'walker'

function mulberry32(seed: number) {
  let state = seed
  return () => {
    state |= 0
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const lerp = ([from, to]: readonly [number, number], k: number) => from + (to - from) * k

type Walker = { radius: number; speed: number; start: number; from: number; span: number }

// The arc of the path people use: all of it, unless the noticeboard stands on
// it, in which case they turn back either side of it.
function walkableArc(radius: number): { from: number; span: number } {
  const board = plots.find((plot) => plot.kind === 'contact')
  if (!board) return { from: 0, span: Math.PI * 2 }
  const [x, , z] = board.position
  const reach = Math.hypot(x, z)
  const halfWidth = ESTATE.noticeBoardWidth / 2 + WALKERS.boardClearance
  if (Math.abs(reach - radius) > halfWidth) return { from: 0, span: Math.PI * 2 }
  const gap = halfWidth / radius
  return { from: Math.atan2(x, z) + gap, span: Math.PI * 2 - gap * 2 }
}

function createWalkers(): Walker[] {
  const random = mulberry32(WALKERS.seed)
  return Array.from({ length: WALKERS.count }, (_, index) => {
    const radius = lerp(WALKERS.radius, (index + random() * 0.5) / WALKERS.count)
    const { from, span } = walkableArc(radius)
    return { radius, speed: lerp(WALKERS.speed, random()), start: random() * span * radius * 2, from, span }
  })
}

const matrix = new Matrix4()
const position = new Vector3()
const facing = new Quaternion()
const ONE = new Vector3(1, 1, 1)
const UP = new Vector3(0, 1, 0)

export function Walkers() {
  const meshRef = useRef<InstancedMesh>(null)
  const walkers = useMemo(() => createWalkers(), [])
  const geometry = useMemo(() => {
    const person = buildPerson()
    // Steps per second follow walking speed, so feet never slide.
    const step = walkers.map((walker) => (walker.speed / (WALKERS.stride * 2)) * Math.PI * 2)
    person.setAttribute('aStep', new InstancedBufferAttribute(new Float32Array(step), 1))
    person.setAttribute('aPhase', new InstancedBufferAttribute(new Float32Array(walkers.map((_, i) => i * 1.7)), 1))
    return person
  }, [walkers])
  const last = useRef(-1)

  // Colours go on at mount, before the loading screen compiles the shader: a
  // program compiled without per-instance colour would ignore them for good.
  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    const colour = new Color()
    walkers.forEach((_, index) => mesh.setColorAt(index, colour.set(WALKERS.shirts[index % WALKERS.shirts.length])))
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [walkers])

  useFrame(() => {
    const mesh = meshRef.current
    const time = ambientTime.value
    if (!mesh || time === last.current) return
    last.current = time

    walkers.forEach((walker, index) => {
      // There and back along the arc: distance walked, folded at each end.
      const length = walker.span * walker.radius
      const travelled = (walker.start + walker.speed * time) % (length * 2)
      const along = travelled < length ? travelled : length * 2 - travelled
      const heading = travelled < length ? 1 : -1
      const angle = walker.from + along / walker.radius
      // The park path is a ring centred on the estate.
      position.set(Math.sin(angle) * walker.radius, PARK.pathY, Math.cos(angle) * walker.radius)
      // The path's tangent at this angle, in the direction of travel.
      facing.setFromAxisAngle(UP, angle + (heading > 0 ? Math.PI / 2 : -Math.PI / 2))
      matrix.compose(position, facing, ONE)
      mesh.setMatrixAt(index, matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, WALKERS.count]}
      castShadow={false}
      receiveShadow={false}
      frustumCulled={false}
      raycast={() => null}
    />
  )
}
