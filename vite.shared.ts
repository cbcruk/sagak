import { fileURLToPath, URL } from 'node:url'

/**
 * 상대 경로를 절대 경로로 변환합니다
 *
 * @param path - 상대 경로
 * @param base - 기준 URL (`import.meta.url`)
 * @returns 절대 경로
 */
export const resolve = (path: string, base: string) =>
  fileURLToPath(new URL(path, base))

/**
 * `@sagak/*` 패키지 alias 설정을 생성합니다
 *
 * @param rootUrl - 루트 디렉토리 URL (`import.meta.url` 기준)
 * @returns Vite alias 설정
 */
export const createSagakAliases = (rootUrl: string) => ({
  '@sagak/core': resolve('./packages/core/src', rootUrl),
  '@sagak/editor': resolve('./packages/editor/src', rootUrl),
  '@sagak/plugins': resolve('./packages/plugins/src', rootUrl),
  '@sagak/ui': resolve('./packages/ui/src', rootUrl),
})

/**
 * 프로젝트 루트 URL을 가져옵니다
 *
 * @param currentUrl - 현재 파일의 `import.meta.url`
 * @param depth - 루트까지의 상대 깊이 (예: `apps/demo`에서는 2)
 * @returns 루트 디렉토리 URL
 */
export const getRootUrl = (currentUrl: string, depth: number = 0): string => {
  if (depth === 0) return currentUrl
  return new URL('../'.repeat(depth), currentUrl).href
}
