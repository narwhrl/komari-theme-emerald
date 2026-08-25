export type ErrorOrigin = 'remote' | 'transport' | 'client'

function getStructuralOrigin(error: Error): unknown {
  return (error as { origin?: unknown }).origin
}

export function getDisplayErrorMessage(
  error: unknown,
  localizedFallback: string,
): string {
  if (!(error instanceof Error))
    return localizedFallback

  if (getStructuralOrigin(error) === 'remote' && error.message.trim().length > 0)
    return error.message

  return localizedFallback
}
