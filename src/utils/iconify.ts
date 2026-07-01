/**
 * Iconify pre-registration hook.
 *
 * By default `@iconify/react` resolves icons on demand from the public
 * Iconify CDN (https://api.iconify.design) with browser caching. We do NOT
 * bundle entire icon sets; doing so would add several MB to the initial
 * payload. This function is kept as a future extension point.
 */
export async function setupIconify(): Promise<void> {
  // no-op: rely on @iconify/react's lazy CDN fetcher
}