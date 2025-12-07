import { useEffect } from 'preact/hooks'

/**
 * ESC 키 입력을 감지하는 훅
 *
 * @param handler - ESC 키 입력 시 실행할 콜백
 * @param enabled - 훅 활성화 여부 (기본값: `true`)
 *
 * @example
 * ```tsx
 * const [isOpen, setIsOpen] = useState(false)
 *
 * useEscapeKey(() => setIsOpen(false), isOpen)
 * ```
 */
export function useEscapeKey(
  handler: () => void,
  enabled: boolean = true
): void {
  useEffect(() => {
    if (!enabled) return

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handler()
      }
    }

    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [handler, enabled])
}
