import { defineConfig } from 'tsdown'
import ts from 'typescript'

const lowerDecorators = {
  name: 'ui-beautify-lower-decorators',
  transform(code: string, id: string) {
    if (!id.endsWith('.ts') || !/^\s*@[A-Za-z_$]/m.test(code)) return
    const result = ts.transpileModule(code, { fileName: id,
      compilerOptions: { target: ts.ScriptTarget.ES2024, module: ts.ModuleKind.ESNext, sourceMap: true } })
    return { code: result.outputText.replace(/\n?\/\/# sourceMappingURL=.*$/u, '\n'), map: result.sourceMapText }
  },
}

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  outDir: 'lib',
  platform: 'node',
  dts: false,
  // Every @deepseek-ai package is resolved from the running harness at load
  // time, so none of them may be inlined here.
  deps: { neverBundle: [/^@deepseek-ai\//] },
  plugins: [lowerDecorators],
  clean: true,
})
