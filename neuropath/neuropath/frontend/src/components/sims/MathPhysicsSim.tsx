import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

interface MathPhysicsConfig {
  scenario: 'vectors' | 'projectile_motion' | 'sine_wave'
  params: any
}

export default function MathPhysicsSim({ config }: { config: MathPhysicsConfig }) {
  const mountRef = useRef<HTMLDivElement>(null)
  const [t, setT] = useState(0)
  const stateRef = useRef<{
    scene: THREE.Scene
    objects: THREE.Object3D[]
    update: (t: number) => void
  } | null>(null)

  useEffect(() => {
    if (!mountRef.current) return
    const width = mountRef.current.clientWidth
    const height = 400

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000)
    camera.position.set(0, 4, 14)
    camera.lookAt(0, 1, 0)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(width, height)
    mountRef.current.innerHTML = ''
    mountRef.current.appendChild(renderer.domElement)

    scene.add(new THREE.AmbientLight(0xffffff, 0.9))
    const pl = new THREE.PointLight(0x7c9cff, 1.2)
    pl.position.set(5, 8, 10)
    scene.add(pl)

    // grid
    const grid = new THREE.GridHelper(14, 14, 0x2a3548, 0x1a2230)
    scene.add(grid)

    let update: (t: number) => void = () => {}
    const objects: THREE.Object3D[] = []

    if (config.scenario === 'vectors') {
      const vectors: { x: number; y: number }[] = config.params.vectors || [{ x: 3, y: 4 }, { x: -2, y: 5 }]
      const colors = [0x7c9cff, 0xff7a45, 0x4ade80, 0xffc95c]
      vectors.forEach((v, i) => {
        const dir = new THREE.Vector3(v.x, v.y, 0).normalize()
        const length = Math.sqrt(v.x * v.x + v.y * v.y)
        const arrow = new THREE.ArrowHelper(dir, new THREE.Vector3(0, 0.01, 0), length, colors[i % colors.length], 0.4, 0.25)
        scene.add(arrow)
        objects.push(arrow)
      })
    } else if (config.scenario === 'projectile_motion') {
      const { initial_velocity = 20, angle_degrees = 45, gravity = 9.8 } = config.params || {}
      const angle = (angle_degrees * Math.PI) / 180
      const vx = initial_velocity * Math.cos(angle)
      const vy = initial_velocity * Math.sin(angle)
      const flightTime = (2 * vy) / gravity

      const points: THREE.Vector3[] = []
      for (let i = 0; i <= 100; i++) {
        const tt = (i / 100) * flightTime
        const x = vx * tt
        const y = vy * tt - 0.5 * gravity * tt * tt
        points.push(new THREE.Vector3(x * 0.3 - 5, Math.max(y * 0.3, 0), 0))
      }
      const traj = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(points),
        new THREE.LineDashedMaterial({ color: 0x2a3548, dashSize: 0.2, gapSize: 0.1 })
      )
      traj.computeLineDistances()
      scene.add(traj)

      const ball = new THREE.Mesh(
        new THREE.SphereGeometry(0.3, 24, 24),
        new THREE.MeshStandardMaterial({ color: 0xff7a45 })
      )
      scene.add(ball)
      objects.push(ball)

      update = (tNorm: number) => {
        const tt = tNorm * flightTime
        const x = vx * tt
        const y = vy * tt - 0.5 * gravity * tt * tt
        ball.position.set(x * 0.3 - 5, Math.max(y * 0.3, 0), 0)
      }
    } else {
      // sine wave
      const { amplitude = 2, frequency = 1, phase = 0 } = config.params || {}
      const points: THREE.Vector3[] = []
      for (let i = 0; i <= 200; i++) {
        const x = (i / 200) * 12 - 6
        points.push(new THREE.Vector3(x, 0, 0))
      }
      const geom = new THREE.BufferGeometry().setFromPoints(points)
      const line = new THREE.Line(geom, new THREE.LineBasicMaterial({ color: 0x7c9cff }))
      scene.add(line)
      objects.push(line)

      update = (tNorm: number) => {
        const positions = (line.geometry as THREE.BufferGeometry).attributes.position
        for (let i = 0; i <= 200; i++) {
          const x = (i / 200) * 12 - 6
          const y = amplitude * Math.sin(frequency * x + phase + tNorm * Math.PI * 4)
          positions.setY(i, y)
        }
        positions.needsUpdate = true
      }
    }

    stateRef.current = { scene, objects, update }

    let raf: number
    const animate = () => {
      raf = requestAnimationFrame(animate)
      renderer.render(scene, camera)
    }
    animate()

    return () => {
      cancelAnimationFrame(raf)
      renderer.dispose()
    }
  }, [config])

  useEffect(() => {
    stateRef.current?.update(t)
  }, [t])

  return (
    <div>
      <div ref={mountRef} className="rounded-xl overflow-hidden border border-white/5 bg-synapse/40" />
      {config.scenario !== 'vectors' && (
        <div className="flex items-center gap-3 mt-4">
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={t}
            onChange={(e) => setT(parseFloat(e.target.value))}
            className="flex-1"
          />
          <span className="text-xs text-dim font-mono">
            {config.scenario === 'sine_wave' ? `phase shift ${(t * 4).toFixed(2)}π` : `t = ${(t * 100).toFixed(0)}%`}
          </span>
        </div>
      )}
      {config.scenario === 'vectors' && (
        <p className="text-xs text-dim font-mono mt-3">
          Vectors: {(config.params.vectors || []).map((v: any) => `(${v.x}, ${v.y})`).join('  ·  ')}
        </p>
      )}
    </div>
  )
}
