import { useLayoutEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  PlaneGeometry,
  Quaternion,
  Vector3,
} from 'three'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { useEstate } from '@/store/useEstate'
import { AMBIENT, DUSK, ROAD, TRAFFIC, type VehicleBody } from './constants'
import { getCurvatureAt, getLanePoint, getLaneStretchAt, getTangentAt, roadLength, wrapU } from './curves'
import { stage } from './dusk'
import { axleGeometry, bodyGeometry, bodyMaterial, carLights, createBeamTexture, wheelMaterial } from './vehicles'

const UP = new Vector3(0, 1, 0)
const UNIT_SCALE = new Vector3(1, 1, 1)
const VEHICLE_COUNT = TRAFFIC.vehicles.length
const BODIES: VehicleBody[] = ['sedan', 'suv']

// Hoisted so the per-frame update allocates nothing.
const position = new Vector3()
const tangent = new Vector3()
const forward = new Vector3()
const right = new Vector3()
const up = new Vector3()
const orientation = new Quaternion()
const roll = new Quaternion()
const carMatrix = new Matrix4()
const basis = new Matrix4()
const axleOffset = new Matrix4()
const axleSpin = new Matrix4()
const axleMatrix = new Matrix4()
const flatMatrix = new Matrix4()
const heading = new Quaternion()
const flatPosition = new Vector3()

// A soft dark oval, darkest in the middle, fading to nothing at the edge.
function createBlobTexture(): CanvasTexture {
  const size = TRAFFIC.blobTextureSize
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')!
  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  gradient.addColorStop(0, 'rgba(0,0,0,1)')
  gradient.addColorStop(0.55, 'rgba(0,0,0,0.7)')
  gradient.addColorStop(1, 'rgba(0,0,0,0)')
  context.fillStyle = gradient
  context.fillRect(0, 0, size, size)
  return new CanvasTexture(canvas)
}

let flats: { blob: PlaneGeometry; blobMaterial: MeshBasicMaterial; beam: PlaneGeometry; beamMaterial: MeshBasicMaterial } | null =
  null

function getFlats() {
  if (flats) return flats
  const blob = new PlaneGeometry(TRAFFIC.blobWidth, TRAFFIC.blobLength)
  blob.rotateX(-Math.PI / 2)
  // The beam's near end sits at the car's nose, so it reaches forward from it.
  const beam = new PlaneGeometry(TRAFFIC.beamWidth, TRAFFIC.beamLength)
  beam.rotateX(-Math.PI / 2)
  flats = {
    blob,
    blobMaterial: new MeshBasicMaterial({
      color: '#000000',
      alphaMap: createBlobTexture(),
      transparent: true,
      opacity: TRAFFIC.blobOpacity,
      depthWrite: false,
    }),
    beam,
    beamMaterial: new MeshBasicMaterial({
      color: TRAFFIC.headlightGlow,
      map: createBeamTexture(),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: AdditiveBlending,
    }),
  }
  return flats
}

type Vehicle = {
  u: number
  direction: number
  laneOffset: number
  cruise: number
  speed: number
  brake: number
  phase: number
  spin: number
  body: VehicleBody
  // Its index among the instances of its own body type.
  slot: number
}

function createVehicles(): Vehicle[] {
  const slots: Record<VehicleBody, number> = { sedan: 0, suv: 0 }
  const vehicles = TRAFFIC.vehicles.map((spec, index) => ({
    u: spec.start,
    direction: spec.direction,
    // Opposite directions sit on opposite sides of the centreline.
    laneOffset: ROAD.laneOffset * spec.direction,
    cruise: TRAFFIC.baseSpeed * spec.speedScale,
    speed: TRAFFIC.baseSpeed * spec.speedScale,
    brake: 0,
    phase: index * 2.1,
    spin: 0,
    body: spec.body,
    slot: slots[spec.body]++,
  }))
  // Build each lane's stretch table now, behind the loading screen, rather
  // than on the first frame the cars move.
  for (const vehicle of vehicles) getLaneStretchAt(vehicle.u, vehicle.laneOffset)
  return vehicles
}

// Road distance from one car forward to the next, in its direction of travel.
function gapAhead(vehicle: Vehicle, other: Vehicle): number {
  return wrapU((other.u - vehicle.u) * vehicle.direction) * roadLength
}

