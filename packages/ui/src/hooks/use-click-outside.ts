import { useEffect } from 'preact/hooks'
import type { RefObject } from 'preact'

/**
 * 요소 외부 클릭을 감지하는 훅
 *
 * @param ref - 감지할 요소의 `ref`
 * @param handler - 외부 클릭 시 실행할 콜백
 * @param enabled - 훅 활성화 여부 (기본값: `true`)
 *
 * @example
 * ```tsx
 * const ref = useRef<HTMLDivElement>(null)
 * const [isOpen, setIsOpen] = useState(false)
 *
 * useClickOutside(ref, () => setIsOpen(false), isOpen)
 *
 * return <div ref={ref}>...</div>
 * ```
 */
export function useClickOutside(
  ref: RefObject<HTMLElement>,
  handler: () => void,
  enabled: boolean = true
): void {
  useEffect(() => {
    if (!enabled) return

    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        handler()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [ref, handler, enabled])
}
