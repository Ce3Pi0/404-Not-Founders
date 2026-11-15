// A blank panel is worse than a message: check once whether a 3D view is
// possible, and let every scene share the answer.
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
