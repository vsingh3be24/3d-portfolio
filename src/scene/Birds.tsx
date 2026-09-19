import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshLambertMaterial,
  Quaternion,
  Vector3,
} from 'three'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { ambientTime } from './ambient'
import { AMBIENT, BIRDS } from './constants'
import { colourLevel } from './dusk'

const COUNT = BIRDS.groups.length * BIRDS.perGroup

// A slim body and two swept wings, nose along +z. aSpan is how far along the
// wing a vertex sits, 0 at the body and 1 at the tip: the flap lifts each
// vertex by the square of it, so the wings bend rather than hinge.
function buildBird(): BufferGeometry {
  const s = BIRDS.wingSpan
  // prettier-ignore
  const positions = [
    // Body: a thin diamond from beak to tail.
    0, 0, 0.22,   0.045, 0, 0,   0, 0.035, 0,
    0, 0, 0.22,   0, 0.035, 0,  -0.045, 0, 0,
    0, 0, -0.2,   0, 0.035, 0,   0.045, 0, 0,
    0, 0, -0.2,  -0.045, 0, 0,   0, 0.035, 0,
    // Wings.
    0.04, 0, 0.07,   s, 0, -0.05,   0.04, 0, -0.09,
    -0.04, 0, 0.07,  -0.04, 0, -0.09,  -s, 0, -0.05,
  ]
  const span = positions.filter((_, index) => index % 3 === 0).map((x) => Math.min(Math.abs(x) / s, 1) ** 2)
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
  geometry.setAttribute('aSpan', new BufferAttribute(new Float32Array(span), 1))
  geometry.computeVertexNormals()
  return geometry
}

const material = new MeshLambertMaterial({ color: BIRDS.colour, side: DoubleSide, flatShading: true })
material.onBeforeCompile = (shader) => {
  shader.uniforms.uTime = ambientTime
  shader.vertexShader = `uniform float uTime;
attribute float aSpan;
attribute float aPhase;
${shader.vertexShader.replace(
  '#include <begin_vertex>',
  `#include <begin_vertex>
  transformed.y += sin( uTime * ${BIRDS.flapSpeed.toFixed(3)} + aPhase ) * ${BIRDS.flapHeight.toFixed(3)} * aSpan;`,
)}`
}
material.customProgramCacheKey = () => 'bird-flap'

type Bird = { radius: number; height: number; speed: number; offset: number; phase: number }

function createFlock(): Bird[] {
  const flock: Bird[] = []
  BIRDS.groups.forEach(([radius, height, speed], group) => {
    for (let index = 0; index < BIRDS.perGroup; index += 1) {
      const k = index / BIRDS.perGroup
      flock.push({
        radius: radius + Math.sin(k * 11.3 + group) * BIRDS.spread,
        height: height + Math.cos(k * 7.1 + group) * BIRDS.lift,
        speed,
        // Loosely bunched: each bird a little ahead of or behind the next.
        offset: k * 0.55 + group * Math.PI,
        phase: k * 5.3 + group * 1.7,
      })
    }
  })
  return flock
}

const here = new Vector3()
const ahead = new Vector3()
const matrix = new Matrix4()
const turn = new Quaternion()
const bankRoll = new Quaternion()
const scale = new Vector3(1, 1, 1)
const ZAXIS = new Vector3(0, 0, 1)
const UP = new Vector3(0, 1, 0)
const facing = new Matrix4()

function place(bird: Bird, time: number, leave: number, out: Vector3) {
  const angle = time * bird.speed + bird.offset
  const radius = bird.radius + Math.sin(time * 0.3 + bird.phase) * 0.8 + leave * BIRDS.leaveRadius
  const height = bird.height + Math.sin(time * 0.7 + bird.phase) * 0.3 + leave * BIRDS.leaveHeight
  return out.set(Math.cos(angle) * radius, height, Math.sin(angle) * radius)
}

export function Birds() {
  const meshRef = useRef<InstancedMesh>(null)
  const prefersReducedMotion = usePrefersReducedMotion()
  const flock = useMemo(() => createFlock(), [])
  const geometry = useMemo(() => {
    const bird = buildBird()
    bird.setAttribute('aPhase', new InstancedBufferAttribute(new Float32Array(flock.map((b) => b.phase)), 1))
    return bird
  }, [flock])

  useFrame(() => {
    const mesh = meshRef.current
    if (!mesh) return
    const leave = colourLevel()
    mesh.visible = !prefersReducedMotion && leave < 0.999
    if (!mesh.visible) return
    const time = ambientTime.value
    flock.forEach((bird, index) => {
      place(bird, time, leave, here)
      // Its speed carries its direction, so a moment later is always ahead.
      place(bird, time + 0.05, leave, ahead)
      facing.lookAt(ahead, here, UP)
      turn.setFromRotationMatrix(facing)
      bankRoll.setFromAxisAngle(ZAXIS, -BIRDS.bank * Math.sign(bird.speed))
      turn.multiply(bankRoll)
      matrix.compose(here, turn, scale)
      mesh.setMatrixAt(index, matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh
      ref={(mesh) => {
        meshRef.current = mesh
        mesh?.layers.enable(AMBIENT.reflectLayer)
      }}
      args={[geometry, material, COUNT]}
      castShadow={false}
      receiveShadow={false}
      frustumCulled={false}
      raycast={() => null}
    />
  )
}
