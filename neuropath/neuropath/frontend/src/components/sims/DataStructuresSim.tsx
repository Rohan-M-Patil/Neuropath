import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

interface DSConfig {
  structure: 'stack' | 'queue' | 'binary_tree' | 'linked_list' | 'hash_table'
  operations?: { op: string; value: number }[]
  initial_values?: number[]
}

function buildSteps(config: DSConfig): number[][] {
  const initial = config.initial_values || []
  const steps: number[][] = [[...initial]]
  let cur = [...initial]

  ;(config.operations || []).forEach((o) => {
    if (o.op === 'push' || o.op === 'enqueue' || o.op === 'insert') {
      cur = [...cur, o.value]
    } else if (o.op === 'pop') {
      cur = cur.slice(0, -1)
    } else if (o.op === 'dequeue') {
      cur = cur.slice(1)
    }
    steps.push([...cur])
  })
  return steps
}

export default function DataStructuresSim({ config }: { config: DSConfig }) {
  const mountRef = useRef<HTMLDivElement>(null)
  const [step, setStep] = useState(0)
  const groupRef = useRef<THREE.Group | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)

  const steps = buildSteps(config)

  useEffect(() => {
    if (!mountRef.current) return
    const width = mountRef.current.clientWidth
    const height = 400

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000)
    camera.position.set(0, 2, 14)
    camera.lookAt(0, 0, 0)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(width, height)
    mountRef.current.innerHTML = ''
    mountRef.current.appendChild(renderer.domElement)

    scene.add(new THREE.AmbientLight(0xffffff, 0.9))
    const pl = new THREE.PointLight(0x7c9cff, 1.2)
    pl.position.set(0, 8, 10)
    scene.add(pl)

    sceneRef.current = scene
    rendererRef.current = renderer
    cameraRef.current = camera

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

  // rebuild visualization when step changes
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return
    if (groupRef.current) scene.remove(groupRef.current)

    const group = new THREE.Group()
    const values = steps[step] || []
    const structure = config.structure

    if (structure === 'binary_tree') {
      // simple complete binary tree layout
      values.forEach((val, i) => {
        const depth = Math.floor(Math.log2(i + 1))
        const indexInLevel = i - (Math.pow(2, depth) - 1)
        const levelWidth = Math.pow(2, depth)
        const x = (indexInLevel - (levelWidth - 1) / 2) * (8 / levelWidth)
        const y = 4 - depth * 2.2
        const geom = new THREE.SphereGeometry(0.4, 24, 24)
        const mat = new THREE.MeshStandardMaterial({ color: 0x7c9cff })
        const mesh = new THREE.Mesh(geom, mat)
        mesh.position.set(x, y, 0)
        group.add(mesh)

        if (i > 0) {
          const parentIdx = Math.floor((i - 1) / 2)
          const pDepth = Math.floor(Math.log2(parentIdx + 1))
          const pIndexInLevel = parentIdx - (Math.pow(2, pDepth) - 1)
          const pLevelWidth = Math.pow(2, pDepth)
          const px = (pIndexInLevel - (pLevelWidth - 1) / 2) * (8 / pLevelWidth)
          const py = 4 - pDepth * 2.2
          const lineGeom = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(px, py, 0), new THREE.Vector3(x, y, 0),
          ])
          group.add(new THREE.Line(lineGeom, new THREE.LineBasicMaterial({ color: 0x2a3548 })))
        }

        addLabel(group, val.toString(), x, y, 0)
      })
    } else if (structure === 'linked_list') {
      values.forEach((val, i) => {
        const x = i * 2.2 - (values.length - 1) * 1.1
        const geom = new THREE.BoxGeometry(1.4, 1, 1)
        const mat = new THREE.MeshStandardMaterial({ color: 0x7c9cff })
        const mesh = new THREE.Mesh(geom, mat)
        mesh.position.set(x, 0, 0)
        group.add(mesh)
        addLabel(group, val.toString(), x, 0, 0.6)

        if (i < values.length - 1) {
          const arrowGeom = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(x + 0.7, 0, 0), new THREE.Vector3(x + 1.5, 0, 0),
          ])
          group.add(new THREE.Line(arrowGeom, new THREE.LineBasicMaterial({ color: 0xff7a45 })))
        }
      })
    } else if (structure === 'hash_table') {
      const buckets = 6
      for (let b = 0; b < buckets; b++) {
        const x = b * 1.8 - (buckets - 1) * 0.9
        const geom = new THREE.BoxGeometry(1.4, 0.6, 0.6)
        const mat = new THREE.MeshStandardMaterial({ color: 0x2a3548 })
        const mesh = new THREE.Mesh(geom, mat)
        mesh.position.set(x, 2, 0)
        group.add(mesh)
        addLabel(group, `[${b}]`, x, 2, 0.4)
      }
      values.forEach((val, i) => {
        const bucket = val % buckets
        const x = bucket * 1.8 - (buckets - 1) * 0.9
        const stackIdx = values.slice(0, i).filter((v) => v % buckets === bucket).length
        const y = 1 - stackIdx * 1.0
        const geom = new THREE.SphereGeometry(0.35, 24, 24)
        const mat = new THREE.MeshStandardMaterial({ color: 0xff7a45 })
        const mesh = new THREE.Mesh(geom, mat)
        mesh.position.set(x, y, 0)
        group.add(mesh)
        addLabel(group, val.toString(), x, y, 0.4)
      })
    } else {
      // stack or queue: vertical/horizontal boxes
      const isStack = structure === 'stack'
      values.forEach((val, i) => {
        const geom = new THREE.BoxGeometry(2, 0.8, 0.8)
        const mat = new THREE.MeshStandardMaterial({ color: i === values.length - 1 ? 0xff7a45 : 0x7c9cff })
        const mesh = new THREE.Mesh(geom, mat)
        if (isStack) mesh.position.set(0, i * 1.0 - 2, 0)
        else mesh.position.set(i * 2.2 - (values.length - 1) * 1.1, 0, 0)
        group.add(mesh)
        addLabel(group, val.toString(), isStack ? 0 : i * 2.2 - (values.length - 1) * 1.1, isStack ? i * 1.0 - 2 : 0, 0.5)
      })
    }

    scene.add(group)
    groupRef.current = group
  }, [step, config])

  function addLabel(group: THREE.Group, text: string, x: number, y: number, z: number) {
    const canvas = document.createElement('canvas')
    canvas.width = 64; canvas.height = 64
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#E8ECF4'
    ctx.font = 'bold 32px monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, 32, 32)
    const texture = new THREE.CanvasTexture(canvas)
    const mat = new THREE.SpriteMaterial({ map: texture })
    const sprite = new THREE.Sprite(mat)
    sprite.position.set(x, y, z + 0.3)
    sprite.scale.set(0.8, 0.8, 1)
    group.add(sprite)
  }

  return (
    <div>
      <div ref={mountRef} className="rounded-xl overflow-hidden border border-white/5 bg-synapse/40" />
      <div className="flex items-center gap-3 mt-4">
        <button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}
          className="px-3 py-1.5 rounded-md border border-white/10 text-sm disabled:opacity-30">← Prev</button>
        <button onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))} disabled={step >= steps.length - 1}
          className="px-3 py-1.5 rounded-md border border-white/10 text-sm disabled:opacity-30">Next →</button>
        <span className="text-xs text-dim font-mono ml-2">
          Step {step + 1}/{steps.length} · {config.structure.replace('_', ' ')}
          {step > 0 && config.operations?.[step - 1] && ` · ${config.operations[step - 1].op}(${config.operations[step - 1].value})`}
        </span>
      </div>
    </div>
  )
}
