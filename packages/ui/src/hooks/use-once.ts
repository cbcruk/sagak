import { useState, useEffect } from 'preact/hooks'

/**
 * 값을 한 번만 생성하는 훅
 *
 * 컴포넌트 마운트 시 `factory` 함수를 한 번 실행하고,
 * 이후 리렌더링에서는 동일한 값을 반환합니다
 *
 * @param factory - 값을 생성하는 함수
 * @returns 생성된 값
 *
 * @example
 * ```tsx
 * const signals = useOnce(() => createEditorSignals(context))
 * ```
 */
export function useOnce<T>(factory: () => T): T {
  const [value] = useState(factory)
  return value
}

/** `useOnceWithCleanup` 훅의 factory 반환 타입 */
interface OnceWithCleanupResult<T> {
  /** 생성된 값 */
  value: T
  /** 언마운트 시 호출될 정리 함수 */
  cleanup: () => void
}

/**
 * 값을 한 번만 생성하고 언마운트 시 정리하는 훅
 *
 * 컴포넌트 마운트 시 `factory` 함수를 한 번 실행하고,
 * 언마운트 시 `cleanup` 함수를 호출합니다
 *
 * @param factory - `{ value, cleanup }`을 반환하는 함수
 * @returns 생성된 값
 *
 * @example
 * ```tsx
 * const signals = useOnceWithCleanup(() => ({
 *   value: createEditorSignals(context),
 *   cleanup: () => signals.cleanup()
 * }))
 * ```
 */
export function useOnceWithCleanup<T>(
  factory: () => OnceWithCleanupResult<T>
): T {
  const [result] = useState(factory)

  useEffect(() => {
    return result.cleanup
  }, [result])

  return result.value
}
