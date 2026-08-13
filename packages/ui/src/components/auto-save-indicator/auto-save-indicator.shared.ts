/**
 * 자동 저장 표시에서 **렌더러와 무관한 부분** — Preact 판과 커스텀
 * 엘리먼트판이 같은 것을 봅니다.
 *
 * 특히 `WIDEST_LABELS` 는 문구 칸의 폭을 정하는 값이라 양쪽이 갈리면 한쪽만
 * 레이아웃이 흔들립니다. 지난 세션에 이 목록을 손으로 적었다가 틀린 적이
 * 있어(`'Saved at 00:00'` 71.33px vs 실제 `Saved at 05:49 AM` 93.00px),
 * 표본 시각을 같은 포매터에 통과시켜 만듭니다.
 */

export const DELETED_MS = 4000

export const DELETED_TEXT = 'Draft deleted'

export function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const SAMPLE_TIMES = [
  new Date(2000, 0, 1, 0, 0),
  new Date(2000, 0, 1, 10, 0),
  new Date(2000, 0, 1, 13, 45),
  new Date(2000, 0, 1, 23, 59),
]

export const WIDEST_LABELS = [
  'Unsaved changes',
  'Saving...',
  'Save failed',
  'Saved',
  DELETED_TEXT,
  ...SAMPLE_TIMES.map((time) => `Saved at ${formatTime(time)}`),
]
