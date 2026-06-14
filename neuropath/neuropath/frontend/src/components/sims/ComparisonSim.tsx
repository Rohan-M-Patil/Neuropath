import { useEffect, useRef } from 'react'
import * as THREE from 'three'

interface ComparisonConfig {
  items: { label: string; value: number; color?: string }[]
  metric_label?: string
  learning_focus?: string
}

const FALLBACK_COLORS = ['#7C9CFF', '#FF7A45', '#4ADE80', '#FFC95C']

export default function ComparisonSim({ config }: { config: ComparisonConfig }) {
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

    const items = config.items || []
    const max = Math.max(...items.map((i) => i.value), 1)
    const spacing = 2.2
    const totalWidth = (items.length - 1) * spacing

    items.forEach((item, i) => {
      const h = Math.max((item.value / max) * 6, 0.2)
      const colorHex = (item.color || FALLBACK_COLORS[i % FALLBACK_COLORS.length]).replace('#', '0x')
      const color = parseInt(colorHex, 16)

      const geom = new THREE.BoxGeometry(1.2, h, 1.2)
      const mat = new THREE.MeshStandardMaterial({ color })
      const mesh = new THREE.Mesh(geom, mat)
      mesh.position.set(i * spacing - totalWidth / 2, h / 2, 0)
      scene.add(mesh)

      // value label above bar
      const valCanvas = document.createElement('canvas')
      valCanvas.width = 128; valCanvas.height = 48
      const vctx = valCanvas.getContext('2d')!
      vctx.fillStyle = '#E8ECF4'
      vctx.font = 'bold 28px monospace'
      vctx.textAlign = 'center'
      vctx.fillText(String(item.value), 64, 32)
      const valTex = new THREE.CanvasTexture(valCanvas)
      const valSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: valTex }))
      valSprite.position.set(i * spacing - totalWidth / 2, h + 1, 0)
      valSprite.scale.set(1.6, 0.6, 1)
      scene.add(valSprite)

      // label below bar
      const labelCanvas = document.createElement('canvas')
      labelCanvas.width = 256; labelCanvas.height = 48
      const lctx = labelCanvas.getContext('2d')!
      lctx.fillStyle = '#E8ECF4'
      lctx.font = 'bold 26px sans-serif'
      lctx.textAlign = 'center'
      lctx.fillText(item.label, 128, 32)
      const labelTex = new THREE.CanvasTexture(labelCanvas)
      const labelSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex }))
      labelSprite.position.set(i * spacing - totalWidth / 2, -0.8, 0)
      labelSprite.scale.set(2.4, 0.5, 1)
      scene.add(labelSprite)
    })

    let raf: number
    const animate = () => {
      raf = requestAnimationFrame(animate)
      scene.rotation.y = Math.sin(Date.now() * 0.0003) * 0.15
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
        Comparing {config.items?.map((i) => i.label).join(' vs ')}
        {config.metric_label ? ` · ${config.metric_label}` : ''}
      </p>
    </div>
  )
}
