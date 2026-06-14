import { useEffect, useRef } from 'react'
import * as THREE from 'three'

interface ProbConfig {
  scenario: 'normal_distribution' | 'histogram' | 'scatter' | 'bayes'
  params?: { mean?: number; std?: number; samples?: number; bins?: number[] }
}

function gaussianRandom(mean: number, std: number) {
  let u = 0, v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return mean + std * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

export default function ProbabilityStatsSim({ config }: { config: ProbConfig }) {
  const mountRef = useRef<HTMLDivElement>(null)

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
    pl.position.set(0, 8, 10)
    scene.add(pl)
    scene.add(new THREE.GridHelper(14, 14, 0x2a3548, 0x1a2230))

    const mean = config.params?.mean ?? 0
    const std = config.params?.std ?? 1
    const samples = config.params?.samples ?? 200

    if (config.scenario === 'normal_distribution' || config.scenario === 'bayes') {
      // bell curve as line + sample points
      const points: THREE.Vector3[] = []
      for (let i = -60; i <= 60; i++) {
        const x = (i / 10) * std + mean
        const xPos = i / 10
        const y = (1 / (std * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * Math.pow((x - mean) / std, 2))
        points.push(new THREE.Vector3(xPos, y * 8, 0))
      }
      const curve = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(points),
        new THREE.LineBasicMaterial({ color: 0x7c9cff })
      )
      scene.add(curve)

      for (let i = 0; i < Math.min(samples, 150); i++) {
        const val = gaussianRandom(mean, std)
        const geom = new THREE.SphereGeometry(0.06, 8, 8)
        const mat = new THREE.MeshStandardMaterial({ color: 0xff7a45 })
        const mesh = new THREE.Mesh(geom, mat)
        mesh.position.set((val - mean) / std, Math.random() * 0.3, (Math.random() - 0.5) * 2)
        scene.add(mesh)
      }
    } else if (config.scenario === 'histogram') {
      const bins = config.params?.bins || [4, 8, 15, 22, 18, 10, 5]
      const max = Math.max(...bins)
      bins.forEach((v, i) => {
        const h = (v / max) * 5
        const geom = new THREE.BoxGeometry(0.8, h, 0.8)
        const mat = new THREE.MeshStandardMaterial({ color: 0x7c9cff })
        const mesh = new THREE.Mesh(geom, mat)
        mesh.position.set(i * 1.1 - (bins.length - 1) * 0.55, h / 2, 0)
        scene.add(mesh)
      })
    } else {
      // scatter
      for (let i = 0; i < samples; i++) {
        const x = gaussianRandom(0, 3)
        const y = gaussianRandom(0, 2)
        const geom = new THREE.SphereGeometry(0.08, 8, 8)
        const mat = new THREE.MeshStandardMaterial({ color: 0x4ade80 })
        const mesh = new THREE.Mesh(geom, mat)
        mesh.position.set(x, Math.max(y, 0), (Math.random() - 0.5) * 4)
        scene.add(mesh)
      }
    }

    let raf: number
    const animate = () => {
      raf = requestAnimationFrame(animate)
      scene.rotation.y += 0.0015
      renderer.render(scene, camera)
    }
    animate()

    return () => {
      cancelAnimationFrame(raf)
      renderer.dispose()
    }
  }, [config])

  return (
    <div>
      <div ref={mountRef} className="rounded-xl overflow-hidden border border-white/5 bg-synapse/40" />
      <p className="text-xs text-dim font-mono mt-4">
        {config.scenario.replace('_', ' ')} · mean={config.params?.mean ?? 0}, std={config.params?.std ?? 1}
      </p>
    </div>
  )
}
