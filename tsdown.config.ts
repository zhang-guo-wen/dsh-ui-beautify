import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  outDir: 'lib',
  platform: 'node',
  dts: false,
  // Every @deepseek-ai package is resolved from the running harness at load
  // time, so none of them may be inlined here.
  deps: { neverBundle: [/^@deepseek-ai\//] },
  clean: true,
})
