import type { StorybookConfig } from '@storybook/react-vite'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const coreDir = resolve(__dirname, '../../core/src')

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
  addons: ['@storybook/addon-essentials'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  viteFinal: async (config) => {
    config.resolve = config.resolve || {}
    config.resolve.alias = {
      ...config.resolve.alias,
      'sagak-core': coreDir,
      '@/core': resolve(coreDir, 'core'),
      '@/plugins': resolve(coreDir, 'plugins'),
      '@/editor': resolve(coreDir, 'editor'),
    }
    return config
  },
}

export default config
