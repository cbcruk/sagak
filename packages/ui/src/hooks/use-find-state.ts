import { useState } from 'preact/hooks'
import { CoreEvents } from 'sagak-core'
import { useEditorEvent } from './use-editor-event'

/**
 * 찾기 플러그인이 알려 주는 결과를 받습니다.
 *
 * 플러그인은 전용 이벤트가 아니라 `STYLE_CHANGED` 에 `style: 'find'` 를 실어
 * 보냅니다. 그 판별을 여기 한 곳에 가둡니다 — 페이로드가 여러 종류의 합집합
 * 이므로 `style` 확인은 타입 좁히기로도 필요합니다.
 *
 * **이 훅은 계산하지 않습니다.** 예전에는 `FIND_NEXT`/`FIND_PREVIOUS` 가
 * 아무것도 되쏘지 않아서 여기서 플러그인의 `(index ± 1 + n) % n` 을 똑같이
 * 따라 했고, 같은 상태 기계가 두 벌 돌았습니다. 지금은 플러그인이 `matchIndex`
 * 를 실어 보내므로 그대로 옮겨 담기만 합니다.
 */

export interface FindState {
  /** 찾은 개수 */
  matchCount: number
  /** 현재 몇 번째인가 (1부터, 없으면 0) */
  currentMatch: number
}

export interface UseFindStateReturn extends FindState {
  reset: () => void
}

const initial: FindState = { matchCount: 0, currentMatch: 0 }

export function useFindState(): UseFindStateReturn {
  const [state, setState] = useState<FindState>(initial)

  useEditorEvent(CoreEvents.STYLE_CHANGED, 'after', (payload) => {
    if (payload.style !== 'find') return

    const { matchCount, matchIndex } = payload

    if (typeof matchCount !== 'number' || typeof matchIndex !== 'number') return

    setState({
      matchCount,
      // 플러그인은 0부터, 표시는 1부터. 하나도 없으면 -1 이 옵니다
      currentMatch: matchIndex < 0 ? 0 : matchIndex + 1,
    })
  })

  return {
    ...state,
    reset: () => setState(initial),
  }
}
