import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
  splitting: false,
  minify: false,
  external: ['preact', 'preact/compat', 'preact/hooks', 'lucide-preact', 'sagak-core'],
  // @base-ui/react 는 내부에서 'react' 를 import 하므로 반드시 번들에 포함시켜
  // 아래 별칭이 적용되게 합니다. 그래야 소비자가 별칭 설정 없이 preact 만으로 씁니다.
  noExternal: [/^@base-ui\//],
  esbuildOptions(options) {
    options.jsx = 'automatic'
    options.jsxImportSource = 'preact'
    // @base-ui/react 는 내부적으로 'react'/'react-dom' 을 import 합니다.
    // preact/compat 으로 별칭해 실제 번들에는 preact 만 들어가게 합니다.
    options.alias = {
      ...options.alias,
      react: 'preact/compat',
      'react-dom': 'preact/compat',
      'react/jsx-runtime': 'preact/jsx-runtime',
    }
  },
})
