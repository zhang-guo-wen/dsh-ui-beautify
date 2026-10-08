/** Live feature lifetime: release every override on disable and recreate it on enable. */
export function watchFeature(
  scope: { getSnapshot(): { status: string; value?: unknown }; subscribe(listener: () => void): () => void },
  key: string,
  install: () => () => void,
): () => void {
  let release: (() => void) | undefined
  const sync = (): void => {
    const snapshot = scope.getSnapshot()
    // Wait for stored choices, so a cold load with false never installs the feature.
    if (snapshot.status === 'loading' || snapshot.status === 'idle') return
    const enabled = (snapshot.value as Record<string, unknown> | undefined)?.[key] !== false
    if (enabled) release ??= install()
    else { release?.(); release = undefined }
  }
  const off = scope.subscribe(sync)
  sync()
  return () => { off(); release?.() }
}
