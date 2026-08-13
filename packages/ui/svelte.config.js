import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

/**
 * TypeScript 를 `.svelte` 안에서 쓰기 위한 최소 설정입니다.
 *
 * 이 저장소는 전부 TS 이고 커스텀 엘리먼트들도 TS 라, 여기만 JS 로 두면
 * 타입이 국경에서 끊깁니다.
 */
export default { preprocess: vitePreprocess() }
