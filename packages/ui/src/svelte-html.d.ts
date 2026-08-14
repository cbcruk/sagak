/**
 * 우리가 쓰는 **표준 밖 속성**을 Svelte 의 HTML 타입에 알려 줍니다.
 *
 * ## 왜 필요했나
 *
 * `tsc --noEmit` 은 `.svelte` 파일을 **안 봅니다.** 그래서 컴포넌트 21개가
 * 타입 검사를 한 번도 안 받고 있었습니다. `svelte-check` 를 붙여 보니 오류
 * 89개가 나왔고, 그중 **83개가 이 한 가지**였습니다 — `k` 속성이 어디에도
 * 선언돼 있지 않다는 것.
 *
 * `k` 는 원래 kinu 의 스타일 훅이었고, kinu 를 걷어내며 우리 것이 됐습니다
 * (`styles/kinu.css`). 값이 아니라 **선택자로만** 쓰이므로 문자열이면
 * 충분합니다.
 *
 * `data-mobile` 은 `data-*` 라 Svelte 가 이미 허용합니다.
 */

declare namespace svelteHTML {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface HTMLAttributes<T> {
    /** kinu 에서 물려받은 스타일 훅 — `styles/kinu.css` 의 선택자입니다 */
    k?: string
    /** `[k=button]` 계열이 함께 보는 변종·크기 */
    variant?: string
    size?: string
    /** 드롭다운 항목의 고른 표시 */
    selected?: boolean
  }
}

/** 스타일시트를 부작용으로 가져오는 자리 (`harness.ts`) */
declare module '*.css' {
  const content: string
  export default content
}
