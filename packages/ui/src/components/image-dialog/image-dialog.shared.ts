/**
 * 이미지 다이얼로그의 **렌더러와 무관한 부분**.
 *
 * Preact 판과 Svelte 판이 같은 것을 봐야 합니다. 특히 허용 형식과 크기 제한은
 * 사용자에게 보이는 문구(`max 5MB`)와 짝이라 갈리면 안 됩니다.
 */

export const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

export const MAX_FILE_SIZE = 5 * 1024 * 1024
