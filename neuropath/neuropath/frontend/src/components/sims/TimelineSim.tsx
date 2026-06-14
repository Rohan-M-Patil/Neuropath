import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

interface TimelineConfig {
  steps: { label: string; detail?: string }[]
  loop?: boolean
  learning_focus?: string
}

export default function TimelineSim({ config }: { config: TimelineConfig }) {
  const mountRef = useRef<HTMLDivElement>(null)
  const [step, setStep] = useState(0)
  const nodesRef = useRef<THREE.Mesh[]>([])
  const playRef = useRef(false)

  const steps = config.steps || []

  useEffect(() => {
    if (!mountRef.current) return
    const width = mountRef.current.clientWidth
    const height = 400

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000)
    camera.position.set(0, 4, 14)
    camera.lookAt(0, 0, 0)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(width, height)
    mountRef.current.innerHTML = ''
    mountRef.current.appendChild(renderer.domElement)

    scene.add(new THREE.AmbientLight(0xffffff, 0.9))
    const pl = new THREE.PointLight(0x7c9cff, 1.2)
    pl.position.set(0, 8, 10)
    scene.add(pl)

    const n = steps.length || 1
    const spacing = 2.6
    const totalWidth = (n - 1) * spacing
    const positions: THREE.Vector3[] = []

    for (let i = 0; i < n; i++) {
      positions.push(new THREE.Vector3(i * spacing - totalWidth / 2, 0, 0))
    }

    // connecting line
    if (positions.length > 1) {
      const lineGeom = new THREE.BufferGeometry().setFromPoints(positions)
      scene.add(new THREE.Line(lineGeom, new THREE.LineBasicMaterial({ color: 0x2a3548 })))
    }

    const nodeMeshes: THREE.Mesh[] = []
    steps.forEach((s, i) => {
      const geom = new THREE.SphereGeometry(0.5, 24, 24)
      const mat = new THREE.MeshStandardMaterial({ color: 0x3a4357 })
      const mesh = new THREE.Mesh(geom, mat)
      mesh.position.copy(positions[i])
      scene.add(mesh)
      nodeMeshes.push(mesh)

      const canvas = document.createElement('canvas')
      canvas.width = 256; canvas.height = 64
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#E8ECF4'
      ctx.font = 'bold 24px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(`${i + 1}. ${s.label}`, 128, 36)
      const tex = new THREE.CanvasTexture(canvas)
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex }))
      sprite.position.copy(positions[i]).add(new THREE.Vector3(0, 1.1, 0))
      sprite.scale.set(2.6, 0.65, 1)
      scene.add(sprite)

      const stepNum = document.createElement('canvas')
      stepNum.width = 64; stepNum.height = 64
      const sctx = stepNum.getContext('2d')!
      sctx.fillStyle = '#0A0E14'
      sctx.font = 'bold 32px monospace'
      sctx.textAlign = 'center'
      sctx.textBaseline = 'middle'
      sctx.fillText(String(i + 1), 32, 32)
      const stepTex = new THREE.CanvasTexture(stepNum)
      const stepSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: stepTex }))
      stepSprite.position.copy(positions[i])
      stepSprite.scale.set(0.6, 0.6, 1)
      scene.add(stepSprite)
    })

    nodesRef.current = nodeMeshes

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

  // highlight active step
  useEffect(() => {
    nodesRef.current.forEach((mesh, i) => {
      ;(mesh.material as THREE.MeshStandardMaterial).color.set(
        i === step ? 0xff7a45 : i < step ? 0x4ade80 : 0x3a4357
      )
    })
  }, [step])

  // auto-play
  useEffect(() => {
    if (!playRef.current) return
    const interval = setInterval(() => {
      setStep((s) => {
        const next = s + 1
        if (next >= steps.length) {
          if (config.loop) return 0
          playRef.current = false
          return s
        }
        return next
      })
    }, 1500)
    return () => clearInterval(interval)
  }, [playRef.current, steps.length, config.loop])

  const [, forceRerender] = useState(0)
  function togglePlay() {
    playRef.current = !playRef.current
    forceRerender((x) => x + 1)
  }

  return (
    <div>
      <div ref={mountRef} className="rounded-xl overflow-hidden border border-white/5 bg-synapse/40" />
      <div className="flex items-center gap-3 mt-4">
        <button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}
          className="px-3 py-1.5 rounded-md border border-white/10 text-sm disabled:opacity-30">← Prev</button>
        <button onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))} disabled={step >= steps.length - 1}
          className="px-3 py-1.5 rounded-md border border-white/10 text-sm disabled:opacity-30">Next →</button>
        <button onClick={togglePlay}
          className="px-3 py-1.5 rounded-md border border-white/10 text-sm">
          {playRef.current ? 'Pause' : 'Play'}
        </button>
        <span className="text-xs text-dim font-mono ml-2">
          Step {step + 1}/{steps.length}
        </span>
      </div>
      {steps[step]?.detail && (
        <p className="text-sm text-dim mt-2">{steps[step].detail}</p>
      )}
    </div>
  )
}
