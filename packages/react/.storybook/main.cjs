const path = require('path')

const coreDir = path.resolve(__dirname, '../../core/src')

/** @type {import('@storybook/react-vite').StorybookConfig} */
const config = {
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
      '@/core': path.resolve(coreDir, 'core'),
      '@/plugins': path.resolve(coreDir, 'plugins'),
      '@/editor': path.resolve(coreDir, 'editor'),
    }
    return config
  },
}

module.exports = config
