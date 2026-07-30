'use client'

import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { ImprovedNoise } from 'three/examples/jsm/math/ImprovedNoise.js'

/* ------------------------------------------------------------------ */
/* Shared scroll progress (0..1 across the whole document)             */
/* ------------------------------------------------------------------ */
const scrollState = { progress: 0 }

function useTrackScroll() {
  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight
      scrollState.progress = max > 0 ? window.scrollY / max : 0
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const cb = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener('change', cb)
    return () => mq.removeEventListener('change', cb)
  }, [])
  return reduced
}

/* ------------------------------------------------------------------ */
/* Pause render loop when tab hidden                                   */
/* ------------------------------------------------------------------ */
function VisibilityGuard() {
  const setFrameloop = useThree((s) => s.setFrameloop)
  useEffect(() => {
    const onVis = () => {
      setFrameloop(document.visibilityState === 'visible' ? 'always' : 'never')
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [setFrameloop])
  return null
}

/* ------------------------------------------------------------------ */
/* Drifting particle field with connector lines                        */
/* ------------------------------------------------------------------ */
function ParticleField({ reduced }: { reduced: boolean }) {
  const COUNT = reduced ? 36 : 130
  const BOUNDS = new THREE.Vector3(11, 7, 4)
  const CONNECT_DIST = 2.1
  const MAX_LINKS = COUNT * 3

  const pointsRef = useRef<THREE.Points>(null)
  const linesRef = useRef<THREE.LineSegments>(null)
  const frame = useRef(0)

  const { positions, velocities, colors } = useMemo(() => {
    const positions = new Float32Array(COUNT * 3)
    const velocities = new Float32Array(COUNT * 3)
    const colors = new Float32Array(COUNT * 3)
    const teal = new THREE.Color('#0d9488')
    const blue = new THREE.Color('#3b82f6')
    const ink = new THREE.Color('#4a463e')
    for (let i = 0; i < COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 2 * BOUNDS.x
      positions[i * 3 + 1] = (Math.random() - 0.5) * 2 * BOUNDS.y
      positions[i * 3 + 2] = (Math.random() - 0.5) * 2 * BOUNDS.z - 2
      velocities[i * 3] = (Math.random() - 0.5) * 0.0035
      velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.0028
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.0018
      const r = Math.random()
      const c = r < 0.18 ? teal : r < 0.3 ? blue : ink
      colors[i * 3] = c.r
      colors[i * 3 + 1] = c.g
      colors[i * 3 + 2] = c.b
    }
    return { positions, velocities, colors }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [COUNT])

  const linePositions = useMemo(
    () => new Float32Array(MAX_LINKS * 6),
    [MAX_LINKS],
  )

  useFrame(() => {
    const pts = pointsRef.current
    const lines = linesRef.current
    if (!pts || !lines) return
    const posAttr = pts.geometry.attributes.position as THREE.BufferAttribute
    const arr = posAttr.array as Float32Array

    if (!reduced) {
      for (let i = 0; i < COUNT; i++) {
        for (let a = 0; a < 3; a++) {
          const idx = i * 3 + a
          arr[idx] += velocities[idx]
          const bound = a === 0 ? BOUNDS.x : a === 1 ? BOUNDS.y : BOUNDS.z
          if (arr[idx] > bound || arr[idx] < -bound - (a === 2 ? 2 : 0)) {
            velocities[idx] *= -1
          }
        }
      }
      posAttr.needsUpdate = true
    }

    // Rebuild connector lines every other frame only
    frame.current++
    if (frame.current % 2 === 0) {
      const lineAttr = lines.geometry.attributes
        .position as THREE.BufferAttribute
      const larr = lineAttr.array as Float32Array
      let link = 0
      const d2max = CONNECT_DIST * CONNECT_DIST
      outer: for (let i = 0; i < COUNT; i++) {
        for (let j = i + 1; j < COUNT; j++) {
          const dx = arr[i * 3] - arr[j * 3]
          const dy = arr[i * 3 + 1] - arr[j * 3 + 1]
          const dz = arr[i * 3 + 2] - arr[j * 3 + 2]
          const d2 = dx * dx + dy * dy + dz * dz
          if (d2 < d2max) {
            larr[link * 6] = arr[i * 3]
            larr[link * 6 + 1] = arr[i * 3 + 1]
            larr[link * 6 + 2] = arr[i * 3 + 2]
            larr[link * 6 + 3] = arr[j * 3]
            larr[link * 6 + 4] = arr[j * 3 + 1]
            larr[link * 6 + 5] = arr[j * 3 + 2]
            link++
            if (link >= MAX_LINKS) break outer
          }
        }
      }
      lines.geometry.setDrawRange(0, link * 2)
      lineAttr.needsUpdate = true
    }
  })

  return (
    <group>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={0.045}
          vertexColors
          transparent
          opacity={0.55}
          sizeAttenuation
          depthWrite={false}
        />
      </points>
      <lineSegments ref={linesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[linePositions, 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial
          color="#4a463e"
          transparent
          opacity={0.1}
          depthWrite={false}
        />
      </lineSegments>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Low-poly animated capsule shape                                     */
/* ------------------------------------------------------------------ */
function Capsule({ reduced }: { reduced: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null)

  const { geometry, basePositions } = useMemo(() => {
    const geometry = new THREE.CapsuleGeometry(0.80, 2.0, 16, 32)
    const basePositions = (
      geometry.attributes.position.array as Float32Array
    ).slice()

    const count = geometry.attributes.position.count
    const colors = new Float32Array(count * 3)
    const deep = new THREE.Color('#f9113f')
    const bright = new THREE.Color('#dd1919')
    const tmp = new THREE.Color()
    for (let i = 0; i < count; i++) {
      const y = (basePositions[i * 3 + 1] + 1.0) / 3.0
      tmp.copy(deep).lerp(bright, Math.pow(y, 1.1))
      colors[i * 3] = tmp.r
      colors[i * 3 + 1] = tmp.g
      colors[i * 3 + 2] = tmp.b
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return { geometry, basePositions }
  }, [])

  useFrame(({ clock, camera }) => {
    const mesh = meshRef.current
    if (!mesh) return

    const p = scrollState.progress
    const originX = 4.0
    const originY = 0.9
    const scrollLeft = -p * 3.2
    const wobbleX = Math.sin(clock.elapsedTime * 1.8) * 0.12
    const wobbleY = Math.cos(clock.elapsedTime * 1.3) * 0.16

    mesh.position.set(
      originX + scrollLeft + wobbleX,
      originY + wobbleY,
      -2.5 - p * 2,
    )
    camera.position.y = -p * 5.0
    camera.position.x = Math.sin(p * Math.PI * 2) * 0.35

    if (reduced) return

    mesh.rotation.y = clock.elapsedTime * 0.06
    mesh.rotation.z = clock.elapsedTime * 0.025
  })

  return (
    <mesh ref={meshRef} geometry={geometry} position={[4.3, 0.6, -2.5]}>
      <meshPhysicalMaterial
        vertexColors
        roughness={0.24}
        metalness={0.07}
        clearcoat={0.7}
        clearcoatRoughness={0.25}
        transparent
        opacity={0.85}
        depthWrite={false}
      />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/* Fixed full-viewport canvas behind the whole page                    */
/* ------------------------------------------------------------------ */
export function LandingScene() {
  useTrackScroll()
  const reduced = usePrefersReducedMotion()

  return (
    <div className="fixed inset-0 -z-10" aria-hidden="true">
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 0, 9], fov: 45 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
        style={{
          background: 'radial-gradient(circle at top left, rgba(14,255,255,0.16), rgba(10,32,58,0.9) 32%, rgba(2,10,24,1) 100%)',
        }}
      >
        <VisibilityGuard />
        <ambientLight intensity={0.65} color="#9ee8ff" />
        <directionalLight position={[4, 6, 6]} intensity={1.05} color="#7dd3fc" />
        <directionalLight
          position={[-6, -2, 4]}
          intensity={0.45}
          color="#22d3ee"
        />
        <ParticleField reduced={reduced} />
        <Capsule reduced={reduced} />
      </Canvas>
    </div>
  )
}
