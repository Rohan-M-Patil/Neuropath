import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

interface NNConfig {
  layers: { name: string; neurons: number }[]
  activation?: string
  animate_forward_pass?: boolean
}

export default function NeuralNetworkSim({ config }: { config: NNConfig }) {
  const mountRef = useRef<HTMLDivElement>(null)
  const [pulse, setPulse] = useState(0)
  const linesRef = useRef<{ line: THREE.Line; layerIdx: number }[]>([])
  const neuronsRef = useRef<{ mesh: THREE.Mesh; layerIdx: number }[]>([])

  useEffect(() => {
    if (!mountRef.current) return
    const width = mountRef.current.clientWidth
    const height = 400

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000)
    camera.position.set(0, 0, 16)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(width, height)
    mountRef.current.innerHTML = ''
    mountRef.current.appendChild(renderer.domElement)

    scene.add(new THREE.AmbientLight(0xffffff, 0.9))
    const pl = new THREE.PointLight(0x7c9cff, 1.2)
    pl.position.set(0, 5, 10)
    scene.add(pl)

    const layers = config.layers || []
    const layerSpacing = 4
    const totalWidth = (layers.length - 1) * layerSpacing
    const positions: THREE.Vector3[][] = []

    layers.forEach((layer, li) => {
      const x = li * layerSpacing - totalWidth / 2
      const neurons: THREE.Vector3[] = []
      const spacing = 1.2
      const totalHeight = (layer.neurons - 1) * spacing
      for (let i = 0; i < layer.neurons; i++) {
        const y = i * spacing - totalHeight / 2
        neurons.push(new THREE.Vector3(x, y, 0))
      }
      positions.push(neurons)
    })

    const lines: { line: THREE.Line; layerIdx: number }[] = []
    const neuronMeshes: { mesh: THREE.Mesh; layerIdx: number }[] = []

    // connections
    for (let li = 0; li < positions.length - 1; li++) {
      positions[li].forEach((a) => {
        positions[li + 1].forEach((b) => {
          const geom = new THREE.BufferGeometry().setFromPoints([a, b])
          const mat = new THREE.LineBasicMaterial({ color: 0x2a3548, transparent: true, opacity: 0.4 })
          const line = new THREE.Line(geom, mat)
          scene.add(line)
          lines.push({ line, layerIdx: li })
        })
      })
    }

    // neurons
    positions.forEach((layerPos, li) => {
      layerPos.forEach((pos) => {
        const geom = new THREE.SphereGeometry(0.35, 24, 24)
        const mat = new THREE.MeshStandardMaterial({ color: 0x3a4357 })
        const mesh = new THREE.Mesh(geom, mat)
        mesh.position.copy(pos)
        scene.add(mesh)
        neuronMeshes.push({ mesh, layerIdx: li })
      })
    })

    linesRef.current = lines
    neuronsRef.current = neuronMeshes

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

  // forward-pass animation based on pulse step
  useEffect(() => {
    const numLayers = config.layers?.length || 0
    neuronsRef.current.forEach(({ mesh, layerIdx }) => {
      const active = layerIdx === pulse
      ;(mesh.material as THREE.MeshStandardMaterial).color.set(active ? 0xff7a45 : 0x3a4357)
    })
    linesRef.current.forEach(({ line, layerIdx }) => {
      const active = layerIdx === pulse - 1 || (pulse === 0 && layerIdx === 0)
      const mat = line.material as THREE.LineBasicMaterial
      mat.color.set(layerIdx === pulse ? 0x7c9cff : 0x2a3548)
      mat.opacity = layerIdx === pulse ? 0.9 : 0.4
    })
    void numLayers
  }, [pulse, config])

  const numLayers = config.layers?.length || 1

  return (
    <div>
      <div ref={mountRef} className="rounded-xl overflow-hidden border border-white/5 bg-synapse/40" />
      <div className="flex items-center gap-3 mt-4">
        <button
          onClick={() => setPulse((p) => Math.max(0, p - 1))}
          disabled={pulse === 0}
          className="px-3 py-1.5 rounded-md border border-white/10 text-sm disabled:opacity-30"
        >
          ← Prev layer
        </button>
        <button
          onClick={() => setPulse((p) => Math.min(numLayers - 1, p + 1))}
          disabled={pulse >= numLayers - 1}
          className="px-3 py-1.5 rounded-md border border-white/10 text-sm disabled:opacity-30"
        >
          Next layer →
        </button>
        <span className="text-xs text-dim font-mono ml-2">
          Layer {pulse + 1}/{numLayers}: {config.layers?.[pulse]?.name} ({config.activation || 'relu'})
        </span>
      </div>
    </div>
  )
}
