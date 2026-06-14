import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

interface StateMachineConfig {
  states: { id: string; label: string }[]
  transitions: { from: string; to: string; label?: string }[]
  learning_focus?: string
}

export default function StateMachineSim({ config }: { config: StateMachineConfig }) {
  const mountRef = useRef<HTMLDivElement>(null)
  const [step, setStep] = useState(0)
  const meshesRef = useRef<Record<string, THREE.Mesh>>({})
  const linesRef = useRef<{ line: THREE.Line; from: string; to: string }[]>([])

  const transitions = config.transitions || []

  useEffect(() => {
    if (!mountRef.current) return
    const width = mountRef.current.clientWidth
    const height = 400

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000)
    camera.position.set(0, 0, 14)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(width, height)
    mountRef.current.innerHTML = ''
    mountRef.current.appendChild(renderer.domElement)

    scene.add(new THREE.AmbientLight(0xffffff, 0.9))
    const pl = new THREE.PointLight(0x7c9cff, 1.2)
    pl.position.set(0, 5, 10)
    scene.add(pl)

    const states = config.states || []
    const n = states.length || 1
    const radius = 5
    const positions: Record<string, THREE.Vector3> = {}
    states.forEach((s, i) => {
      const angle = (i / n) * Math.PI * 2 - Math.PI / 2
      positions[s.id] = new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0)
    })

    const lines: { line: THREE.Line; from: string; to: string }[] = []
    transitions.forEach((t) => {
      const a = positions[t.from], b = positions[t.to]
      if (!a || !b) return
      const geom = new THREE.BufferGeometry().setFromPoints([a, b])
      const mat = new THREE.LineBasicMaterial({ color: 0x2a3548 })
      const line = new THREE.Line(geom, mat)
      scene.add(line)
      lines.push({ line, from: t.from, to: t.to })

      // transition label at midpoint
      if (t.label) {
        const mid = a.clone().lerp(b, 0.5)
        const canvas = document.createElement('canvas')
        canvas.width = 200; canvas.height = 48
        const ctx = canvas.getContext('2d')!
        ctx.fillStyle = '#5C6B82'
        ctx.font = '20px monospace'
        ctx.textAlign = 'center'
        ctx.fillText(t.label, 100, 30)
        const tex = new THREE.CanvasTexture(canvas)
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex }))
        sprite.position.copy(mid)
        sprite.scale.set(1.8, 0.45, 1)
        scene.add(sprite)
      }
    })

    const meshes: Record<string, THREE.Mesh> = {}
    states.forEach((s) => {
      const geom = new THREE.SphereGeometry(0.6, 24, 24)
      const mat = new THREE.MeshStandardMaterial({ color: 0x3a4357 })
      const mesh = new THREE.Mesh(geom, mat)
      mesh.position.copy(positions[s.id])
      scene.add(mesh)
      meshes[s.id] = mesh

      const canvas = document.createElement('canvas')
      canvas.width = 220; canvas.height = 56
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#E8ECF4'
      ctx.font = 'bold 26px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(s.label, 110, 36)
      const tex = new THREE.CanvasTexture(canvas)
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex }))
      sprite.position.copy(positions[s.id]).add(new THREE.Vector3(0, 1, 0))
      sprite.scale.set(2.2, 0.55, 1)
      scene.add(sprite)
    })

    meshesRef.current = meshes
    linesRef.current = lines

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

  // highlight active transition + its endpoints
  useEffect(() => {
    const active = transitions[step]
    Object.entries(meshesRef.current).forEach(([id, mesh]) => {
      const isActive = active && (id === active.from || id === active.to)
      ;(mesh.material as THREE.MeshStandardMaterial).color.set(isActive ? 0xff7a45 : 0x3a4357)
    })
    linesRef.current.forEach(({ line, from, to }) => {
      const isActive = active && from === active.from && to === active.to
      const mat = line.material as THREE.LineBasicMaterial
      mat.color.set(isActive ? 0x7c9cff : 0x2a3548)
    })
  }, [step, transitions])

  return (
    <div>
      <div ref={mountRef} className="rounded-xl overflow-hidden border border-white/5 bg-synapse/40" />
      {transitions.length > 0 && (
        <div className="flex items-center gap-3 mt-4">
          <button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}
            className="px-3 py-1.5 rounded-md border border-white/10 text-sm disabled:opacity-30">← Prev</button>
          <button onClick={() => setStep((s) => Math.min(transitions.length - 1, s + 1))} disabled={step >= transitions.length - 1}
            className="px-3 py-1.5 rounded-md border border-white/10 text-sm disabled:opacity-30">Next →</button>
          <span className="text-xs text-dim font-mono ml-2">
            Transition {step + 1}/{transitions.length}: {transitions[step]?.from} → {transitions[step]?.to}
            {transitions[step]?.label ? ` (${transitions[step].label})` : ''}
          </span>
        </div>
      )}
    </div>
  )
}
