/**
 * IME 조합 중인가.
 *
 * 한글·일본어·중국어 입력은 `compositionstart` 와 `compositionend` 사이에서
 * 글자를 조립합니다. 그 사이에 서식 명령이 끼어들면 조합 중인 글자가 끊깁니다.
 *
 * ## `SelectionManager` 에서 남은 것
 *
 * 이 일은 494줄짜리 `SelectionManager` 안에 있었습니다. 선택 영역을 저장·복원
 * 하고, HTML 을 꽂고, 범위를 다루는 열아홉 가지 중 하나였습니다.
 *
 * 편집 영역이 문서 모델을 갖게 되면서 나머지 열여덟이 전부 쓰이지 않게
 * 됐습니다 — 선택은 상태의 일부라 저장할 것이 없고, 꽂는 일은 트랜잭션입니다.
 * **실제로 불리는 것은 이것 하나였습니다.**
 */
export interface CompositionTracker {
  /** 지금 조합 중인가 */
  isComposing(): boolean
  destroy(): void
}

export function trackComposition(element: HTMLElement): CompositionTracker {
  let composing = false

  const start = (): void => {
    composing = true
  }
  const end = (): void => {
    composing = false
  }

  element.addEventListener('compositionstart', start)
  element.addEventListener('compositionend', end)

  return {
    isComposing: () => composing,
    destroy: () => {
      element.removeEventListener('compositionstart', start)
      element.removeEventListener('compositionend', end)
    },
  }
}
