import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  BufferAttribute,
  BufferGeometry,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  MeshLambertMaterial,
  Quaternion,
  Vector3,
} from 'three'
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { ambientTime } from './ambient'
import { CLOUDS } from './constants'
import { trackColour } from './dusk'

// Keyed on position, so the copies of a vertex shared between faces move
// together and each puff stays closed when it is roughened.
function hash(x: number, y: number, z: number): number {
  const value = Math.sin(x * 91.7 + y * 213.3 + z * 57.1) * 43758.5453
  return (value - Math.floor(value)) * 2 - 1
}

function buildCloud(): BufferGeometry {
  const puffs = CLOUDS.puffs.map(([x, y, z, radius]) => {
    const puff = new IcosahedronGeometry(radius, 2)
    puff.deleteAttribute('uv')
    puff.deleteAttribute('normal')
    const position = puff.attributes.position as BufferAttribute
    for (let index = 0; index < position.count; index += 1) {
      const px = position.getX(index)
      const py = position.getY(index)
      const pz = position.getZ(index)
      const k = 1 + hash(px, py, pz) * 0.12
      position.setXYZ(index, x + px * k, y + py * k * CLOUDS.squash, z + pz * k)
    }
    return puff
  })
  const merged = mergeGeometries(puffs, false)
  puffs.forEach((puff) => puff.dispose())
  // Welded, so normals are shared across faces and the puffs shade smooth.
  const cloud = mergeVertices(merged)
  merged.dispose()
  cloud.computeVertexNormals()
  return cloud
}

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

type Cloud = { angle: number; radius: number; height: number; scale: number; spin: number; phase: number }

const lerp = ([from, to]: readonly [number, number], k: number) => from + (to - from) * k

function createClouds(): Cloud[] {
  const random = mulberry32(CLOUDS.seed)
  return Array.from({ length: CLOUDS.count }, (_, index) => ({
    // Spread evenly round the estate, then nudged, so none bunch up.
    angle: (index / CLOUDS.count) * Math.PI * 2 + random() * 0.5,
    radius: lerp(CLOUDS.radius, random()),
    height: lerp(CLOUDS.height, random()),
    scale: lerp(CLOUDS.scale, random()),
    spin: random() * Math.PI * 2,
    phase: random() * Math.PI * 2,
  }))
}

// Lit like the rest of the model, so they dim with the lights at dusk as well
// as taking on the night palette, with a glow of their own colour to keep the
// undersides soft.
const material = new MeshLambertMaterial({ emissiveIntensity: CLOUDS.glow })
trackColour(material.color, 'cloud')
trackColour(material.emissive, 'cloud')

const matrix = new Matrix4()
const position = new Vector3()
const rotation = new Quaternion()
const scale = new Vector3()
const UP = new Vector3(0, 1, 0)

export function Clouds() {
  const meshRef = useRef<InstancedMesh>(null)
  const clouds = useMemo(() => createClouds(), [])
  const geometry = useMemo(() => buildCloud(), [])
  const last = useRef(-1)

  useFrame(() => {
    const mesh = meshRef.current
    const time = ambientTime.value
    // A frozen clock means nothing has moved: skip the rewrite.
    if (!mesh || time === last.current) return
    last.current = time
    clouds.forEach((cloud, index) => {
      const angle = cloud.angle + time * CLOUDS.drift
      position.set(
        Math.cos(angle) * cloud.radius,
        cloud.height + Math.sin(time * 0.2 + cloud.phase) * CLOUDS.bob,
        Math.sin(angle) * cloud.radius,
      )
      rotation.setFromAxisAngle(UP, cloud.spin - angle)
      scale.setScalar(cloud.scale)
      matrix.compose(position, rotation, scale)
      mesh.setMatrixAt(index, matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, CLOUDS.count]}
      castShadow={false}
      receiveShadow={false}
      frustumCulled={false}
      raycast={() => null}
    />
  )
}
