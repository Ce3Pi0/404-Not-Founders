// A blank panel is worse than a message: check once whether a 3D view is
// possible, and let every scene share the answer.
// Slower devices (few cores or little memory) draw a lighter flight stage:
// fewer stars, no antialiasing and a capped pixel ratio. Detected once so the
// whole stage agrees on the fallback.
export const SIMPLIFIED_GRAPHICS = (() => {
  if (typeof navigator === 'undefined') return false
  const cores = navigator.hardwareConcurrency ?? 8
  const memory = navigator.deviceMemory ?? 8
  return cores <= 4 || memory <= 4
})()

export const HAS_WEBGL = (() => {
  try {
    const probe = document.createElement('canvas')
    const context = probe.getContext('webgl2') ?? probe.getContext('webgl')
    if (!context) return false
    // Release the probe context so it never counts against the browser's limit.
    context.getExtension('WEBGL_lose_context')?.loseContext()
    return true
  } catch {
    return false
  }
})()
