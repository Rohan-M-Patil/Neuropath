import { useEffect, useRef } from 'react'
import * as THREE from 'three'

interface GenericConfig {
  scene: 'orbit' | 'particle_system' | 'wave_interference' | 'force_field'
  params?: { color?: string; intensity?: number; count?: number }
}

export default function GenericSim({ config }: { config: GenericConfig }) {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!mountRef.current) return
    const width = mountRef.current.clientWidth
    const height = 400

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000)
    camera.position.set(0, 3, 14)
    camera.lookAt(0, 0, 0)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(width, height)
    mountRef.current.innerHTML = ''
    mountRef.current.appendChild(renderer.domElement)

    scene.add(new THREE.AmbientLight(0xffffff, 0.9))
    const colorHex = (config.params?.color || '#7C9CFF').replace('#', '0x')
    const color = parseInt(colorHex, 16)
    const pl = new THREE.PointLight(color, config.params?.intensity ?? 1.0)
    pl.position.set(5, 8, 10)
    scene.add(pl)

    const count = config.params?.count ?? 60
    const objects: THREE.Object3D[] = []

    if (config.scene === 'orbit') {
      const center = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 32), new THREE.MeshStandardMaterial({ color }))
      scene.add(center)
      for (let i = 0; i < Math.min(count, 6); i++) {
        const r = 2.5 + i * 1.2
        const orbiter = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 16), new THREE.MeshStandardMaterial({ color: 0xff7a45 }))
        orbiter.userData = { r, speed: 0.4 / (i + 1), angle: Math.random() * Math.PI * 2 }
        scene.add(orbiter)
        objects.push(orbiter)

        const ringGeom = new THREE.RingGeometry(r - 0.01, r + 0.01, 64)
        const ringMat = new THREE.MeshBasicMaterial({ color: 0x2a3548, side: THREE.DoubleSide })
        const ring = new THREE.Mesh(ringGeom, ringMat)
        ring.rotation.x = Math.PI / 2
        scene.add(ring)
      }
    } else if (config.scene === 'particle_system') {
      const positions = new Float32Array(count * 3)
      for (let i = 0; i < count; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 12
        positions[i * 3 + 1] = (Math.random() - 0.5) * 8
        positions[i * 3 + 2] = (Math.random() - 0.5) * 8
      }
      const geom = new THREE.BufferGeometry()
      geom.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      const mat = new THREE.PointsMaterial({ color, size: 0.15 })
      const points = new THREE.Points(geom, mat)
      scene.add(points)
      objects.push(points)
    } else if (config.scene === 'wave_interference') {
      const geom = new THREE.PlaneGeometry(12, 8, 60, 40)
      const mat = new THREE.MeshStandardMaterial({ color, wireframe: true })
      const plane = new THREE.Mesh(geom, mat)
      plane.rotation.x = -Math.PI / 3
      scene.add(plane)
      objects.push(plane)
    } else {
      // force field: grid of arrows
      for (let x = -4; x <= 4; x += 2) {
        for (let z = -4; z <= 4; z += 2) {
          const dir = new THREE.Vector3(x, 0, z).normalize()
          const arrow = new THREE.ArrowHelper(dir.length() ? dir : new THREE.Vector3(1,0,0), new THREE.Vector3(x, 0, z), 0.8, color)
          scene.add(arrow)
        }
      }
    }

    let raf: number
    let t = 0
    const animate = () => {
      raf = requestAnimationFrame(animate)
      t += 0.02
      if (config.scene === 'orbit') {
        objects.forEach((o) => {
          const { r, speed, angle } = o.userData
          o.position.set(Math.cos(angle + t * speed) * r, 0, Math.sin(angle + t * speed) * r)
        })
      } else if (config.scene === 'particle_system') {
        scene.rotation.y += 0.002
      } else if (config.scene === 'wave_interference') {
        const plane = objects[0] as THREE.Mesh
        const pos = (plane.geometry as THREE.PlaneGeometry).attributes.position
        for (let i = 0; i < pos.count; i++) {
          const x = pos.getX(i), y = pos.getY(i)
          pos.setZ(i, Math.sin(x * 0.8 + t) * 0.4 + Math.cos(y * 0.8 + t * 0.7) * 0.4)
        }
        pos.needsUpdate = true
      } else {
        scene.rotation.y += 0.0015
      }
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
      <p className="text-xs text-dim font-mono mt-4">{config.scene.replace('_', ' ')}</p>
    </div>
  )
}
