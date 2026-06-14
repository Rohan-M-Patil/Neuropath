import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

interface SortConfig {
  algorithm: 'bubble' | 'merge' | 'quick'
  array: number[]
}

type Frame = { array: number[]; highlight: number[] }

function bubbleSortFrames(arr: number[]): Frame[] {
  const a = [...arr]
  const frames: Frame[] = [{ array: [...a], highlight: [] }]
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < a.length - i - 1; j++) {
      frames.push({ array: [...a], highlight: [j, j + 1] })
      if (a[j] > a[j + 1]) {
        [a[j], a[j + 1]] = [a[j + 1], a[j]]
        frames.push({ array: [...a], highlight: [j, j + 1] })
      }
    }
  }
  frames.push({ array: [...a], highlight: [] })
  return frames
}

function quickSortFrames(arr: number[]): Frame[] {
  const a = [...arr]
  const frames: Frame[] = [{ array: [...a], highlight: [] }]
  function qs(lo: number, hi: number) {
    if (lo >= hi) return
    const pivot = a[hi]
    let i = lo
    for (let j = lo; j < hi; j++) {
      frames.push({ array: [...a], highlight: [j, hi] })
      if (a[j] < pivot) {
        [a[i], a[j]] = [a[j], a[i]]
        frames.push({ array: [...a], highlight: [i, j] })
        i++
      }
    }
    [a[i], a[hi]] = [a[hi], a[i]]
    frames.push({ array: [...a], highlight: [i, hi] })
    qs(lo, i - 1)
    qs(i + 1, hi)
  }
  qs(0, a.length - 1)
  frames.push({ array: [...a], highlight: [] })
  return frames
}

function mergeSortFrames(arr: number[]): Frame[] {
  // simplified visualization: shows array state after each merge pass
  const frames: Frame[] = [{ array: [...arr], highlight: [] }]
  let width = 1
  let a = [...arr]
  while (width < a.length) {
    const result: number[] = []
    for (let i = 0; i < a.length; i += width * 2) {
      const left = a.slice(i, i + width)
      const right = a.slice(i + width, i + width * 2)
      let li = 0, ri = 0
      while (li < left.length && ri < right.length) {
        result.push(left[li] <= right[ri] ? left[li++] : right[ri++])
      }
      result.push(...left.slice(li), ...right.slice(ri))
    }
    a = result
    frames.push({ array: [...a], highlight: [] })
    width *= 2
  }
  return frames
}

function getFrames(config: SortConfig): Frame[] {
  if (config.algorithm === 'bubble') return bubbleSortFrames(config.array)
  if (config.algorithm === 'quick') return quickSortFrames(config.array)
  return mergeSortFrames(config.array)
}

export default function SortingSim({ config }: { config: SortConfig }) {
  const mountRef = useRef<HTMLDivElement>(null)
  const [step, setStep] = useState(0)
  const framesRef = useRef<Frame[]>([])
  const barsRef = useRef<THREE.Mesh[]>([])
  const sceneRef = useRef<THREE.Scene | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)

  useEffect(() => {
    framesRef.current = getFrames(config)
    setStep(0)
  }, [config])

  useEffect(() => {
    if (!mountRef.current) return
    const width = mountRef.current.clientWidth
    const height = 380

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000)
    camera.position.set(0, 4, 14)
    camera.lookAt(0, 2, 0)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(width, height)
    mountRef.current.innerHTML = ''
    mountRef.current.appendChild(renderer.domElement)

    const { array } = config
    const n = array.length
    const max = Math.max(...array)
    const spacing = 1.0
    const totalWidth = (n - 1) * spacing
    const bars: THREE.Mesh[] = []

    array.forEach((val, i) => {
      const h = (val / max) * 6
      const geom = new THREE.BoxGeometry(0.7, h, 0.7)
      const mat = new THREE.MeshStandardMaterial({ color: 0x7c9cff })
      const mesh = new THREE.Mesh(geom, mat)
      mesh.position.set(i * spacing - totalWidth / 2, h / 2, 0)
      scene.add(mesh)
      bars.push(mesh)
    })

    scene.add(new THREE.AmbientLight(0xffffff, 0.9))
    const pl = new THREE.PointLight(0xff7a45, 1.2)
    pl.position.set(0, 8, 10)
    scene.add(pl)

    sceneRef.current = scene
    rendererRef.current = renderer
    cameraRef.current = camera
    barsRef.current = bars

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

  // update bar heights & highlight on step change
  useEffect(() => {
    const frame = framesRef.current[step]
    if (!frame || !sceneRef.current) return
    const max = Math.max(...config.array)
    barsRef.current.forEach((bar, i) => {
      const val = frame.array[i]
      const h = (val / max) * 6
      bar.scale.y = h / (bar.geometry as THREE.BoxGeometry).parameters.height
      bar.position.y = h / 2
      const mat = bar.material as THREE.MeshStandardMaterial
      mat.color.set(frame.highlight.includes(i) ? 0xff7a45 : 0x7c9cff)
    })
  }, [step, config])

  const frames = framesRef.current
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
          onClick={() => setStep((s) => Math.min(frames.length - 1, s + 1))}
          disabled={step >= frames.length - 1}
          className="px-3 py-1.5 rounded-md border border-white/10 text-sm disabled:opacity-30"
        >
          Next →
        </button>
        <span className="text-xs text-dim font-mono ml-2">
          Step {step + 1}/{frames.length} · {config.algorithm} sort
        </span>
      </div>
    </div>
  )
}
