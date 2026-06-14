import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

interface GraphConfig {
  algorithm: 'bfs' | 'dfs' | 'dijkstra'
  graph: { nodes: { id: string }[]; edges: { source: string; target: string; weight?: number }[] }
  start_node: string
}

export default function GraphAlgorithmSim({ config }: { config: GraphConfig }) {
  const mountRef = useRef<HTMLDivElement>(null)
  const [step, setStep] = useState(0)
  const [order, setOrder] = useState<string[]>([])
  const sceneRef = useRef<{
    scene: THREE.Scene
    nodeObjs: Record<string, THREE.Mesh>
  } | null>(null)

  // compute traversal order
  useEffect(() => {
    const { graph, algorithm, start_node } = config
    const adj: Record<string, string[]> = {}
    graph.nodes.forEach((n) => (adj[n.id] = []))
    graph.edges.forEach((e) => {
      adj[e.source]?.push(e.target)
      adj[e.target]?.push(e.source)
    })

    const visited = new Set<string>()
    const result: string[] = []

    if (algorithm === 'dfs') {
      const stack = [start_node]
      while (stack.length) {
        const n = stack.pop()!
        if (visited.has(n)) continue
        visited.add(n)
        result.push(n)
        stack.push(...adj[n].filter((x) => !visited.has(x)).reverse())
      }
    } else {
      // bfs + dijkstra both shown as BFS-order for visualization simplicity
      const queue = [start_node]
      while (queue.length) {
        const n = queue.shift()!
        if (visited.has(n)) continue
        visited.add(n)
        result.push(n)
        queue.push(...adj[n].filter((x) => !visited.has(x)))
      }
    }
    setOrder(result)
    setStep(0)
  }, [config])

  // setup three.js scene once
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

    const { graph } = config
    const n = graph.nodes.length
    const radius = 5
    const positions: Record<string, THREE.Vector3> = {}
    graph.nodes.forEach((node, i) => {
      const angle = (i / n) * Math.PI * 2
      positions[node.id] = new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0)
    })

    // edges
    graph.edges.forEach((e) => {
      const a = positions[e.source]
      const b = positions[e.target]
      if (!a || !b) return
      const geom = new THREE.BufferGeometry().setFromPoints([a, b])
      const mat = new THREE.LineBasicMaterial({ color: 0x2a3548 })
      scene.add(new THREE.Line(geom, mat))
    })

    // nodes
    const nodeObjs: Record<string, THREE.Mesh> = {}
    graph.nodes.forEach((node) => {
      const geom = new THREE.SphereGeometry(0.45, 24, 24)
      const mat = new THREE.MeshStandardMaterial({ color: 0x3a4357 })
      const mesh = new THREE.Mesh(geom, mat)
      mesh.position.copy(positions[node.id])
      scene.add(mesh)
      nodeObjs[node.id] = mesh
    })

    scene.add(new THREE.AmbientLight(0xffffff, 0.8))
    const pl = new THREE.PointLight(0x7c9cff, 1.2)
    pl.position.set(5, 5, 10)
    scene.add(pl)

    sceneRef.current = { scene, nodeObjs }

    let raf: number
    const animate = () => {
      raf = requestAnimationFrame(animate)
      scene.rotation.y += 0.002
      renderer.render(scene, camera)
    }
    animate()

    return () => {
      cancelAnimationFrame(raf)
      renderer.dispose()
    }
  }, [config])

  // recolor visited nodes as step advances
  useEffect(() => {
    if (!sceneRef.current) return
    const { nodeObjs } = sceneRef.current
    Object.values(nodeObjs).forEach((m) => {
      ;(m.material as THREE.MeshStandardMaterial).color.set(0x3a4357)
    })
    order.slice(0, step + 1).forEach((id, i) => {
      const mesh = nodeObjs[id]
      if (!mesh) return
      const isCurrent = i === step
      ;(mesh.material as THREE.MeshStandardMaterial).color.set(isCurrent ? 0xff7a45 : 0x7c9cff)
    })
  }, [step, order])

  return (
    <div>
      <div ref={mountRef} className="rounded-xl overflow-hidden border border-white/5 bg-synapse/40" />
      <div className="flex items-center gap-3 mt-4">
        <button
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="px-3 py-1.5 rounded-md border border-white/10 text-sm disabled:opacity-30"
        >
          ← Prev
        </button>
        <button
          onClick={() => setStep((s) => Math.min(order.length - 1, s + 1))}
          disabled={step >= order.length - 1}
          className="px-3 py-1.5 rounded-md border border-white/10 text-sm disabled:opacity-30"
        >
          Next →
        </button>
        <span className="text-xs text-dim font-mono ml-2">
          Step {step + 1}/{order.length} · visiting <span className="text-ember">{order[step]}</span>
        </span>
      </div>
    </div>
  )
}
