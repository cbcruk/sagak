import { useEffect } from 'preact/hooks'

/**
 * 다이얼로그가 열릴 때 폼을 초기화하는 훅
 *
 * @param isOpen - 다이얼로그 열림 상태
 * @param reset - 폼 초기화 함수
 *
 * @example
 * ```tsx
 * const [url, setUrl] = useState('')
 *
 * useResetOnOpen(isOpen, () => {
 *   setUrl(initialUrl)
 * })
 * ```
 */
export function useResetOnOpen(isOpen: boolean, reset: () => void): void {
  useEffect(() => {
    if (isOpen) {
      reset()
    }
  }, [isOpen, reset])
}
