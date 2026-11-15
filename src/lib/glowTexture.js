import * as THREE from 'three'

/** Soft radial sprite so every star reads as a glowing point. */
export function createGlowTexture() {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  const gradient = context.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  )
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(0.22, 'rgba(255,255,255,0.85)')
  gradient.addColorStop(0.55, 'rgba(255,255,255,0.18)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  context.fillStyle = gradient
  context.fillRect(0, 0, size, size)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}

/** Soft bloom plus a crisp ring, drawn from one billboarded texture. */
export function createHaloTexture() {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  const centre = size / 2

  const bloom = context.createRadialGradient(centre, centre, 0, centre, centre, centre)
  bloom.addColorStop(0, 'rgba(235,253,255,0.9)')
  bloom.addColorStop(0.16, 'rgba(150,238,255,0.5)')
  bloom.addColorStop(0.42, 'rgba(94,231,255,0.16)')
  bloom.addColorStop(1, 'rgba(94,231,255,0)')
  context.fillStyle = bloom
  context.fillRect(0, 0, size, size)

  context.strokeStyle = 'rgba(174,245,255,0.95)'
  context.lineWidth = 5
  context.beginPath()
  context.arc(centre, centre, size * 0.38, 0, Math.PI * 2)
  context.stroke()

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}

/**
 * A crisp, thin circle. Used for the Solar System's home outline and for route
 * endpoints, where a bloom alone would read as an anonymous bright blob.
 */
export function createRingTexture(lineWidth = 3) {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  const centre = size / 2
  context.strokeStyle = 'rgba(255,255,255,1)'
  context.lineWidth = lineWidth
  context.beginPath()
  context.arc(centre, centre, size * 0.42, 0, Math.PI * 2)
  context.stroke()
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}

/** Small text sprite, used to name the grid rings in the scene itself. */
export function createTextTexture(text, color = '#9fe9ff') {
  const width = 256
  const height = 64
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  context.clearRect(0, 0, width, height)
  context.font = '600 26px "IBM Plex Mono", ui-monospace, monospace'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillStyle = color
  context.fillText(text, width / 2, height / 2)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}
