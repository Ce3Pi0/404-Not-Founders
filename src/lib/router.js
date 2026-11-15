// Tiny history-based routing for the map's `/system/:id` deep links.
//
// The app's screens are driven by a step state machine, so only the system
// detail page needs a real URL. One helper keeps it in sync with the browser
// without pulling in a router dependency.

import { useEffect, useState } from 'react'

export function navigate(path, { replace = false } = {}) {
  if (window.location.pathname === path) return
  window.history[replace ? 'replaceState' : 'pushState']({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export function systemIdFromPath(pathname) {
  const match = /^\/system\/([^/]+)\/?$/.exec(pathname ?? '')
  return match ? decodeURIComponent(match[1]) : null
}

/** Current pathname, re-read on browser navigation. */
export function usePathname() {
  const [pathname, setPathname] = useState(() => window.location.pathname)
  useEffect(() => {
    const onChange = () => setPathname(window.location.pathname)
    window.addEventListener('popstate', onChange)
    return () => window.removeEventListener('popstate', onChange)
  }, [])
  return pathname
}
