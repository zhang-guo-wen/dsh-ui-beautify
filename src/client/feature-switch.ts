/**
 * Live feature lifetime: release every override on disable and recreate it on enable.
 * @param scope - settings form whose snapshot holds the switch.
 * @param key - field name of the switch.
 * @param install - installs the enabled behaviour; returns its disposer.
 * @param options - `defaultOn` (default `true`) decides what a missing or
 * undefined value counts as. The Host resolves the schema defaults before the
 * first accepted section, so this only covers the cold-start read and a field an
 * older Host schema does not carry: a switch that defaults off must not install
 * on a Host whose document has no field for it.
 * @returns disposer releasing the behaviour and the subscription.
 */
export function watchFeature(
  scope: { getSnapshot(): { status: string; value?: unknown }; subscribe(listener: () => void): () => void },
  key: string,
  install: () => () => void,
  options: { defaultOn?: boolean } = {},
): () => void {
  const defaultOn = options.defaultOn ?? true
  let release: (() => void) | undefined
  const sync = (): void => {
    const snapshot = scope.getSnapshot()
    // Wait for stored choices, so a cold load with false never installs the feature.
    if (snapshot.status === 'loading' || snapshot.status === 'idle') return
    const value = (snapshot.value as Record<string, unknown> | undefined)?.[key]
    const enabled = defaultOn ? value !== false : value === true
    if (enabled) release ??= install()
    else { release?.(); release = undefined }
  }
  const off = scope.subscribe(sync)
  sync()
  return () => { off(); release?.() }
}
