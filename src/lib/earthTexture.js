import * as THREE from 'three'
import { hexToRgb, mulberry32 } from './planet'

/**
 * Earth is the one world whose surface is known, so it is not generated from
 * bulk estimates like the archive planets. These textures are drawn once into
 * two equirectangular maps — the blue-marble surface and a separate cloud shell
 * — from simplified continent outlines, so the home world reads as Earth
 * instead of a random temperate planet.
 *
 * Land and oceans are approximate on purpose: a hand-traced coastline at this
 * resolution is enough to recognise the planet from orbit. Soft shapes are
 * stamped from a small radial sprite instead of canvas filters, which keeps
 * generation cheap enough to run during a render.
 */

const W = 2048
const H = 1024

export const EARTH_ATMOSPHERE = '#6fb4ff'

/* Simplified continents as [longitude, latitude] rings (degrees). */
const CONTINENTS = [
  // North America
  [
    [-168, 65], [-164, 70], [-150, 70], [-140, 70], [-130, 70], [-120, 69],
    [-110, 68], [-100, 69], [-92, 72], [-82, 73], [-78, 72], [-72, 66],
    [-64, 60], [-56, 52], [-60, 47], [-66, 45], [-70, 42], [-75, 38],
    [-76, 35], [-81, 25], [-82, 27], [-88, 30], [-95, 29], [-97, 26],
    [-94, 16], [-88, 16], [-83, 10], [-77, 8], [-80, 7], [-86, 13],
    [-92, 16], [-97, 16], [-105, 20], [-110, 24], [-114, 28], [-117, 32],
    [-124, 40], [-124, 48], [-128, 52], [-135, 58], [-146, 60], [-152, 58],
    [-160, 56], [-166, 60], [-168, 65],
  ],
  // South America
  [
    [-81, 8], [-77, 8], [-70, 11], [-60, 10], [-52, 5], [-44, -2], [-35, -6],
    [-38, -13], [-40, -22], [-48, -25], [-53, -34], [-58, -38], [-62, -40],
    [-65, -45], [-68, -52], [-71, -54], [-73, -45], [-72, -30], [-70, -18],
    [-76, -14], [-79, -5], [-81, 2], [-81, 8],
  ],
  // Africa
  [
    [-17, 21], [-17, 14], [-12, 5], [8, 4], [9, 1], [12, -6], [12, -17],
    [15, -22], [18, -30], [25, -34], [32, -29], [35, -22], [40, -16],
    [41, -2], [51, 12], [43, 12], [39, 15], [36, 22], [32, 31], [25, 32],
    [12, 33], [0, 36], [-10, 31], [-17, 21],
  ],
  // Eurasia
  [
    [-9, 43], [-9, 37], [-6, 36], [0, 39], [3, 42], [6, 43], [12, 44],
    [16, 42], [19, 40], [24, 40], [27, 41], [29, 41], [36, 36], [36, 31],
    [34, 29], [38, 24], [43, 12], [48, 14], [52, 17], [57, 22], [60, 25],
    [65, 25], [68, 24], [72, 21], [73, 16], [76, 8], [80, 13], [80, 8],
    [84, 19], [88, 22], [92, 21], [94, 16], [98, 13], [100, 7], [103, 1],
    [104, 10], [109, 20], [116, 23], [121, 31], [122, 38], [128, 41],
    [130, 48], [135, 54], [142, 59], [150, 59], [160, 60], [170, 64],
    [180, 66], [180, 70], [170, 71], [160, 70], [150, 72], [140, 74],
    [130, 73], [120, 75], [110, 77], [100, 78], [90, 77], [80, 74],
    [70, 73], [60, 70], [50, 69], [40, 68], [33, 70], [28, 71], [20, 70],
    [15, 68], [10, 63], [5, 60], [10, 55], [13, 55], [8, 54], [4, 52],
    [-2, 49], [-5, 48], [-9, 43],
  ],
  // Australia
  [
    [113, -22], [114, -33], [118, -35], [129, -32], [137, -35], [140, -38],
    [146, -39], [150, -37], [153, -28], [146, -19], [142, -11], [136, -12],
    [130, -11], [125, -14], [122, -18], [113, -22],
  ],
  // Greenland
  [
    [-45, 60], [-50, 66], [-55, 71], [-60, 76], [-50, 82], [-30, 83],
    [-20, 77], [-25, 70], [-40, 63], [-45, 60],
  ],
  // Madagascar
  [[44, -13], [50, -15], [50, -25], [45, -25], [43, -19], [44, -13]],
  // Japan
  [[130, 32], [140, 35], [142, 42], [145, 44], [141, 45], [138, 37], [132, 34], [130, 32]],
  // Great Britain
  [[-6, 50], [-2, 51], [0, 53], [-2, 58], [-6, 58], [-6, 50]],
  // Ireland
  [[-10, 52], [-6, 52], [-6, 55], [-10, 55], [-10, 52]],
  // Iceland
  [[-24, 65], [-18, 66], [-14, 65], [-19, 63], [-24, 65]],
  // New Zealand
  [[172, -34], [178, -38], [174, -41], [170, -46], [166, -46], [170, -41], [172, -34]],
  // Sumatra
  [[95, 5], [106, -6], [104, -8], [94, 2], [95, 5]],
  // Borneo
  [[109, 2], [117, -4], [112, -9], [108, -2], [109, 2]],
  // New Guinea
  [[131, -1], [150, -8], [147, -12], [136, -9], [131, -1]],
  // Sri Lanka
  [[79, 9], [82, 8], [81, 6], [79, 7], [79, 9]],
  // Cuba
  [[-85, 22], [-77, 23], [-74, 20], [-80, 20], [-85, 22]],
]