const counts = TRAFFIC.vehicles.reduce(
  (total, spec) => ({ ...total, [spec.body]: total[spec.body] + 1 }),
  { sedan: 0, suv: 0 } as Record<VehicleBody, number>,
)

// Each body type is one instanced mesh with a per-car brake level beside its
// matrix and colour, so five cars of two shapes cost two draw calls.
for (const kind of BODIES) {
  if (counts[kind] > 0) {
    bodyGeometry(kind).setAttribute('aBrake', new InstancedBufferAttribute(new Float32Array(counts[kind]), 1))
  }
}

export function Traffic() {
  const bodyRefs = useRef<Record<VehicleBody, InstancedMesh | null>>({ sedan: null, suv: null })
  const axleRef = useRef<InstancedMesh>(null)
  const blobRef = useRef<InstancedMesh>(null)
  const beamRef = useRef<InstancedMesh>(null)
  const prefersReducedMotion = usePrefersReducedMotion()
  const paused = useEstate((state) => state.paused)

  const vehicles = useRef<Vehicle[]>(createVehicles())
  const { blob, blobMaterial, beam, beamMaterial } = getFlats()

  useLayoutEffect(() => {
    const colour = new Color()
    for (const vehicle of vehicles.current) {
      const mesh = bodyRefs.current[vehicle.body]
      const spec = TRAFFIC.vehicles[vehicles.current.indexOf(vehicle)]
      mesh?.setColorAt(vehicle.slot, colour.set(spec.colour))
    }
    for (const kind of BODIES) {
      const mesh = bodyRefs.current[kind]
      if (mesh?.instanceColor) mesh.instanceColor.needsUpdate = true
    }
  }, [])

  useFrame((state, delta) => {
    const axleMesh = axleRef.current
    const blobMesh = blobRef.current
    const beamMesh = beamRef.current
    if (!axleMesh || !blobMesh || !beamMesh) return

    const step = Math.min(delta, 0.05)
    const moving = !prefersReducedMotion && !paused
    const elapsed = state.clock.elapsedTime
    const lights = stage(DUSK.lampStart, DUSK.lampEnd)
    carLights.value = lights
    beamMaterial.opacity = TRAFFIC.beamOpacity * lights
    beamMesh.visible = lights > 0

    const all = vehicles.current
    all.forEach((vehicle, index) => {
      if (moving) {
        const wander = 1 + TRAFFIC.wanderAmplitude * Math.sin(TRAFFIC.wanderFrequency * elapsed + vehicle.phase)
        let target = vehicle.cruise * wander
        // Follow the nearest car ahead in the same lane: close to followGap,
        // then match its speed, and stop short of stopGap however it brakes.
        let nearest: Vehicle | null = null
        let gap = Infinity
        for (const other of all) {
          if (other === vehicle || other.direction !== vehicle.direction) continue
          const distance = gapAhead(vehicle, other)
          if (distance < gap) {
            gap = distance
            nearest = other
          }
        }
        if (nearest && gap < TRAFFIC.followGap) {
          const room = (gap - TRAFFIC.stopGap) / (TRAFFIC.followGap - TRAFFIC.stopGap)
          target = Math.min(target, Math.max(0, nearest.speed * Math.max(room, 0) + room * vehicle.cruise * 0.2))
        }
        const braking = target < vehicle.speed - 0.05
        const rate = braking ? TRAFFIC.braking : TRAFFIC.acceleration
        vehicle.speed += Math.max(-rate * step, Math.min(rate * step, target - vehicle.speed))
        const brakeGoal = braking ? 1 : 0
        vehicle.brake += (brakeGoal - vehicle.brake) * (1 - Math.exp(-TRAFFIC.brakeLightRate * step))

        // u is centreline arc length; the lane's stretch turns it into the
        // distance this car actually covers, so its speed holds through bends.
        const stretch = getLaneStretchAt(vehicle.u, vehicle.laneOffset)
        vehicle.u = wrapU(vehicle.u + (vehicle.speed * step * vehicle.direction) / (roadLength * stretch))
        vehicle.spin += (vehicle.speed * step) / TRAFFIC.wheelRadius
      } else {
        vehicle.brake = 0
      }

      getLanePoint(vehicle.u, vehicle.laneOffset, position)
      getTangentAt(vehicle.u, tangent)
      forward.copy(tangent).multiplyScalar(vehicle.direction).normalize()
      right.crossVectors(UP, forward).normalize()
      up.crossVectors(forward, right).normalize()

      basis.makeBasis(right, up, forward)
      orientation.setFromRotationMatrix(basis)

      // Blob and beam lie flat and follow the heading, never the body's roll.
      heading.copy(orientation)
      flatPosition.set(position.x, TRAFFIC.blobY, position.z)
      flatMatrix.compose(flatPosition, heading, UNIT_SCALE)
      blobMesh.setMatrixAt(index, flatMatrix)
      flatPosition.set(
        position.x + forward.x * TRAFFIC.beamAhead,
        TRAFFIC.beamY,
        position.z + forward.z * TRAFFIC.beamAhead,
      )
      flatMatrix.compose(flatPosition, heading, UNIT_SCALE)
      beamMesh.setMatrixAt(index, flatMatrix)

      const bank = Math.max(
        -TRAFFIC.maxBank,
        Math.min(TRAFFIC.maxBank, getCurvatureAt(vehicle.u) * vehicle.direction * TRAFFIC.bankScale),
      )
      roll.setFromAxisAngle(forward, bank)
      orientation.premultiply(roll)

      position.y = ROAD.roadY
      carMatrix.compose(position, orientation, UNIT_SCALE)
      const bodyMesh = bodyRefs.current[vehicle.body]
      if (bodyMesh) {
        bodyMesh.setMatrixAt(vehicle.slot, carMatrix)
        ;(bodyMesh.geometry.attributes.aBrake as InstancedBufferAttribute).setX(vehicle.slot, vehicle.brake)
      }

      for (let axleIndex = 0; axleIndex < 2; axleIndex += 1) {
        const z = axleIndex === 0 ? TRAFFIC.wheelbase / 2 : -TRAFFIC.wheelbase / 2
        axleOffset.makeTranslation(0, TRAFFIC.wheelRadius, z)
        axleSpin.makeRotationX(vehicle.spin)
        axleMatrix.multiplyMatrices(carMatrix, axleOffset).multiply(axleSpin)
        axleMesh.setMatrixAt(index * 2 + axleIndex, axleMatrix)
      }
    })

    for (const kind of BODIES) {
      const mesh = bodyRefs.current[kind]
      if (!mesh) continue
      mesh.instanceMatrix.needsUpdate = true
      mesh.geometry.attributes.aBrake.needsUpdate = true
    }
    axleMesh.instanceMatrix.needsUpdate = true
    blobMesh.instanceMatrix.needsUpdate = true
    beamMesh.instanceMatrix.needsUpdate = true
  })

  // Culling is off for every traffic mesh. An instanced mesh's bounds are
  // computed once, from wherever its instances were at that moment, and cars
  // that have since driven outside them would be culled mid-road.
  return (
    <group>
      {BODIES.filter((kind) => counts[kind] > 0).map((kind) => (
        <instancedMesh
          key={kind}
          ref={(mesh) => {
            bodyRefs.current[kind] = mesh
            mesh?.layers.enable(AMBIENT.reflectLayer)
          }}
          args={[bodyGeometry(kind), bodyMaterial, counts[kind]]}
          castShadow={false}
          receiveShadow={false}
          frustumCulled={false}
        />
      ))}
      <instancedMesh
        ref={(mesh) => {
          axleRef.current = mesh
          mesh?.layers.enable(AMBIENT.reflectLayer)
        }}
        args={[axleGeometry(), wheelMaterial, VEHICLE_COUNT * 2]}
        castShadow={false}
        receiveShadow={false}
        frustumCulled={false}
      />
      <instancedMesh
        ref={blobRef}
        args={[blob, blobMaterial, VEHICLE_COUNT]}
        castShadow={false}
        receiveShadow={false}
        frustumCulled={false}
        raycast={() => null}
      />
      <instancedMesh
        ref={beamRef}
        args={[beam, beamMaterial, VEHICLE_COUNT]}
        castShadow={false}
        receiveShadow={false}
        frustumCulled={false}
        raycast={() => null}
        visible={false}
      />
    </group>
  )
}
