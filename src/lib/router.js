// Tiny history-based routing for the map's `/system/:id` deep links and the
// star-system explorer's `/planet/:id` and `/travel` links.
//
// The app's screens are driven by a step state machine, so only the deep links
// need a real URL. These helpers keep them in sync with the browser without
// pulling in a router dependency.

import { useEffect, useState } from 'react'

export const TRAVEL_PATH = '/travel'

export function navigate(path, { replace = false } = {}) {
  if (window.location.pathname === path) return
  window.history[replace ? 'replaceState' : 'pushState']({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export function systemIdFromPath(pathname) {
  const match = /^\/system\/([^/]+)\/?$/.exec(pathname ?? '')
  return match ? decodeURIComponent(match[1]) : null
}

export function planetIdFromPath(pathname) {
  const match = /^\/planet\/([^/]+)\/?$/.exec(pathname ?? '')
  return match ? decodeURIComponent(match[1]) : null
}

export function isTravelPath(pathname) {
  return pathname === TRAVEL_PATH
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
