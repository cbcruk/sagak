import { useState } from 'preact/hooks'
import { CoreEvents } from 'sagak-core'
import { useEditorEvent } from './use-editor-event'

/**
 * 찾기 플러그인이 알려 주는 결과를 받습니다.
 *
 * 플러그인은 전용 이벤트가 아니라 `STYLE_CHANGED` 에 `style: 'find'` 를 실어
 * 보냅니다. 그 판별을 여기 한 곳에 가둡니다 — 페이로드가 여러 종류의 합집합
 * 이므로 `style` 확인은 타입 좁히기로도 필요합니다.
 */

export interface FindState {
  /** 찾은 개수 */
  matchCount: number
  /** 현재 몇 번째인가 (1부터, 없으면 0) */
  currentMatch: number
}

export interface UseFindStateReturn extends FindState {
  /** 다음/이전으로 이동할 때 표시를 앞당깁니다 */
  step: (direction: 1 | -1) => void
  reset: () => void
}

const initial: FindState = { matchCount: 0, currentMatch: 0 }

export function useFindState(): UseFindStateReturn {
  const [state, setState] = useState<FindState>(initial)

  useEditorEvent(CoreEvents.STYLE_CHANGED, 'after', (payload) => {
    if (payload.style !== 'find') return

    const { action, matchCount } = payload

    if (action === 'find' && typeof matchCount === 'number') {
      setState({ matchCount, currentMatch: matchCount > 0 ? 1 : 0 })
      return
    }

    if (action === 'replace' && typeof matchCount === 'number') {
      setState((prev) => ({
        matchCount,
        currentMatch: matchCount === 0 ? 0 : prev.currentMatch,
      }))
      return
    }

    if (action === 'replaceAll' || action === 'clear') {
      setState(initial)
    }
  })

  return {
    ...state,
    /*
     * 플러그인은 `FIND_NEXT`/`FIND_PREVIOUS` 에 아무것도 되쏘지 않고 내부
     * 인덱스만 바꿉니다. 그래서 표시용 번호는 여기서 같은 산술을 따라갑니다 —
     * 플러그인의 `(index ± 1 + n) % n` 을 1부터 세는 형태로 옮긴 것입니다.
     *
     * 같은 상태 기계가 두 곳에 있는 셈입니다. 플러그인이 인덱스를 실어 보내면
     * 이 계산은 사라집니다.
     */
    step: (direction) =>
      setState((prev) => {
        if (prev.matchCount === 0) return prev
        const next =
          direction === 1
            ? (prev.currentMatch % prev.matchCount) + 1
            : prev.currentMatch <= 1
              ? prev.matchCount
              : prev.currentMatch - 1
        return { ...prev, currentMatch: next }
      }),
    reset: () => setState(initial),
  }
}
