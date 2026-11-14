import * as THREE from 'three'

const AU_PER_SUN_RADIUS = 0.00465047

export function hashString(value) {
  let hash = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(i), 16777619)
  }
  return hash >>> 0
}

export function mulberry32(seed) {
  let a = seed >>> 0
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function hexToRgb(hex) {
  const clean = hex.replace('#', '')
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  }
}

function rgbToHex(r, g, b) {
  const toHex = (channel) => Math.max(0, Math.min(255, Math.round(channel))).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

function jitter(hex, rand, amount = 10) {
  const { r, g, b } = hexToRgb(hex)
  const shift = () => (rand() - 0.5) * 2 * amount
  return rgbToHex(r + shift(), g + shift(), b + shift())
}

/**
 * Appearance is never in the archive: we read it out of the planet's bulk
 * properties (radius, density, mass) and its equilibrium temperature.
 */
const TYPES = {
  gas: {
    label: 'Gas giant',
    composition: 'Hydrogen–helium envelope',
    atmosphere: '#ffd7a1',
    palettes: [
      ['#5c3418', '#c99a63', '#f1dfc2', '#7a4f2a'],
      ['#4a2c17', '#d9b382', '#f7e6cb', '#8c5b31'],
      ['#20304d', '#8fa9d6', '#dfe9ff', '#3f5a86'],
    ],
  },
  neptune: {
    label: 'Ice giant',
    composition: 'Volatile-rich envelope',
    atmosphere: '#7fc4ff',
    palettes: [
      ['#0a1f3d', '#2f6fb0', '#8fd0f0', '#12335f'],
      ['#0d1633', '#4b6fd6', '#a9c8ff', '#1a2a5c'],
    ],
  },
  ice: {
    label: 'Ice world',
    composition: 'Frozen volatiles over rock',
    atmosphere: '#bfe9ff',
    palettes: [
      ['#4a6a80', '#cfe6f2', '#f8fcff', '#7fa6bd'],
      ['#3f5b74', '#b9d8ea', '#eef8ff', '#6f8ea5'],
    ],
  },
  lava: {
    label: 'Lava world',
    composition: 'Molten rock surface',
    atmosphere: '#ff8a4a',
    palettes: [
      ['#1a0f0d', '#4a1d10', '#ff6b2c', '#ffd28a'],
      ['#160c0b', '#3d160f', '#e94f1c', '#ffc46b'],
    ],
  },
  ocean: {
    label: 'Temperate world',
    composition: 'Liquid water and rock',
    atmosphere: '#8fd8ff',
    palettes: [
      ['#052a4a', '#12719b', '#2f7f57', '#dff2ff'],
      ['#06243f', '#1a7f9e', '#3e7f4a', '#e4f6ff'],
    ],
  },
  desert: {
    label: 'Hot rock',
    composition: 'Rocky crust, thin atmosphere',
    atmosphere: '#ffcf9a',
    palettes: [
      ['#5c2f16', '#b46a33', '#e6b57a', '#8a4a24'],
      ['#4d2412', '#a85c2c', '#dca86c', '#7a3d1b'],
    ],
  },
  iron: {
    label: 'Iron world',
    composition: 'Metal-rich, high density',
    atmosphere: '#c9a98a',
    palettes: [
      ['#221c1a', '#7a5b4a', '#b08b6a', '#3a3330'],
      ['#1d1a1a', '#6d5a55', '#a08d84', '#353130'],
    ],
  },
  rocky: {
    label: 'Rocky world',
    composition: 'Bare rock',
    atmosphere: '#9fb3c8',
    palettes: [
      ['#23262b', '#6f757f', '#b9bec6', '#3b3f46'],
      ['#262423', '#737069', '#bcb6ac', '#413e3b'],
    ],
  },
}

export function classifyPlanet(planet) {
  const radius = planet.radiusEarth
  const density = planet.densityGcc
  const temp = planet.eqTempK

  let type = 'rocky'
  let source = 'inferred'

  if (radius == null && temp == null) {
    type = ['gas', 'neptune', 'ice', 'lava', 'ocean', 'desert', 'rocky'][
      hashString(planet.name) % 7
    ]
    source = 'random'
  } else if (radius >= 6) {
    type = 'gas'
  } else if (radius >= 3.2) {
    type = 'neptune'
  } else if (density != null && density >= 7.5) {
    type = 'iron'
  } else if (temp != null && temp >= 1000) {
    type = 'lava'
  } else if (temp != null && temp <= 170) {
    type = 'ice'
  } else if (temp != null && temp <= 335) {
    type = 'ocean'
  } else if (temp != null) {
    type = 'desert'
  }

  if (source !== 'random' && temp == null) source = 'estimated'

  const definition = TYPES[type]
  const rand = mulberry32(hashString(planet.name))
  const base = definition.palettes[hashString(`${planet.name}-palette`) % definition.palettes.length]
  const palette = base.map((color) => jitter(color, rand, 8))

  const evidence = []
  if (temp != null) evidence.push(`${Math.round(temp)} K equilibrium temperature`)
  if (density != null) evidence.push(`${density} g/cm³ density`)
  else if (planet.massEarth != null) evidence.push(`${planet.massEarth} M⊕ mass`)
  if (radius != null) evidence.push(`${radius} R⊕ radius`)

  return {
    type,
    label: definition.label,
    composition: definition.composition,
    atmosphere: definition.atmosphere,
    palette,
    source,
    evidence:
      source === 'random'
        ? 'No radius or temperature in the archive — appearance randomized.'
        : source === 'estimated'
          ? 'No equilibrium temperature in the archive — appearance estimated from bulk properties.'
          : `Inferred from ${evidence.join(', ')}.`,
  }
}

export function starColor(teff) {
  const temperature = (teff ?? 5200) / 100
  let r
  let g
  let b

  if (temperature <= 66) {
    r = 255
    g = 99.4708025861 * Math.log(temperature) - 161.1195681661
  } else {
    r = 329.698727446 * Math.pow(temperature - 60, -0.1332047592)
    g = 288.1221695283 * Math.pow(temperature - 60, -0.0755148492)
  }

  if (temperature >= 66) b = 255
  else if (temperature <= 19) b = 0
  else b = 138.5177312231 * Math.log(temperature - 10) - 305.0447927307

  return rgbToHex(r, g, b)
}

export function starSpectralClass(planet) {
  if (planet.spectralType) return planet.spectralType
  const teff = planet.starTeffK
  if (teff == null) return 'Unclassified'
  if (teff >= 30000) return 'O-type'
  if (teff >= 10000) return 'B-type'
  if (teff >= 7500) return 'A-type'
  if (teff >= 6000) return 'F-type'
  if (teff >= 5200) return 'G-type'
  if (teff >= 3700) return 'K-type'
  return 'M-type'
}

/** Apparent angular diameter of the host star as seen from the planet, in degrees. */
export function starAngularDiameterDeg(planet) {
  if (!planet.starRadiusSun || !planet.semiMajorAxisAu) return null
  const starRadiusAu = planet.starRadiusSun * AU_PER_SUN_RADIUS
  const ratio = starRadiusAu / planet.semiMajorAxisAu
  if (ratio <= 0) return null
  return Math.min(180, 2 * Math.atan(ratio) * (180 / Math.PI))
}

export function describeStar(planet) {
  const name = planet.star ?? planet.name
  const teff = planet.starTeffK
  return {
    name,
    spectral: starSpectralClass(planet),
    color: starColor(teff),
    teff,
    radius: planet.starRadiusSun,
    stars: planet.starsInSystem ?? 1,
  }
}

export function compositionSummary(planet) {
  const look = classifyPlanet(planet)
  const parts = [look.label]
  if (planet.densityGcc != null) {
    if (planet.densityGcc >= 7.5) parts.push('metal-rich')
    else if (planet.densityGcc >= 4.5) parts.push('dense rock')
    else if (planet.densityGcc >= 2) parts.push('mixed volatiles')
    else parts.push('low density')
  }
  return parts.join(' · ')
}

export function createPlanetTexture(planet) {
  const look = classifyPlanet(planet)
  const rand = mulberry32(hashString(`${planet.name}-surface`))
  const W = 1024
  const H = 512
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  const [dark, mid, light, accent] = look.palette

  const paint = (hex, alpha = 1) => {
    const { r, g, b } = hexToRgb(hex)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }

  const blob = (x, y, rx, ry, color, alpha = 0.6) => {
    ctx.fillStyle = paint(color, alpha)
    for (const offset of [-W, 0, W]) {
      if (x + offset + rx < -20 || x + offset - rx > W + 20) continue
      ctx.beginPath()
      ctx.ellipse(x + offset, y, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  const crack = (x, y, steps, color, width, alpha) => {
    ctx.strokeStyle = paint(color, alpha)
    ctx.lineWidth = width
    ctx.lineCap = 'round'
    for (const offset of [-W, 0, W]) {
      ctx.beginPath()
      ctx.moveTo(x + offset, y)
      let cx = x
      let cy = y
      for (let i = 0; i < steps; i += 1) {
        cx += (rand() - 0.5) * 44
        cy += (rand() - 0.5) * 18
        ctx.lineTo(cx + offset, cy)
      }
      ctx.stroke()
    }
  }

  const noise = (count, alpha) => {
    for (let i = 0; i < count; i += 1) {
      const x = rand() * W
      const y = rand() * H
      ctx.fillStyle = rand() > 0.5 ? `rgba(255, 255, 255, ${alpha})` : `rgba(0, 0, 0, ${alpha * 1.4})`
      ctx.fillRect(x, y, 1.5, 1.5)
    }
  }

  const polarShade = (strength = 0.4) => {
    const shade = ctx.createLinearGradient(0, 0, 0, H)
    shade.addColorStop(0, `rgba(0, 0, 0, ${strength})`)
    shade.addColorStop(0.18, 'rgba(0, 0, 0, 0)')
    shade.addColorStop(0.82, 'rgba(0, 0, 0, 0)')
    shade.addColorStop(1, `rgba(0, 0, 0, ${strength})`)
    ctx.fillStyle = shade
    ctx.fillRect(0, 0, W, H)
  }

  ctx.fillStyle = mid
  ctx.fillRect(0, 0, W, H)

  if (look.type === 'gas' || look.type === 'neptune') {
    let y = 0
    while (y < H) {
      const bandHeight = 7 + rand() * 26
      const tone = [dark, mid, light, accent, mid][Math.floor(rand() * 5)]
      ctx.fillStyle = paint(tone, 0.28 + rand() * 0.35)
      ctx.fillRect(0, y, W, bandHeight)
      y += bandHeight
    }

    for (let i = 0; i < 40; i += 1) {
      const y = rand() * H
      const amplitude = 2 + rand() * 9
      const frequency = 2 + Math.floor(rand() * 4)
      const phase = rand() * Math.PI * 2
      ctx.strokeStyle = paint(rand() > 0.5 ? light : dark, 0.18 + rand() * 0.2)
      ctx.lineWidth = 1 + rand() * 5
      ctx.beginPath()
      for (let x = 0; x <= W; x += 10) {
        const wave = y + Math.sin((x / W) * Math.PI * 2 * frequency + phase) * amplitude
        if (x === 0) ctx.moveTo(x, wave)
        else ctx.lineTo(x, wave)
      }
      ctx.stroke()
    }

    if (look.type === 'gas') {
      const stormX = W * (0.35 + rand() * 0.3)
      const stormY = H * (0.45 + rand() * 0.25)
      blob(stormX, stormY, 60 + rand() * 40, 24 + rand() * 16, accent, 0.55)
      blob(stormX, stormY, 34 + rand() * 20, 12 + rand() * 10, light, 0.3)
    } else {
      const spotX = W * (0.4 + rand() * 0.2)
      const spotY = H * (0.55 + rand() * 0.15)
      blob(spotX, spotY, 46, 26, dark, 0.65)
      for (let i = 0; i < 18; i += 1) {
        blob(rand() * W, rand() * H, 8 + rand() * 30, 4 + rand() * 12, light, 0.12)
      }
    }
    polarShade(0.5)
  }

  if (look.type === 'ice') {
    ctx.fillStyle = paint(light, 0.55)
    ctx.fillRect(0, 0, W, H)
    for (let i = 0; i < 90; i += 1) {
      blob(rand() * W, rand() * H, 20 + rand() * 90, 12 + rand() * 50, rand() > 0.5 ? light : mid, 0.12)
    }
    for (let i = 0; i < 26; i += 1) {
      crack(rand() * W, rand() * H, 4 + Math.floor(rand() * 6), mid, 1 + rand() * 2, 0.4)
    }
    polarShade(0.18)
  }

  if (look.type === 'lava') {
    ctx.fillStyle = dark
    ctx.fillRect(0, 0, W, H)
    for (let i = 0; i < 26; i += 1) {
      const x = rand() * W
      const y = rand() * H
      const radius = 30 + rand() * 120
      const glow = ctx.createRadialGradient(x, y, 0, x, y, radius)
      glow.addColorStop(0, paint(accent, 0.8))
      glow.addColorStop(0.45, paint(mid, 0.45))
      glow.addColorStop(1, paint(dark, 0))
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, Math.PI * 2)
      ctx.fill()
    }
    for (let i = 0; i < 40; i += 1) {
      crack(rand() * W, rand() * H, 5 + Math.floor(rand() * 8), rand() > 0.4 ? accent : mid, 1 + rand() * 2.5, 0.65)
    }
    for (let i = 0; i < 40; i += 1) {
      blob(rand() * W, rand() * H, 18 + rand() * 70, 10 + rand() * 40, dark, 0.35)
    }
  }

  if (look.type === 'ocean') {
    const sea = ctx.createLinearGradient(0, 0, 0, H)
    sea.addColorStop(0, paint(dark, 0.9))
    sea.addColorStop(0.5, paint(mid, 0.95))
    sea.addColorStop(1, paint(dark, 0.9))
    ctx.fillStyle = sea
    ctx.fillRect(0, 0, W, H)

    const continents = 5 + Math.floor(rand() * 4)
    for (let i = 0; i < continents; i += 1) {
      const cx = rand() * W
      const cy = H * (0.2 + rand() * 0.6)
      const spread = 40 + rand() * 90
      for (let j = 0; j < 26; j += 1) {
        const x = cx + (rand() - 0.5) * spread * 2
        const y = cy + (rand() - 0.5) * spread
        const size = 8 + rand() * 26
        blob(x, y, size, size * (0.6 + rand() * 0.7), accent, 0.55)
        if (j < 8) blob(x, y, size * 1.5, size, light, 0.1)
      }
    }

    for (let i = 0; i < 46; i += 1) {
      blob(rand() * W, rand() * H, 24 + rand() * 80, 8 + rand() * 20, '#ffffff', 0.1)
    }

    const capTop = ctx.createLinearGradient(0, 0, 0, H * 0.14)
    capTop.addColorStop(0, 'rgba(240, 252, 255, 0.95)')
    capTop.addColorStop(1, 'rgba(240, 252, 255, 0)')
    ctx.fillStyle = capTop
    ctx.fillRect(0, 0, W, H * 0.14)
    const capBottom = ctx.createLinearGradient(0, H, 0, H * 0.86)
    capBottom.addColorStop(0, 'rgba(240, 252, 255, 0.95)')
    capBottom.addColorStop(1, 'rgba(240, 252, 255, 0)')
    ctx.fillStyle = capBottom
    ctx.fillRect(0, H * 0.86, W, H * 0.14)
  }

  if (look.type === 'desert') {
    for (let i = 0; i < 70; i += 1) {
      blob(rand() * W, rand() * H, 30 + rand() * 120, 12 + rand() * 44, rand() > 0.5 ? light : accent, 0.16)
    }
    for (let i = 0; i < 60; i += 1) {
      const y = rand() * H
      const amplitude = 3 + rand() * 12
      const phase = rand() * Math.PI * 2
      ctx.strokeStyle = paint(rand() > 0.5 ? dark : light, 0.18)
      ctx.lineWidth = 1 + rand() * 4
      ctx.beginPath()
      for (let x = 0; x <= W; x += 12) {
        const wave = y + Math.sin((x / W) * Math.PI * 2 * 3 + phase) * amplitude
        if (x === 0) ctx.moveTo(x, wave)
        else ctx.lineTo(x, wave)
      }
      ctx.stroke()
    }
    for (let i = 0; i < 12; i += 1) {
      crack(rand() * W, rand() * H, 3 + Math.floor(rand() * 4), dark, 2 + rand() * 3, 0.35)
    }
    polarShade(0.22)
  }

  if (look.type === 'rocky' || look.type === 'iron') {
    for (let i = 0; i < 60; i += 1) {
      blob(rand() * W, rand() * H, 30 + rand() * 100, 20 + rand() * 60, rand() > 0.5 ? light : dark, 0.14)
    }
    const craters = 120
    for (let i = 0; i < craters; i += 1) {
      const x = rand() * W
      const y = rand() * H
      const radius = 2 + rand() * 16
      blob(x, y, radius, radius * (0.7 + rand() * 0.5), dark, 0.35)
      ctx.strokeStyle = paint(light, 0.28)
      ctx.lineWidth = 1
      for (const offset of [-W, 0, W]) {
        ctx.beginPath()
        ctx.ellipse(x + offset, y - radius * 0.18, radius * 0.92, radius * 0.7, 0, Math.PI * 0.9, Math.PI * 2.1)
        ctx.stroke()
      }
    }
    if (look.type === 'iron') {
      for (let i = 0; i < 26; i += 1) {
        crack(rand() * W, rand() * H, 4 + Math.floor(rand() * 5), accent, 1 + rand() * 2, 0.28)
      }
    }
    polarShade(0.25)
  }

  noise(9000, 0.05)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  texture.anisotropy = 4

  return { texture, look }
}

export const HIGHLIGHTS = [
  { name: 'Proxima Cen b', note: 'Closest known exoplanet' },
  { name: 'TRAPPIST-1 e', note: 'Rocky world in the habitable zone' },
  { name: 'Kepler-452 b', note: "Earth's older cousin" },
  { name: 'HD 209458 b', note: 'First transiting exoplanet' },
  { name: 'WASP-12 b', note: 'Ultra-hot Jupiter' },
  { name: 'KELT-9 b', note: 'Hottest known planet' },
  { name: 'Kepler-16 b', note: 'Orbits two suns' },
  { name: '55 Cnc e', note: 'Lava world' },
  { name: 'Kepler-51 d', note: 'Super-puff density' },
  { name: 'PSR B1257+12 b', note: 'Pulsar planet' },
  { name: 'TOI-700 d', note: 'Nearby temperate world' },
  { name: 'GJ 1214 b', note: 'Steamy water world' },
]
