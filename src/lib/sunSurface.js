import * as THREE from 'three'
import { mulberry32 } from './planet'

/**
 * The Sun's photosphere as a painted sphere map: granulation cells, dark plasma
 * patches, filaments and sunspots. The reference look is a *dirty* Sun — deep
 * brown-orange mottling under a molten gold surface — not a smooth glowing ball.
 *
 * Illustrative only: this is an artist's surface, not solar imagery, and it is
 * drawn in one deterministic pass so the scene looks the same on every load.
 */
export function createSunSurfaceTexture() {
  const W = 1024
  const H = 512
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  const rand = mulberry32(19690)

  // Molten base, warm gold in the middle latitudes and darker at the limb.
  const base = ctx.createLinearGradient(0, 0, 0, H)
  base.addColorStop(0, '#c46a17')
  base.addColorStop(0.28, '#ef9226')
  base.addColorStop(0.5, '#ffab35')
  base.addColorStop(0.72, '#ef9226')
  base.addColorStop(1, '#c46a17')
  ctx.fillStyle = base
  ctx.fillRect(0, 0, W, H)

  // Broad molten patches — the "dirty" patches of cooler and hotter plasma.
  for (let i = 0; i < 150; i += 1) {
    const x = rand() * W
    const y = rand() * H
    const r = 24 + rand() * 150
    const cool = rand() < 0.48
    const tone = cool ? '122,58,16' : '255,204,104'
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r)
    grad.addColorStop(0, `rgba(${tone},${0.14 + rand() * 0.26})`)
    grad.addColorStop(0.55, `rgba(${tone},${0.05 + rand() * 0.08})`)
    grad.addColorStop(1, `rgba(${tone},0)`)
    ctx.fillStyle = grad
    for (const offset of [-W, 0, W]) {
      if (x + offset + r < 0 || x + offset - r > W) continue
      ctx.fillRect(x + offset - r, y - r, r * 2, r * 2)
    }
  }

  // Granulation: thousands of small convection cells.
  for (let i = 0; i < 7000; i += 1) {
    const x = rand() * W
    const y = rand() * H
    const r = 1.2 + rand() * 4.6
    const hot = rand() < 0.58
    ctx.fillStyle = hot
      ? `rgba(255,${210 + Math.floor(rand() * 40)},${120 + Math.floor(rand() * 70)},${0.2 + rand() * 0.45})`
      : `rgba(${96 + Math.floor(rand() * 50)},${44 + Math.floor(rand() * 26)},14,${0.16 + rand() * 0.34})`
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }

  // Plasma filaments: thin bright strands snaking across the surface.
  ctx.lineCap = 'round'
  for (let i = 0; i < 220; i += 1) {
    const x = rand() * W
    const y = rand() * H
    const length = 10 + rand() * 70
    const tone = rand() < 0.6 ? '255,238,182' : '120,52,10'
    ctx.strokeStyle = `rgba(${tone},${0.15 + rand() * 0.4})`
    ctx.lineWidth = 0.7 + rand() * 2.2
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.quadraticCurveTo(
      x + length * 0.5,
      y + (rand() - 0.5) * 26,
      x + length,
      y + (rand() - 0.5) * 34,
    )
    ctx.stroke()
  }

  // Sunspots: dark umbra inside a softer penumbra.
  for (let i = 0; i < 26; i += 1) {
    const x = rand() * W
    const y = 60 + rand() * (H - 120)
    const r = 3 + rand() * 13
    const penumbra = ctx.createRadialGradient(x, y, r * 0.35, x, y, r * 1.9)
    penumbra.addColorStop(0, 'rgba(92,40,10,0.95)')
    penumbra.addColorStop(0.6, 'rgba(120,58,16,0.45)')
    penumbra.addColorStop(1, 'rgba(120,58,16,0)')
    ctx.fillStyle = penumbra
    ctx.beginPath()
    ctx.arc(x, y, r * 1.9, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = 'rgba(38,15,4,0.92)'
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()

    // A grain of plasma still glows inside the darkest spot.
    ctx.fillStyle = `rgba(190,96,24,${0.2 + rand() * 0.25})`
    ctx.beginPath()
    ctx.arc(x + r * 0.2, y + r * 0.15, r * 0.45, 0, Math.PI * 2)
    ctx.fill()
  }

  // Bright plage and flare kernels.
  for (let i = 0; i < 34; i += 1) {
    const x = rand() * W
    const y = rand() * H
    const r = 4 + rand() * 18
    const glow = ctx.createRadialGradient(x, y, 0, x, y, r)
    glow.addColorStop(0, 'rgba(255,252,232,0.85)')
    glow.addColorStop(0.45, 'rgba(255,226,150,0.35)')
    glow.addColorStop(1, 'rgba(255,210,120,0)')
    ctx.fillStyle = glow
    ctx.fillRect(x - r, y - r, r * 2, r * 2)
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.anisotropy = 4
  texture.needsUpdate = true
  return texture
}
