import { useState, useEffect, useRef } from 'react'
import { CoreEvents, type EditorErrorData } from 'sagak-core'
import { useEditorContext } from '../context/editor-context'

export interface UseEditorErrorReturn {
  /**
   * 가장 최근에 발생한 오류 (없으면 `null`)
   */
  lastError: EditorErrorData | null

  /**
   * 마지막 오류를 초기화합니다
   */
  clear: () => void
}

/**
 * 에디터 오류를 구독하는 훅
 *
 * 플러그인/코어에서 발생하는 `CoreEvents.ERROR` 이벤트를 구독하여
 * 가장 최근 오류를 상태로 노출합니다. 선택적으로 오류 발생 시 호출되는
 * 핸들러를 전달할 수 있습니다.
 *
 * @param onError - 오류 발생 시 호출되는 선택적 핸들러
 *
 * @example
 * ```tsx
 * const { lastError } = useEditorError((err) => {
 *   toast.error(`오류: ${err.message}`)
 * })
 * ```
 */
export function useEditorError(
  onError?: (data: EditorErrorData) => void
): UseEditorErrorReturn {
  const context = useEditorContext()
  const [lastError, setLastError] = useState<EditorErrorData | null>(null)

  // 최신 핸들러를 참조하여 effect 재구독을 피합니다
  const onErrorRef = useRef(onError)
  onErrorRef.current = onError

  useEffect(() => {
    if (!context?.eventBus) return

    const unsub = context.eventBus.on(CoreEvents.ERROR, 'on', (data?: unknown) => {
      const errorData = data as EditorErrorData
      setLastError(errorData)
      onErrorRef.current?.(errorData)
    })

    return () => {
      unsub()
    }
  }, [context?.eventBus])

  return {
    lastError,
    clear: () => setLastError(null),
  }
}
