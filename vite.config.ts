import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import { createSagakAliases } from './vite.shared'

export default defineConfig({
  plugins: [preact()],
  resolve: {
    alias: {
      react: 'preact/compat',
      'react-dom': 'preact/compat',
      ...createSagakAliases(import.meta.url),
    },
  },
})
