import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// 워크스페이스 패키지는 빌드 산출물이 아니라 소스로 직접 참조합니다.
// 앱이므로 배포용 dist 를 거칠 이유가 없고, 수정이 즉시 반영됩니다.
const coreSrc = fileURLToPath(new URL('../../packages/core/src', import.meta.url))

export default defineConfig({
  // GitHub Pages 는 프로젝트 하위 경로(/sagak/)로 서빙되므로 상대 경로로 둡니다.
  base: './',
  /*
   * Preact 와 Svelte 를 **같이** 둡니다.
   *
   * 이주 중에는 두 렌더러가 공존합니다. 각 플러그인은 자기 확장자만 다루므로
   * (`.tsx` / `.svelte`) 서로 안 부딪힙니다.
   *
   * 이 줄이 이주 전체의 전제입니다 — 안 물리면 Svelte 로 가는 길이 막힙니다.
   */
  plugins: [preact(), svelte()],
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
