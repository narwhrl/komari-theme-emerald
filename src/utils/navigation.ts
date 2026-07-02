export function navigateTo(path: string): void {
  if (typeof window === 'undefined')
    return

  if (window.location.pathname === path)
    return

  window.history.pushState({}, '', path)
  window.dispatchEvent(new Event('komari:navigate'))
}