/** Sand seas: [lon, lat, lonRadius, latRadius]. */
const DESERTS = [
  [15, 16, 24, 8],
  [22, 46, 9, 6],
  [32, 56, 8, 4],
  [42, 104, 14, 6],
  [-25, 134, 15, 8],
  [-22, 22, 9, 6],
  [-20, -69, 3, 9],
  [34, -110, 8, 6],
  [23, -6, 10, 5],
]

/** Mountain belts: [lon, lat, lonRadius, latRadius]. */
const MOUNTAINS = [
  [82, 32, 13, 3],
  [-68, -22, 3, 14],
  [-114, 41, 4, 10],
  [10, 46, 5, 2],
  [38, 8, 4, 5],
  [74, 38, 7, 3],
]

const project = (lon, lat) => [((lon + 180) / 360) * W, ((90 - lat) / 180) * H]

/* ------------------------------------------------------- soft shape sprite -- */

const SPRITE_SIZE = 96
const sprites = new Map()

function softSprite(color) {
  let sprite = sprites.get(color)
  if (sprite) return sprite
  const canvas = document.createElement('canvas')
  canvas.width = SPRITE_SIZE
  canvas.height = SPRITE_SIZE
  const ctx = canvas.getContext('2d')
  const { r, g, b } = hexToRgb(color)
  const centre = SPRITE_SIZE / 2
  const gradient = ctx.createRadialGradient(centre, centre, 0, centre, centre, centre)
  gradient.addColorStop(0, `rgba(${r},${g},${b},1)`)
  gradient.addColorStop(0.45, `rgba(${r},${g},${b},0.8)`)
  gradient.addColorStop(0.78, `rgba(${r},${g},${b},0.25)`)
  gradient.addColorStop(1, `rgba(${r},${g},${b},0)`)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE)
  sprites.set(color, canvas)
  return canvas
}

/** Soft ellipse, repeated across the map seam so nothing is cut at 180°. */
function blob(ctx, lon, lat, lonRadius, latRadius, color, alpha) {
  const [x, y] = project(lon, lat)
  const rx = (lonRadius / 360) * W
  const ry = (latRadius / 180) * H
  if (rx < 0.5 || ry < 0.5) return
  const sprite = softSprite(color)
  ctx.save()
  ctx.globalAlpha = alpha
  for (const offset of [-W, 0, W]) {
    if (x + offset + rx < 0 || x + offset - rx > W) continue
    ctx.drawImage(sprite, x + offset - rx, y - ry, rx * 2, ry * 2)
  }
  ctx.restore()
}

