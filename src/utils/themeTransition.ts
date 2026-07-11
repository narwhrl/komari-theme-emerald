interface ThemeTransitionOptions {
  fromIsDark: boolean
  toIsDark: boolean
  update: () => void
}

let activeThemeTransition: ViewTransition | null = null
let latestTransitionId = 0

export function applyDocumentTheme(isDark: boolean): void {
  if (typeof document === 'undefined')
    return

  const root = document.documentElement
  root.classList.toggle('dark', isDark)
  root.style.colorScheme = isDark ? 'dark' : 'light'
}

function canAnimateThemeChange(fromIsDark: boolean, toIsDark: boolean): boolean {
  return fromIsDark !== toIsDark
    && typeof document !== 'undefined'
    && document.visibilityState === 'visible'
    && typeof document.startViewTransition === 'function'
    && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function runThemeTransition({ fromIsDark, toIsDark, update }: ThemeTransitionOptions): void {
  const transitionId = ++latestTransitionId
  const root = typeof document === 'undefined' ? null : document.documentElement

  if (activeThemeTransition) {
    activeThemeTransition.skipTransition()
    activeThemeTransition = null
  }
  root?.classList.remove('theme-transition-active')

  const applyLatestUpdate = () => {
    if (transitionId === latestTransitionId)
      update()
  }

  if (!canAnimateThemeChange(fromIsDark, toIsDark)) {
    applyLatestUpdate()
    return
  }

  root?.classList.add('theme-transition-active')

  try {
    const transition = document.startViewTransition(applyLatestUpdate)
    activeThemeTransition = transition

    const clearTransition = () => {
      if (activeThemeTransition !== transition)
        return
      activeThemeTransition = null
      root?.classList.remove('theme-transition-active')
    }
    void transition.finished.then(clearTransition, clearTransition)
  }
  catch {
    root?.classList.remove('theme-transition-active')
    applyLatestUpdate()
  }
}
