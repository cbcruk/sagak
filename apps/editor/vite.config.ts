import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'

// 워크스페이스 패키지는 빌드 산출물이 아니라 소스로 직접 참조합니다.
// 앱이므로 배포용 dist 를 거칠 이유가 없고, 수정이 즉시 반영됩니다.
const coreSrc = fileURLToPath(new URL('../../packages/core/src', import.meta.url))

export default defineConfig({
  // GitHub Pages 는 프로젝트 하위 경로(/sagak/)로 서빙되므로 상대 경로로 둡니다.
  base: './',
  plugins: [preact()],
  resolve: {
    alias: {
      'sagak-ui/styles': fileURLToPath(
        new URL('../../packages/ui/src/styles/index.css', import.meta.url)
      ),
      'sagak-ui': fileURLToPath(
        new URL('../../packages/ui/src/index.ts', import.meta.url)
      ),
      'sagak-core': `${coreSrc}/index.ts`,
      '@/core': `${coreSrc}/core`,
      '@/plugins': `${coreSrc}/plugins`,
      '@/editor': `${coreSrc}/editor`,
    },
  },
})
