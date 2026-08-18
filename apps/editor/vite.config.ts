import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// 워크스페이스 패키지는 빌드 산출물이 아니라 소스로 직접 참조합니다.
// 앱이므로 배포용 dist 를 거칠 이유가 없고, 수정이 즉시 반영됩니다.
const coreSrc = fileURLToPath(new URL('../../packages/core/src', import.meta.url))

export default defineConfig({
  // GitHub Pages 는 프로젝트 하위 경로(/sagak/)로 서빙되므로 상대 경로로 둡니다.
  base: './',
  plugins: [svelte()],
  resolve: {
    alias: {
      'sagak-ui/styles': fileURLToPath(
        new URL('../../packages/ui/src/styles/index.css', import.meta.url)
      ),
      /*
       * `sagak-ui/svelte/…` 로 컴포넌트를 하나씩 집습니다. 예전에는 배럴
       * (`src/index.ts`)에서 전부 가져왔는데, 앱이 실제로 쓰는 것은 넷이라
       * 경로로 집는 편이 정직합니다.
       */
      'sagak-ui/svelte': fileURLToPath(
        new URL('../../packages/ui/src/svelte', import.meta.url)
      ),
      'sagak-core': `${coreSrc}/index.ts`,
      '@/core': `${coreSrc}/core`,
      '@/model': `${coreSrc}/model`,
      '@/plugins': `${coreSrc}/plugins`,
      '@/editor': `${coreSrc}/editor`,
    },
  },
})