const traceRing = (ctx, ring) => {
  ring.forEach(([lon, lat], index) => {
    const [x, y] = project(lon, lat)
    if (index === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  })
  ctx.closePath()
}

const pathContinents = (ctx) => {
  ctx.beginPath()
  CONTINENTS.forEach((ring) => traceRing(ctx, ring))
}

/* ------------------------------------------------------------- the surface -- */

function buildSurface() {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  const rand = mulberry32(20261115)

  // Ocean: deep blue at the poles, lighter through the tropics.
  const sea = ctx.createLinearGradient(0, 0, 0, H)
  sea.addColorStop(0, '#0a2544')
  sea.addColorStop(0.32, '#0d3a66')
  sea.addColorStop(0.5, '#12507f')
  sea.addColorStop(0.68, '#0d3a66')
  sea.addColorStop(1, '#0a2544')
  ctx.fillStyle = sea
  ctx.fillRect(0, 0, W, H)

  // Currents and bathymetry.
  for (let i = 0; i < 90; i += 1) {
    blob(
      ctx,
      -180 + rand() * 360,
      -70 + rand() * 140,
      9 + rand() * 28,
      4 + rand() * 10,
      rand() > 0.5 ? '#1a6491' : '#08243f',
      0.14 + rand() * 0.14,
    )
  }

  // Landmasses with a shallow-water rim, then their interior detail.
  ctx.save()
  ctx.lineJoin = 'round'
  ctx.fillStyle = '#3d6a3c'
  ctx.strokeStyle = 'rgba(52,134,152,0.75)'
  ctx.lineWidth = 5
  pathContinents(ctx)
  ctx.fill()
  ctx.stroke()
  ctx.restore()

  ctx.save()
  pathContinents(ctx)
  ctx.clip()

  for (let i = 0; i < 220; i += 1) {
    blob(
      ctx,
      -180 + rand() * 360,
      -60 + rand() * 130,
      3 + rand() * 11,
      2 + rand() * 7,
      rand() > 0.5 ? '#4a7544' : '#2f5733',
      0.28,
    )
  }

  // Boreal forest, then tundra further north.
  for (let i = 0; i < 80; i += 1) {
    blob(ctx, -180 + rand() * 360, 54 + rand() * 14, 6 + rand() * 16, 3 + rand() * 6, '#33553a', 0.5)
  }
  for (let i = 0; i < 60; i += 1) {
    blob(ctx, -180 + rand() * 360, 64 + rand() * 9, 5 + rand() * 13, 2 + rand() * 5, '#7c8467', 0.55)
  }

  DESERTS.forEach(([lon, lat, rx, ry]) => {
    blob(ctx, lon, lat, rx, ry, '#c6a468', 1)
    blob(ctx, lon, lat, rx * 0.62, ry * 0.6, '#dcc188', 0.75)
  })

  MOUNTAINS.forEach(([lon, lat, rx, ry]) => {
    blob(ctx, lon, lat, rx, ry, '#6d5a45', 0.85)
  })

  // Permanent snow on the ice sheets and the highest ground.
  blob(ctx, -42, 73, 15, 11, '#f4fbff', 1)
  blob(ctx, 100, 74, 38, 7, '#eaf4fb', 0.8)
  blob(ctx, -105, 72, 40, 7, '#eaf4fb', 0.8)
  blob(ctx, 60, 68, 24, 6, '#eaf4fb', 0.6)

  ctx.restore()

  // Polar caps, feathered so the ice edge is not a straight line.
  const north = ctx.createLinearGradient(0, 0, 0, H * 0.1)
  north.addColorStop(0, 'rgba(247,252,255,1)')
  north.addColorStop(0.6, 'rgba(247,252,255,0.9)')
  north.addColorStop(1, 'rgba(247,252,255,0)')
  ctx.fillStyle = north
  ctx.fillRect(0, 0, W, H * 0.1)

  const south = ctx.createLinearGradient(0, H, 0, H * 0.9)
  south.addColorStop(0, 'rgba(247,252,255,1)')
  south.addColorStop(0.55, 'rgba(247,252,255,0.95)')
  south.addColorStop(1, 'rgba(247,252,255,0)')
  ctx.fillStyle = south
  ctx.fillRect(0, H * 0.9, W, H * 0.1)

  for (let i = 0; i < 60; i += 1) {
    blob(ctx, -180 + rand() * 360, 1 + rand() * 10, 4 + rand() * 14, 2 + rand() * 5, '#f7fcff', 0.9)
  }

  // Fine grain so the sphere does not read as flat vector art.
  for (let i = 0; i < 5000; i += 1) {
    const x = rand() * W
    const y = rand() * H
    ctx.fillStyle =
      rand() > 0.5
        ? `rgba(255,255,255,${0.03 + rand() * 0.04})`
        : `rgba(0,0,0,${0.03 + rand() * 0.05})`
    ctx.fillRect(x, y, 1.5, 1.5)
  }

  return canvas
}

/* ---------------------------------------------------------------- clouds -- */

function buildClouds() {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  const rand = mulberry32(77123)

  // Convergent bands: the equator plus the storm tracks.
  const bands = [
    [0, 7, 80],
    [10, 6, 46],
    [-10, 6, 46],
    [26, 5, 28],
    [-26, 5, 28],
    [44, 6, 50],
    [-46, 6, 54],
    [60, 6, 44],
    [-60, 6, 48],
    [74, 4, 20],
    [-74, 4, 20],
  ]

  bands.forEach(([centre, spread, count]) => {
    for (let i = 0; i < count; i += 1) {
      const lat = centre + (rand() - 0.5) * spread * 2
      const lon = -180 + rand() * 360
      blob(ctx, lon, lat, 4 + rand() * 15, 1.6 + rand() * 4, '#ffffff', 0.16 + rand() * 0.32)
    }
  })

  // A few cyclones to break the banding.
  ;[[-140, 52], [-60, -50], [130, 34], [40, -58], [-20, 8]].forEach(([lon, lat]) => {
    for (let i = 0; i < 12; i += 1) {
      blob(
        ctx,
        lon + (rand() - 0.5) * 24,
        lat + (rand() - 0.5) * 14,
        3 + rand() * 9,
        1.4 + rand() * 3,
        '#ffffff',
        0.24,
      )
    }
    blob(ctx, lon, lat, 12, 5, '#ffffff', 0.3)
  })

  return canvas
}

const toTexture = (canvas) => {
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  texture.anisotropy = 8
  texture.needsUpdate = true
  return texture
}

let cached = null

/** Earth's surface and cloud maps, generated once and reused. */
export function getEarthTextures() {
  if (!cached) {
    cached = { surface: toTexture(buildSurface()), clouds: toTexture(buildClouds()) }
  }
  return cached
}
