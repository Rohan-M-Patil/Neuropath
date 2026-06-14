import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

interface SysConfig {
  type: string
  nodes: { id: string; label: string; type?: string }[]
  connections: { from: string; to: string; label?: string }[]
}

const TYPE_COLOR: Record<string, number> = {
  service: 0x7c9cff, database: 0xff7a45, queue: 0x4ade80, gateway: 0xffc95c, default: 0x7c9cff,
}

export default function SystemArchitectureSim({ config }: { config: SysConfig }) {
  const mountRef = useRef<HTMLDivElement>(null)
  const [highlight, setHighlight] = useState(0)
  const meshesRef = useRef<Record<string, THREE.Mesh>>({})
  const linesRef = useRef<{ line: THREE.Line; from: string; to: string }[]>([])

  useEffect(() => {
    if (!mountRef.current) return
    const width = mountRef.current.clientWidth
    const height = 400

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000)
    camera.position.set(0, 6, 14)
    camera.lookAt(0, 0, 0)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(width, height)
    mountRef.current.innerHTML = ''
    mountRef.current.appendChild(renderer.domElement)

    scene.add(new THREE.AmbientLight(0xffffff, 0.9))
    const pl = new THREE.PointLight(0x7c9cff, 1.2)
    pl.position.set(0, 10, 10)
    scene.add(pl)

    const nodes = config.nodes || []
    const n = nodes.length
    const radius = 5
    const positions: Record<string, THREE.Vector3> = {}
    nodes.forEach((node, i) => {
      const angle = (i / n) * Math.PI * 2
      positions[node.id] = new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius)
    })

    // connections
    const lines: { line: THREE.Line; from: string; to: string }[] = [];
    (config.connections || []).forEach((c) => {
      const a = positions[c.from], b = positions[c.to]
      if (!a || !b) return
      const geom = new THREE.BufferGeometry().setFromPoints([a, b])
      const mat = new THREE.LineBasicMaterial({ color: 0x2a3548 })
      const line = new THREE.Line(geom, mat)
      scene.add(line)
      lines.push({ line, from: c.from, to: c.to })
    })

    // nodes
    const meshes: Record<string, THREE.Mesh> = {}
    nodes.forEach((node) => {
      const color = TYPE_COLOR[node.type || 'default'] ?? TYPE_COLOR.default
      const geom = new THREE.BoxGeometry(1.4, 1.4, 1.4)
      const mat = new THREE.MeshStandardMaterial({ color })
      const mesh = new THREE.Mesh(geom, mat)
      mesh.position.copy(positions[node.id])
      scene.add(mesh)
      meshes[node.id] = mesh

      const canvas = document.createElement('canvas')
      canvas.width = 256; canvas.height = 64
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#E8ECF4'
      ctx.font = 'bold 28px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(node.label, 128, 40)
      const texture = new THREE.CanvasTexture(canvas)
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture }))
      sprite.position.copy(positions[node.id]).add(new THREE.Vector3(0, 1.3, 0))
      sprite.scale.set(2.5, 0.6, 1)
      scene.add(sprite)
    })

    meshesRef.current = meshes
    linesRef.current = lines

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

  // highlight active connection
  useEffect(() => {
    const conns = config.connections || []
    const active = conns[highlight]
    Object.entries(meshesRef.current).forEach(([id, mesh]) => {
      const isActive = active && (id === active.from || id === active.to)
      const node = config.nodes.find((n) => n.id === id)
      const baseColor = TYPE_COLOR[node?.type || 'default'] ?? TYPE_COLOR.default
      ;(mesh.material as THREE.MeshStandardMaterial).color.set(isActive ? 0xffffff : baseColor)
    })
    linesRef.current.forEach(({ line, from, to }) => {
      const isActive = active && from === active.from && to === active.to
      const mat = line.material as THREE.LineBasicMaterial
      mat.color.set(isActive ? 0xff7a45 : 0x2a3548)
    })
  }, [highlight, config])

  const conns = config.connections || []

  return (
    <div>
      <div ref={mountRef} className="rounded-xl overflow-hidden border border-white/5 bg-synapse/40" />
      {conns.length > 0 && (
        <div className="flex items-center gap-3 mt-4">
          <button onClick={() => setHighlight((h) => Math.max(0, h - 1))} disabled={highlight === 0}
            className="px-3 py-1.5 rounded-md border border-white/10 text-sm disabled:opacity-30">← Prev</button>
          <button onClick={() => setHighlight((h) => Math.min(conns.length - 1, h + 1))} disabled={highlight >= conns.length - 1}
            className="px-3 py-1.5 rounded-md border border-white/10 text-sm disabled:opacity-30">Next →</button>
          <span className="text-xs text-dim font-mono ml-2">
            {conns[highlight]?.from} → {conns[highlight]?.to} {conns[highlight]?.label ? `(${conns[highlight].label})` : ''}
          </span>
        </div>
      )}
    </div>
  )
}
